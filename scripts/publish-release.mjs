import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const appDist = path.join(root, 'desktop-app', 'dist');
const distRelease = path.join(root, 'dist-release');
const tag = process.argv[2] || 'v1.2.2';

function getToken() {
  const out = execSync('git credential fill', {
    input: 'protocol=https\nhost=github.com\n\n',
    encoding: 'utf8',
    cwd: root,
  });
  const line = out.split(/\r?\n/).find((l) => l.startsWith('password='));
  if (!line) throw new Error('No GitHub password/token in git credentials');
  return line.slice('password='.length).trim();
}

// Prefer portable exe from electron-builder output
const candidates = [
  path.join(distRelease, 'CardianSpriteStudio.exe'),
  path.join(appDist, 'CardianSpriteStudio.exe'),
];
let exePath = candidates.find((p) => fs.existsSync(p));
if (!exePath) {
  console.error('CardianSpriteStudio.exe not found. Run package build first.');
  process.exit(1);
}

fs.mkdirSync(distRelease, { recursive: true });
const releaseExe = path.join(distRelease, 'CardianSpriteStudio.exe');
if (exePath !== releaseExe) fs.copyFileSync(exePath, releaseExe);

const token = getToken();
const owner = 'allenmj1';
const repo = 'cardian-art-app';
const headers = {
  Authorization: `Bearer ${token}`,
  Accept: 'application/vnd.github+json',
  'User-Agent': 'cardian-release',
  'X-GitHub-Api-Version': '2022-11-28',
};

let release;
const existing = await fetch(`https://api.github.com/repos/${owner}/${repo}/releases/tags/${tag}`, { headers });
if (existing.ok) {
  release = await existing.json();
  console.log('Using existing release', release.id);
} else {
  const create = await fetch(`https://api.github.com/repos/${owner}/${repo}/releases`, {
    method: 'POST',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      tag_name: tag,
      name: `Cardian Sprite Studio ${tag}`,
      body: [
        '**Cardian Sprite Studio** — one file, no zip.',
        '',
        '1. Download **CardianSpriteStudio.exe**',
        '2. Double-click to run',
        '3. Sign in with your Cardian account **inside the app**',
        '4. Draw, save, and publish',
        '',
        'Windows: `CardianSpriteStudio.exe`',
      ].join('\n'),
      draft: false,
      prerelease: false,
    }),
  });
  if (!create.ok) throw new Error(await create.text());
  release = await create.json();
  console.log('Created release', release.id);
}

const assets = ['CardianSpriteStudio.exe'];
for (const name of assets) {
  const filePath = path.join(distRelease, name);
  if (!fs.existsSync(filePath)) continue;
  for (const a of release.assets || []) {
    if (a.name === name) await fetch(a.url, { method: 'DELETE', headers });
  }
  const data = fs.readFileSync(filePath);
  const uploadUrl = `${release.upload_url.replace('{?name,label}', '')}?name=${encodeURIComponent(name)}`;
  const res = await fetch(uploadUrl, {
    method: 'POST',
    headers: {
      ...headers,
      'Content-Type': 'application/octet-stream',
      'Content-Length': String(data.length),
    },
    body: data,
  });
  if (!res.ok) console.error(name, await res.text());
  else console.log('Uploaded', name, data.length);
}

console.log('Release URL:', release.html_url);
console.log('Direct download:', `https://github.com/${owner}/${repo}/releases/latest/download/CardianSpriteStudio.exe`);
