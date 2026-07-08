#!/usr/bin/env node
/**
 * Cardian Sprite Studio — account sync CLI
 * Uploads PNGs to the same player_sprites cloud library as Web Studio.
 */

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import readline from 'node:readline/promises';
import { fileURLToPath } from 'node:url';
import { stdin as input, stdout as output } from 'node:process';

const BUCKET = 'community-art';
const MAX_BYTES = 2 * 1024 * 1024;
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Public anon key (same as the Cardian web client). Override via env or config.json.
const DEFAULTS = {
  supabaseUrl: process.env.CARDIAN_SUPABASE_URL || 'https://fabglvdajpyshiptjbhv.supabase.co',
  anonKey: process.env.CARDIAN_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZhYmdsdmRhanB5c2hpcHRqYmh2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA4MzYzNjYsImV4cCI6MjA5NjQxMjM2Nn0.C4TlqOzzvgbJlWMIQvo1GchfpIPZe-PnQ9YC3AtyLk8',
  authUrl: process.env.CARDIAN_AUTH_URL || 'https://playcardian.com/art-studio/desktop-auth',
};

// Production defaults are injected at package time by release.yml when present.
const CONFIG_PATH = path.join(__dirname, 'config.json');

function loadConfig() {
  let fileCfg = {};
  try {
    if (fs.existsSync(CONFIG_PATH)) {
      fileCfg = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
    }
  } catch {
    // ignore
  }
  return {
    supabaseUrl: process.env.CARDIAN_SUPABASE_URL || fileCfg.supabaseUrl || DEFAULTS.supabaseUrl,
    anonKey: process.env.CARDIAN_SUPABASE_ANON_KEY || fileCfg.anonKey || DEFAULTS.anonKey,
    authUrl: process.env.CARDIAN_AUTH_URL || fileCfg.authUrl || DEFAULTS.authUrl,
  };
}

function sessionPath() {
  return path.join(os.homedir(), '.cardian', 'sprite-studio-session.json');
}

function readSession() {
  const p = sessionPath();
  if (!fs.existsSync(p)) return null;
  try {
    return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch {
    return null;
  }
}

function writeSession(session) {
  const p = sessionPath();
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify(session, null, 2), 'utf8');
}

function clearSession() {
  const p = sessionPath();
  if (fs.existsSync(p)) fs.unlinkSync(p);
}

function headers(session, cfg) {
  return {
    apikey: cfg.anonKey,
    Authorization: `Bearer ${session.accessToken}`,
    'Content-Type': 'application/json',
  };
}

async function openBrowser(url) {
  const { exec } = await import('node:child_process');
  const platform = process.platform;
  const cmd =
    platform === 'win32' ? `start "" "${url}"` :
    platform === 'darwin' ? `open "${url}"` :
    `xdg-open "${url}"`;
  exec(cmd);
}

async function cmdLogin(cfg) {
  const url = `${cfg.authUrl}?desktop=1`;
  console.log('Opening Cardian login in your browser…');
  console.log(url);
  await openBrowser(url);

  const rl = readline.createInterface({ input, output });
  const accessToken = (await rl.question('\nPaste access token: ')).trim();
  const userId = (await rl.question('Paste user id: ')).trim();
  const username = (await rl.question('Username (optional): ')).trim();
  rl.close();

  if (!accessToken || !userId) {
    console.error('Access token and user id are required.');
    process.exit(1);
  }
  if (!cfg.anonKey) {
    console.error('Missing CARDIAN_SUPABASE_ANON_KEY (or config.json anonKey).');
    process.exit(1);
  }

  writeSession({
    accessToken,
    userId,
    username: username || undefined,
    savedAt: new Date().toISOString(),
  });
  console.log('Signed in. Session saved to', sessionPath());
}

async function cmdStatus(cfg) {
  const session = readSession();
  if (!session) {
    console.log('Not signed in. Run: node sync.mjs login');
    return;
  }
  console.log('Signed in as', session.username || session.userId);
  console.log('User id:', session.userId);
  console.log('Supabase:', cfg.supabaseUrl);
}

async function cmdListFolders(cfg) {
  const session = requireSession();
  const res = await fetch(
    `${cfg.supabaseUrl}/rest/v1/player_sprite_folders?player_id=eq.${session.userId}&order=sort_order.asc,created_at.asc`,
    { headers: headers(session, cfg) },
  );
  if (!res.ok) {
    console.error(await res.text());
    process.exit(1);
  }
  const rows = await res.json();
  if (!rows.length) {
    console.log('No folders yet.');
    return;
  }
  for (const row of rows) {
    console.log(`${row.id}  ${row.name}`);
  }
}

async function cmdMkdir(cfg, name) {
  const session = requireSession();
  const trimmed = String(name || '').trim();
  if (!trimmed) {
    console.error('Folder name is required.');
    process.exit(1);
  }

  const existingRes = await fetch(
    `${cfg.supabaseUrl}/rest/v1/player_sprite_folders?player_id=eq.${session.userId}&select=sort_order&order=sort_order.desc&limit=1`,
    { headers: headers(session, cfg) },
  );
  if (!existingRes.ok) {
    console.error(await existingRes.text());
    process.exit(1);
  }
  const existing = await existingRes.json();
  const nextOrder = ((existing[0]?.sort_order ?? -1) + 1);

  const res = await fetch(`${cfg.supabaseUrl}/rest/v1/player_sprite_folders`, {
    method: 'POST',
    headers: {
      ...headers(session, cfg),
      Prefer: 'return=representation',
    },
    body: JSON.stringify({
      player_id: session.userId,
      name: trimmed,
      sort_order: nextOrder,
    }),
  });
  if (!res.ok) {
    console.error(await res.text());
    process.exit(1);
  }
  const [row] = await res.json();
  console.log('Created folder:', row.name);
  console.log(row.id);
}

async function resolveFolderId(cfg, session, folderRef) {
  if (!folderRef) return null;
  const trimmed = String(folderRef).trim();
  if (!trimmed) return null;

  const byIdRes = await fetch(
    `${cfg.supabaseUrl}/rest/v1/player_sprite_folders?id=eq.${encodeURIComponent(trimmed)}&player_id=eq.${session.userId}&limit=1`,
    { headers: headers(session, cfg) },
  );
  if (!byIdRes.ok) throw new Error(await byIdRes.text());
  const byId = await byIdRes.json();
  if (byId[0]?.id) return byId[0].id;

  const byNameRes = await fetch(
    `${cfg.supabaseUrl}/rest/v1/player_sprite_folders?player_id=eq.${session.userId}&name=eq.${encodeURIComponent(trimmed)}&limit=1`,
    { headers: headers(session, cfg) },
  );
  if (!byNameRes.ok) throw new Error(await byNameRes.text());
  const byName = await byNameRes.json();
  if (byName[0]?.id) return byName[0].id;

  throw new Error(`Folder not found: ${trimmed}`);
}

async function cmdList(cfg) {
  const session = requireSession();
  const res = await fetch(
    `${cfg.supabaseUrl}/rest/v1/player_sprites?player_id=eq.${session.userId}&order=created_at.desc&limit=100`,
    { headers: headers(session, cfg) },
  );
  if (!res.ok) {
    console.error(await res.text());
    process.exit(1);
  }
  const rows = await res.json();
  if (!rows.length) {
    console.log('No sprites yet.');
    return;
  }
  for (const row of rows) {
    const folder = row.folder_id ? `folder:${row.folder_id}` : 'unfiled';
    console.log(`${row.id}  ${row.name}  ${row.source}  ${folder}  ${row.art_url}`);
  }
}

async function cmdUpload(cfg, filePath, name, folderRef) {
  const session = requireSession();
  const abs = path.resolve(filePath);
  if (!fs.existsSync(abs)) {
    console.error('File not found:', abs);
    process.exit(1);
  }
  const bytes = fs.readFileSync(abs);
  if (bytes.byteLength > MAX_BYTES) {
    console.error('Image must be 2 MB or smaller');
    process.exit(1);
  }

  const folderId = await resolveFolderId(cfg, session, folderRef);

  const timestamp = Date.now();
  const fileStoragePath = `sprites/${session.userId}/${timestamp}.png`;
  const uploadRes = await fetch(
    `${cfg.supabaseUrl}/storage/v1/object/${BUCKET}/${fileStoragePath}`,
    {
      method: 'POST',
      headers: {
        apikey: cfg.anonKey,
        Authorization: `Bearer ${session.accessToken}`,
        'Content-Type': 'image/png',
        'x-upsert': 'true',
      },
      body: bytes,
    },
  );
  if (!uploadRes.ok) {
    console.error(await uploadRes.text());
    process.exit(1);
  }

  const artUrl = `${cfg.supabaseUrl}/storage/v1/object/public/${BUCKET}/${fileStoragePath}`;
  const spriteName = name || path.basename(abs, path.extname(abs));
  const insertRes = await fetch(`${cfg.supabaseUrl}/rest/v1/player_sprites`, {
    method: 'POST',
    headers: {
      ...headers(session, cfg),
      Prefer: 'return=representation',
    },
    body: JSON.stringify({
      player_id: session.userId,
      folder_id: folderId,
      name: spriteName,
      file_path: fileStoragePath,
      art_url: artUrl,
      thumbnail_url: artUrl,
      source: 'desktop',
      size_bytes: bytes.byteLength,
    }),
  });
  if (!insertRes.ok) {
    console.error(await insertRes.text());
    process.exit(1);
  }
  const [row] = await insertRes.json();
  console.log('Uploaded:', row.name);
  console.log(row.art_url);
  console.log('View at https://playcardian.com/art-studio');
}

function requireSession() {
  const session = readSession();
  if (!session?.accessToken || !session?.userId) {
    console.error('Not signed in. Run: node sync.mjs login');
    process.exit(1);
  }
  return session;
}

function printHelp() {
  console.log(`Cardian Sync — Cardian Sprite Studio

Usage:
  node sync.mjs login
  node sync.mjs status
  node sync.mjs folders
  node sync.mjs mkdir "Folder name"
  node sync.mjs list
  node sync.mjs upload <file.png> [--name "Sprite name"] [--folder <folder id or name>]
  node sync.mjs logout
`);
}

async function main() {
  const cfg = loadConfig();
  const [cmd, ...rest] = process.argv.slice(2);

  if (!cmd || cmd === 'help' || cmd === '-h' || cmd === '--help') {
    printHelp();
    return;
  }

  if (cmd === 'login') return cmdLogin(cfg);
  if (cmd === 'status') return cmdStatus(cfg);
  if (cmd === 'folders') return cmdListFolders(cfg);
  if (cmd === 'mkdir') {
    const name = rest.find((a) => !a.startsWith('--'));
    if (!name) {
      console.error('Usage: node sync.mjs mkdir "Folder name"');
      process.exit(1);
    }
    return cmdMkdir(cfg, name);
  }
  if (cmd === 'list') return cmdList(cfg);
  if (cmd === 'logout') {
    clearSession();
    console.log('Signed out.');
    return;
  }
  if (cmd === 'upload') {
    const file = rest.find((a) => !a.startsWith('--'));
    const nameIdx = rest.indexOf('--name');
    const folderIdx = rest.indexOf('--folder');
    const name = nameIdx >= 0 ? rest[nameIdx + 1] : undefined;
    const folder = folderIdx >= 0 ? rest[folderIdx + 1] : undefined;
    if (!file) {
      console.error('Usage: node sync.mjs upload <file.png> [--name "Name"] [--folder <folder id or name>]');
      process.exit(1);
    }
    return cmdUpload(cfg, file, name, folder);
  }

  console.error('Unknown command:', cmd);
  printHelp();
  process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
