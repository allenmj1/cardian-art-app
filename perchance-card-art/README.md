# Perchance card art sidecar

HTTP service that generates images via [Perchance](https://perchance.org/) for Cardian admin art tools. Uses Chromium on Linux (Coolify/Docker safe) and does **not** exit when generation retries fail.

## Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/health` | none | Always returns 200 when the process is up |
| POST | `/api/generate` | `Bearer CARDIAN_API_KEY` | Generate image from prompt |
| POST | `/api/refresh-key` | `Bearer CARDIAN_API_KEY` | Force-refresh Perchance `userKey` |

### Generate body

```json
{
  "prompt": "small green goblin with wooden club",
  "negative_prompt": "text, watermark",
  "resolution": "512x512",
  "pixel_style": true,
  "response": "json"
}
```

Response:

```json
{
  "mime_type": "image/jpeg",
  "image_base64": "..."
}
```

## Environment

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `8787` | HTTP port |
| `CARDIAN_API_KEY` | — | Required. Same value as `PERCHANCE_CARD_ART_API_KEY` in Supabase |
| `PERCHANCE_CHANNEL` | `ai-text-to-image-generator` | Perchance generator slug |
| `PERCHANCE_RESOLUTION` | `512x512` | Perchance resolution string |
| `PERCHANCE_MAX_QUEUE` | `4` | Max concurrent generations |
| `PERCHANCE_GENERATE_RETRIES` | `12` | Retries when Perchance returns `waiting_for_prev_request_to_finish` |
| `PERCHANCE_GENERATE_RETRY_MS` | `6000` | Delay between those retries |
| `PERCHANCE_KEY_CACHE_PATH` | `./data/last-key.txt` | Persisted userKey |

## Local dev

```bash
cd perchance-card-art
npm install
npx playwright install chromium
CARDIAN_API_KEY=dev-secret npm run dev
```

## Coolify / Docker

1. Deploy this folder as its own app (Dockerfile included).
2. Set `CARDIAN_API_KEY` to a long random secret.
3. Health check: `GET /health` (not `/api/generate`).
4. Give the container at least **1 GB RAM** (Chromium headless).
5. Map port `8787` and point `perchance-art.playcardian.com` at it.

In Supabase edge function secrets (optional wiring):

- `PERCHANCE_CARD_ART_URL=https://perchance-art.playcardian.com`
- `PERCHANCE_CARD_ART_API_KEY=<same as CARDIAN_API_KEY>`

## Why the old service crashed

Common causes this build fixes:

1. **Firefox on Linux** — older scripts used Playwright Firefox, which is unreliable in Docker. This service uses **Chromium**.
2. **Health check tied to generation** — Coolify killed the container while Perchance was still warming up. `/health` is always fast.
3. **Unhandled errors** — browser/key failures no longer take down the Node process.
4. **Retry storms** — `waiting_for_prev_request_to_finish` is handled in-process with bounded retries instead of crashing the server.
