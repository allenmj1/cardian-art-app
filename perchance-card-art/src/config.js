const DEFAULT_PORT = 8787;
const DEFAULT_CHANNEL = 'ai-text-to-image-generator';
const DEFAULT_RESOLUTION = '512x512';

export function loadConfig() {
  const port = Number(process.env.PORT ?? DEFAULT_PORT);
  const apiKey = process.env.CARDIAN_API_KEY ?? process.env.PERCHANCE_CARD_ART_API_KEY ?? '';
  const channel = process.env.PERCHANCE_CHANNEL ?? DEFAULT_CHANNEL;
  const resolution = process.env.PERCHANCE_RESOLUTION ?? DEFAULT_RESOLUTION;
  const guidanceScale = Number(process.env.PERCHANCE_GUIDANCE_SCALE ?? 7);
  const keyCachePath = process.env.PERCHANCE_KEY_CACHE_PATH ?? './data/last-key.txt';
  const maxQueue = Math.max(1, Number(process.env.PERCHANCE_MAX_QUEUE ?? 4));
  const generateRetries = Math.max(1, Number(process.env.PERCHANCE_GENERATE_RETRIES ?? 12));
  const generateRetryMs = Math.max(1000, Number(process.env.PERCHANCE_GENERATE_RETRY_MS ?? 6000));
  const keyRefreshMs = Math.max(60_000, Number(process.env.PERCHANCE_KEY_REFRESH_MS ?? 6 * 60 * 60 * 1000));

  if (!apiKey) {
    console.warn('[perchance-card-art] CARDIAN_API_KEY is not set — all /api/* requests will be rejected');
  }

  return {
    port,
    apiKey,
    channel,
    resolution,
    guidanceScale,
    keyCachePath,
    maxQueue,
    generateRetries,
    generateRetryMs,
    keyRefreshMs,
    perchancePageUrl: process.env.PERCHANCE_PAGE_URL ?? `https://perchance.org/${channel}`,
  };
}
