/**
 * Build release assets locally and print paths.
 * Usage: node scripts/package-release.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const dist = path.join(root, 'dist-release');
const upstream = path.join(dist, 'upstream');
const UPSTREAM = 'https://github.com/LibreSprite/LibreSprite/releases/download/v1.2';

function run(cmd) {
  console.log('>', cmd);
  execSync(cmd, { stdio: 'inherit', cwd: root, shell: true });
}

fs.rmSync(dist, { recursive: true, force: true });
fs.mkdirSync(upstream, { recursive: true });

const downloads = [
  ['windows.zip', `${UPSTREAM}/libresprite-development-windows-x86_64.zip`],
  ['macos.dmg', `${UPSTREAM}/libresprite-development-macos-arm64.dmg`],
  ['linux.AppImage', `${UPSTREAM}/LibreSprite-anylinux-x86_64.AppImage`],
];

for (const [name, url] of downloads) {
  const out = path.join(upstream, name);
  run(`curl -fsSL -o "${out}" "${url}"`);
}

// Windows zip
const win = path.join(dist, 'windows');
fs.mkdirSync(path.join(win, 'editor'), { recursive: true });
run(`powershell -Command "Expand-Archive -Path '${path.join(upstream, 'windows.zip')}' -DestinationPath '${path.join(win, 'editor')}' -Force"`);
fs.cpSync(path.join(root, 'cardian-sync'), path.join(win, 'cardian-sync'), { recursive: true });
fs.copyFileSync(path.join(root, 'CARDIAN.md'), path.join(win, 'README-CARDIAN.md'));
fs.writeFileSync(path.join(win, 'START-HERE.txt'), `Cardian Sprite Studio (Windows)

1. Open the editor folder and run the app.
2. File → Export as PNG.
3. Install Node.js 18+ from https://nodejs.org/
4. cd cardian-sync
   node sync.mjs login
   node sync.mjs upload path\\to\\art.png --name "My Art"
5. https://playcardian.com/art-studio
`);
run(`powershell -Command "Compress-Archive -Path '${win}\\*' -DestinationPath '${path.join(dist, 'cardian-sprite-studio-windows.zip')}' -Force"`);

// macOS dmg + bundle
fs.copyFileSync(path.join(upstream, 'macos.dmg'), path.join(dist, 'cardian-sprite-studio-macos-arm64.dmg'));
const mac = path.join(dist, 'macos');
fs.mkdirSync(mac, { recursive: true });
fs.copyFileSync(path.join(upstream, 'macos.dmg'), path.join(mac, 'cardian-sprite-studio-editor.dmg'));
fs.cpSync(path.join(root, 'cardian-sync'), path.join(mac, 'cardian-sync'), { recursive: true });
fs.copyFileSync(path.join(root, 'CARDIAN.md'), path.join(mac, 'README-CARDIAN.md'));
run(`powershell -Command "Compress-Archive -Path '${mac}\\*' -DestinationPath '${path.join(dist, 'cardian-sprite-studio-macos-arm64-bundle.zip')}' -Force"`);

// Linux
fs.copyFileSync(path.join(upstream, 'linux.AppImage'), path.join(dist, 'cardian-sprite-studio-linux.AppImage'));
const lin = path.join(dist, 'linux');
fs.mkdirSync(lin, { recursive: true });
fs.copyFileSync(path.join(upstream, 'linux.AppImage'), path.join(lin, 'cardian-sprite-studio-linux.AppImage'));
fs.cpSync(path.join(root, 'cardian-sync'), path.join(lin, 'cardian-sync'), { recursive: true });
fs.copyFileSync(path.join(root, 'CARDIAN.md'), path.join(lin, 'README-CARDIAN.md'));
run(`powershell -Command "Compress-Archive -Path '${lin}\\*' -DestinationPath '${path.join(dist, 'cardian-sprite-studio-linux-bundle.zip')}' -Force"`);

console.log('Assets ready in', dist);
