function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function encodePrompt(prompt) {
  return encodeURIComponent(prompt).replace(/'/g, '%27');
}

export async function generatePerchanceImage({
  prompt,
  negativePrompt,
  userKey,
  channel,
  resolution,
  guidanceScale,
  retries,
  retryMs,
}) {
  const createUrl = 'https://image-generation.perchance.org/api/generate';
  const createParams = new URLSearchParams({
    prompt: encodePrompt(prompt),
    negativePrompt: encodePrompt(negativePrompt),
    userKey,
    __cache_bust: String(Math.random()),
    seed: '-1',
    resolution,
    guidanceScale: String(guidanceScale),
    channel,
    subChannel: 'public',
    requestId: String(Math.random()),
  });

  let lastStatus = 'unknown';
  for (let attempt = 0; attempt < retries; attempt += 1) {
    const res = await fetch(`${createUrl}?${createParams.toString()}`);
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Perchance generate HTTP ${res.status}: ${text.slice(0, 200)}`);
    }

    const data = await res.json();
    lastStatus = data?.status ?? 'unknown';

    if (lastStatus === 'success' && data.imageId) {
      return downloadTemporaryImage(data.imageId);
    }

    if (lastStatus === 'waiting_for_prev_request_to_finish') {
      await sleep(retryMs);
      continue;
    }

    if (lastStatus === 'invalid_user_key') {
      const err = new Error('Perchance userKey invalid');
      err.code = 'INVALID_USER_KEY';
      throw err;
    }

    throw new Error(`Perchance generate failed with status: ${lastStatus}`);
  }

  throw new Error(`Perchance generate timed out (${lastStatus}) after ${retries} attempts`);
}

async function downloadTemporaryImage(imageId) {
  const url = new URL('https://image-generation.perchance.org/api/downloadTemporaryImage');
  url.searchParams.set('imageId', imageId);

  const res = await fetch(url);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Perchance download HTTP ${res.status}: ${text.slice(0, 200)}`);
  }

  const bytes = Buffer.from(await res.arrayBuffer());
  const contentType = res.headers.get('content-type') ?? 'image/jpeg';
  return { bytes, contentType };
}
