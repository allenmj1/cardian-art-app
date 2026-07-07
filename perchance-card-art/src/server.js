import http from 'node:http';
import { loadConfig } from './config.js';
import { KeyManager } from './keyManager.js';
import { generatePerchanceImage } from './perchanceApi.js';
import { createQueue } from './queue.js';

const config = loadConfig();
const keyManager = new KeyManager(config);
const queue = createQueue(config.maxQueue);

const PIXEL_STYLE_SUFFIX = 'pixel art, 16-bit game sprite, limited color palette, no text, no watermark';
const DEFAULT_NEGATIVE = 'text, watermark, signature, blurry, photorealistic, 3d render, ui, card frame';

function json(res, status, body) {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(payload),
  });
  res.end(payload);
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => {
      try {
        const raw = Buffer.concat(chunks).toString('utf8');
        resolve(raw ? JSON.parse(raw) : {});
      } catch (err) {
        reject(err);
      }
    });
    req.on('error', reject);
  });
}

function authorize(req) {
  if (!config.apiKey) return false;
  const header = req.headers.authorization ?? '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : header;
  return token === config.apiKey;
}

async function handleGenerate(req, res) {
  if (!authorize(req)) {
    json(res, 401, { error: 'Unauthorized' });
    return;
  }

  let body;
  try {
    body = await readJson(req);
  } catch {
    json(res, 400, { error: 'Invalid JSON body' });
    return;
  }

  const prompt = String(body.prompt ?? '').trim();
  if (!prompt) {
    json(res, 400, { error: 'prompt is required' });
    return;
  }

  if (!keyManager.ready) {
    json(res, 503, {
      error: 'Perchance userKey not ready yet',
      retry_after_seconds: 15,
      detail: keyManager.lastError,
    });
    return;
  }

  const negativePrompt = String(body.negative_prompt ?? body.negativePrompt ?? DEFAULT_NEGATIVE).trim();
  const styledPrompt = body.pixel_style === false ? prompt : `${prompt}, ${PIXEL_STYLE_SUFFIX}`;

  try {
    const result = await queue.run(async () => {
      const userKey = await keyManager.getKey();
      try {
        return await generatePerchanceImage({
          prompt: styledPrompt,
          negativePrompt,
          userKey,
          channel: config.channel,
          resolution: body.resolution ?? config.resolution,
          guidanceScale: config.guidanceScale,
          retries: config.generateRetries,
          retryMs: config.generateRetryMs,
        });
      } catch (err) {
        if (err?.code === 'INVALID_USER_KEY') {
          await keyManager.refreshKey('invalid_user_key');
          const refreshedKey = await keyManager.getKey();
          return generatePerchanceImage({
            prompt: styledPrompt,
            negativePrompt,
            userKey: refreshedKey,
            channel: config.channel,
            resolution: body.resolution ?? config.resolution,
            guidanceScale: config.guidanceScale,
            retries: config.generateRetries,
            retryMs: config.generateRetryMs,
          });
        }
        throw err;
      }
    });

    if (body.response === 'bytes' || req.headers.accept === 'image/*') {
      res.writeHead(200, { 'Content-Type': result.contentType });
      res.end(result.bytes);
      return;
    }

    json(res, 200, {
      mime_type: result.contentType,
      image_base64: result.bytes.toString('base64'),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Generation failed';
    console.error('[perchance-card-art] generate error:', message);
    json(res, 502, { error: message });
  }
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`);

  if (req.method === 'GET' && (url.pathname === '/health' || url.pathname === '/')) {
    json(res, 200, {
      ok: true,
      service: 'perchance-card-art',
      key_ready: keyManager.ready,
      key_error: keyManager.lastError,
      queue_depth: queue.depth,
      queue_active: queue.active,
    });
    return;
  }

  if (req.method === 'POST' && url.pathname === '/api/generate') {
    await handleGenerate(req, res);
    return;
  }

  if (req.method === 'POST' && url.pathname === '/api/refresh-key') {
    if (!authorize(req)) {
      json(res, 401, { error: 'Unauthorized' });
      return;
    }
    try {
      await keyManager.refreshKey('api');
      json(res, 200, { ok: true, key_ready: keyManager.ready });
    } catch (err) {
      json(res, 502, {
        error: err instanceof Error ? err.message : 'Key refresh failed',
      });
    }
    return;
  }

  json(res, 404, { error: 'Not found' });
});

process.on('uncaughtException', (err) => {
  console.error('[perchance-card-art] uncaughtException:', err);
});

process.on('unhandledRejection', (err) => {
  console.error('[perchance-card-art] unhandledRejection:', err);
});

server.listen(config.port, () => {
  console.log(`[perchance-card-art] listening on :${config.port}`);
  keyManager.init().catch((err) => {
    console.error('[perchance-card-art] initial key warmup failed:', err);
    console.error('[perchance-card-art] /health stays up; generation returns 503 until key is ready');
  });
});
