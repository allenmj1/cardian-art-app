import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';

const USER_KEY_PATTERN = /userKey=([a-f\d]{64})/i;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export class KeyManager {
  /** @param {import('./config.js').loadConfig extends () => infer C ? C : never} config */
  constructor(config) {
    this.config = config;
    this.userKey = null;
    this.lastFetchedAt = 0;
    this.refreshing = null;
    this.lastError = null;
  }

  get ready() {
    return Boolean(this.userKey);
  }

  async init() {
    await fs.mkdir(path.dirname(this.config.keyCachePath), { recursive: true });
    const cached = await this.readCachedKey();
    if (cached && await this.verifyKey(cached)) {
      this.userKey = cached;
      this.lastFetchedAt = Date.now();
      console.log('[perchance-card-art] Restored cached Perchance userKey');
      return;
    }
    await this.refreshKey('startup');
  }

  async getKey() {
    if (this.userKey && Date.now() - this.lastFetchedAt < this.config.keyRefreshMs) {
      return this.userKey;
    }
    await this.refreshKey('expired');
    if (!this.userKey) {
      throw new Error(this.lastError ?? 'Perchance userKey unavailable');
    }
    return this.userKey;
  }

  async refreshKey(reason = 'manual') {
    if (this.refreshing) return this.refreshing;

    this.refreshing = (async () => {
      console.log(`[perchance-card-art] Refreshing Perchance userKey (${reason})…`);
      try {
        const key = await this.captureUserKeyFromBrowser();
        if (!await this.verifyKey(key)) {
          throw new Error('Captured userKey failed verification');
        }
        this.userKey = key;
        this.lastFetchedAt = Date.now();
        this.lastError = null;
        await fs.writeFile(this.config.keyCachePath, key, 'utf8');
        console.log('[perchance-card-art] Perchance userKey refreshed');
      } catch (err) {
        this.lastError = err instanceof Error ? err.message : String(err);
        console.error('[perchance-card-art] userKey refresh failed:', this.lastError);
        throw err;
      } finally {
        this.refreshing = null;
      }
    })();

    return this.refreshing;
  }

  async readCachedKey() {
    try {
      const raw = await fs.readFile(this.config.keyCachePath, 'utf8');
      const trimmed = raw.trim();
      const match = USER_KEY_PATTERN.exec(trimmed)?.[1];
      return match ?? (trimmed || null);
    } catch {
      return null;
    }
  }

  async verifyKey(userKey) {
    const url = new URL('https://image-generation.perchance.org/api/checkVerificationStatus');
    url.searchParams.set('userKey', userKey);
    url.searchParams.set('__cache_bust', String(Math.random()));

    const res = await fetch(url);
    if (!res.ok) return false;
    const data = await res.json();
    return data?.status !== 'not_verified';
  }

  async captureUserKeyFromBrowser() {
    const timeoutMs = Number(process.env.PERCHANCE_KEY_TIMEOUT_MS ?? 90_000);
    const started = Date.now();

    const browser = await chromium.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
    });

    try {
      const page = await browser.newPage();
      const seen = new Set();

      page.on('request', (request) => {
        const url = request.url();
        if (!url.includes('image-generation.perchance.org')) return;
        const match = USER_KEY_PATTERN.exec(url);
        if (match) seen.add(match[1]);
      });

      await page.goto(this.config.perchancePageUrl, {
        waitUntil: 'domcontentloaded',
        timeout: 60_000,
      });

      const frame = page.frameLocator('iframe[src]');
      await frame.locator('button#generateButtonEl').click({ timeout: 30_000 });

      while (Date.now() - started < timeoutMs) {
        if (seen.size > 0) {
          return [...seen][0];
        }
        await sleep(1000);
      }

      throw new Error(`Timed out after ${timeoutMs}ms waiting for Perchance userKey`);
    } finally {
      await browser.close().catch(() => {});
    }
  }
}
