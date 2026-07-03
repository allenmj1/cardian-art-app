/**
 * Build branded, binary-only Cardian Sprite Studio release packages.
 * No source files (.mjs, .md build docs, package.json) ship to users.
 *
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
const binDir = path.join(dist, 'bin');
const UPSTREAM = 'https://github.com/LibreSprite/LibreSprite/releases/download/v1.2';

const USER_README = `Cardian Sprite Studio
=====================

Create pixel art for Cardian cards, then sync to your account.

QUICK START
-----------
1. Run CardianSpriteStudio (Windows) / open the app (macOS) / run the AppImage (Linux).
2. Draw your art, then use File → Export and save a PNG.
3. Run CardianSync:
     CardianSync login
     CardianSync upload path/to/art.png --name "My Art"
4. Open https://playcardian.com/art-studio to see Your Saved Sprites.
5. Link your account at: https://playcardian.com/art-studio/desktop-auth

REQUIREMENTS
------------
- Windows 10+, macOS 11+ (Apple Silicon), or Linux x86_64
- Internet connection for account sync

Cardian  ·  https://playcardian.com
`;

function run(cmd, opts = {}) {
  console.log('>', cmd);
  execSync(cmd, { stdio: 'inherit', cwd: root, shell: true, ...opts });
}

function rm(p) {
  fs.rmSync(p, { recursive: true, force: true });
}

function ensureDir(p) {
  fs.mkdirSync(p, { recursive: true });
}

function copyDir(src, dest) {
  ensureDir(dest);
  fs.cpSync(src, dest, { recursive: true });
}

function writeUserReadme(dir) {
  fs.writeFileSync(path.join(dir, 'README.txt'), USER_README, 'utf8');
}

function zipDir(sourceDir, outZip) {
  if (fs.existsSync(outZip)) fs.unlinkSync(outZip);
  run(
    `powershell -NoProfile -Command "Compress-Archive -Path '${sourceDir}\\*' -DestinationPath '${outZip}' -Force"`,
  );
}

function findFileRecursive(dir, predicate) {
  if (!fs.existsSync(dir)) return null;
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    const st = fs.statSync(full);
    if (st.isDirectory()) {
      const found = findFileRecursive(full, predicate);
      if (found) return found;
    } else if (predicate(name, full)) {
      return full;
    }
  }
  return null;
}

function stripSourceAndJunk(dir) {
  const killNames = new Set([
    'package.json',
    'package-lock.json',
    'sync.mjs',
    'config.json',
    'README.md',
    'CARDIAN.md',
    'README-CARDIAN.md',
    'START-HERE.txt',
    'LICENSE',
    'LICENSE.txt',
    'CMakeLists.txt',
  ]);
  const killExt = new Set([
    '.mjs', '.ts', '.tsx', '.jsx', '.c', '.cpp', '.h', '.hpp',
    '.cmake', '.pdb', '.lib', '.a', '.obj', '.o', '.md', '.git',
  ]);

  function walk(d) {
    for (const name of fs.readdirSync(d)) {
      const full = path.join(d, name);
      const st = fs.statSync(full);
      if (st.isDirectory()) {
        if (name === 'src' || name === 'include' || name === 'docs' || name === '.git') {
          rm(full);
          continue;
        }
        walk(full);
        continue;
      }
      const ext = path.extname(name).toLowerCase();
      if (killNames.has(name) || killExt.has(ext)) {
        fs.unlinkSync(full);
      }
    }
  }
  walk(dir);
}

function brandWindowsTree(editorRoot) {
  const exe = findFileRecursive(editorRoot, (n) => /^libresprite\.exe$/i.test(n));
  if (exe) {
    const dest = path.join(path.dirname(exe), 'CardianSpriteStudio.exe');
    if (fs.existsSync(dest)) fs.unlinkSync(dest);
    fs.renameSync(exe, dest);
    console.log('Renamed', exe, '->', dest);
  } else {
    console.warn('libresprite.exe not found for rename');
  }
  // Remove unbranded shortcuts / docs if present
  for (const name of ['README.md', 'README.txt', 'LICENSE.txt', 'CHANGELOG.md']) {
    const p = findFileRecursive(editorRoot, (n) => n === name);
    if (p) fs.unlinkSync(p);
  }
}

// --- build ---
rm(dist);
ensureDir(upstream);
ensureDir(binDir);

const downloads = [
  ['windows.zip', `${UPSTREAM}/libresprite-development-windows-x86_64.zip`],
  ['macos.dmg', `${UPSTREAM}/libresprite-development-macos-arm64.dmg`],
  ['linux.AppImage', `${UPSTREAM}/LibreSprite-anylinux-x86_64.AppImage`],
];

for (const [name, url] of downloads) {
  const out = path.join(upstream, name);
  run(`curl -fsSL -o "${out}" "${url}"`);
}

// Compile cardian-sync to native binaries (no source shipped)
console.log('Compiling CardianSync binaries…');
const syncSrc = path.join(root, 'cardian-sync', 'sync.cjs');
run(`npx --yes @yao-pkg/pkg@5.16.1 "${syncSrc}" --targets node18-win-x64 --output "${path.join(binDir, 'CardianSync')}"`);
run(`npx --yes @yao-pkg/pkg@5.16.1 "${syncSrc}" --targets node18-macos-arm64 --no-bytecode --public --output "${path.join(binDir, 'CardianSync-macos')}"`);
run(`npx --yes @yao-pkg/pkg@5.16.1 "${syncSrc}" --targets node18-linux-x64 --no-bytecode --public --output "${path.join(binDir, 'CardianSync-linux')}"`);

function resolveSyncBinary(platform) {
  const candidates = fs.readdirSync(binDir).map((n) => path.join(binDir, n));
  if (platform === 'win') {
    return candidates.find((p) => /win/i.test(path.basename(p)) && p.endsWith('.exe'))
      || candidates.find((p) => p.endsWith('.exe'));
  }
  if (platform === 'mac') {
    return candidates.find((p) => /macos|darwin|arm64/i.test(path.basename(p)) && !p.endsWith('.exe'));
  }
  return candidates.find((p) => /linux/i.test(path.basename(p)) && !p.endsWith('.exe'));
}

// --- Windows package ---
const winRoot = path.join(dist, 'CardianSpriteStudio-Windows');
ensureDir(winRoot);
run(
  `powershell -NoProfile -Command "Expand-Archive -Path '${path.join(upstream, 'windows.zip')}' -DestinationPath '${path.join(winRoot, '_extract')}' -Force"`,
);
// Flatten if zip has a single top folder
const extractDir = path.join(winRoot, '_extract');
const extractKids = fs.readdirSync(extractDir);
const editorSource = extractKids.length === 1 && fs.statSync(path.join(extractDir, extractKids[0])).isDirectory()
  ? path.join(extractDir, extractKids[0])
  : extractDir;
copyDir(editorSource, path.join(winRoot, 'Editor'));
rm(extractDir);
brandWindowsTree(path.join(winRoot, 'Editor'));
stripSourceAndJunk(path.join(winRoot, 'Editor'));

const winSync = resolveSyncBinary('win');
if (!winSync) throw new Error('Windows CardianSync binary missing');
fs.copyFileSync(winSync, path.join(winRoot, 'CardianSync.exe'));
writeUserReadme(winRoot);
// Branded launcher
fs.writeFileSync(
  path.join(winRoot, 'Launch Cardian Sprite Studio.bat'),
  '@echo off\r\ncd /d "%~dp0Editor"\r\nstart "" "CardianSpriteStudio.exe"\r\n',
  'utf8',
);
zipDir(winRoot, path.join(dist, 'cardian-sprite-studio-windows.zip'));

// --- macOS package (dmg + sync binary, no source) ---
const macRoot = path.join(dist, 'CardianSpriteStudio-macOS');
ensureDir(macRoot);
fs.copyFileSync(path.join(upstream, 'macos.dmg'), path.join(macRoot, 'CardianSpriteStudio.dmg'));
const macSync = resolveSyncBinary('mac');
if (!macSync) throw new Error('macOS CardianSync binary missing');
fs.copyFileSync(macSync, path.join(macRoot, 'CardianSync'));
writeUserReadme(macRoot);
zipDir(macRoot, path.join(dist, 'cardian-sprite-studio-macos-arm64.zip'));

// --- Linux package ---
const linRoot = path.join(dist, 'CardianSpriteStudio-Linux');
ensureDir(linRoot);
fs.copyFileSync(
  path.join(upstream, 'linux.AppImage'),
  path.join(linRoot, 'CardianSpriteStudio.AppImage'),
);
const linSync = resolveSyncBinary('linux');
if (!linSync) throw new Error('Linux CardianSync binary missing');
fs.copyFileSync(linSync, path.join(linRoot, 'CardianSync'));
writeUserReadme(linRoot);
zipDir(linRoot, path.join(dist, 'cardian-sprite-studio-linux-x64.zip'));

console.log('\nBinary-only assets:');
for (const f of [
  'cardian-sprite-studio-windows.zip',
  'cardian-sprite-studio-macos-arm64.zip',
  'cardian-sprite-studio-linux-x64.zip',
]) {
  const p = path.join(dist, f);
  const mb = (fs.statSync(p).size / 1024 / 1024).toFixed(1);
  console.log(`  ${f} (${mb} MB)`);
}
