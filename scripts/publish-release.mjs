import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const dist = path.join(root, 'dist-release');
const tag = process.argv[2] || 'v1.1.0';

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
        '**Cardian Sprite Studio** — branded desktop pixel editor for Cardian.',
        '',
        'Binary-only packages (no source code).',
        '',
        '### Downloads',
        '- **Windows:** `cardian-sprite-studio-windows.zip`',
        '- **macOS (Apple Silicon):** `cardian-sprite-studio-macos-arm64.zip`',
        '- **Linux:** `cardian-sprite-studio-linux-x64.zip`',
        '',
        '### Includes',
        '- `CardianSpriteStudio` editor',
        '- `CardianSync` account sync tool (compiled)',
        '- `README.txt` quick start',
        '',
        '### Sync',
        '1. Export PNG from the editor',
        '2. Run `CardianSync login` (token from https://playcardian.com/art-studio/desktop-auth)',
        '3. `CardianSync upload art.png --name "My Art"`',
        '4. https://playcardian.com/art-studio',
      ].join('\n'),
      draft: false,
      prerelease: false,
    }),
  });
  if (!create.ok) throw new Error(await create.text());
  release = await create.json();
  console.log('Created release', release.id);
}

const assets = [
  'cardian-sprite-studio-windows.zip',
  'cardian-sprite-studio-macos-arm64.zip',
  'cardian-sprite-studio-linux-x64.zip',
];

for (const name of assets) {
  const filePath = path.join(dist, name);
  if (!fs.existsSync(filePath)) {
    console.warn('Missing', name);
    continue;
  }
  for (const a of release.assets || []) {
    if (a.name === name) {
      await fetch(a.url, { method: 'DELETE', headers });
    }
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
