/**
 * Build a single CardianSpriteStudio.exe (portable) for Windows.
 * Users download the .exe and run it — no zip extraction.
 */
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const appDir = path.join(root, 'desktop-app');
const distRelease = path.join(root, 'dist-release');
const appDist = path.join(appDir, 'dist');

function run(cmd, cwd = root) {
  console.log('>', cmd);
  execSync(cmd, {
    stdio: 'inherit',
    cwd,
    shell: true,
    env: { ...process.env, CSC_IDENTITY_AUTO_DISCOVERY: 'false' },
  });
}

fs.rmSync(distRelease, { recursive: true, force: true });
fs.mkdirSync(distRelease, { recursive: true });

run('npm install', appDir);

// Prefer portable single-exe; fall back to zipping win-unpacked
let portableOk = false;
try {
  run('npx electron-builder --win portable --x64', appDir);
  portableOk = true;
} catch (err) {
  console.warn('Portable build failed, falling back to folder zip:', err.message);
  run('npx electron-builder --win dir --x64', appDir);
}

const portableExe = path.join(appDist, 'CardianSpriteStudio.exe');
const altPortable = fs.existsSync(appDist)
  ? fs.readdirSync(appDist).map((n) => path.join(appDist, n)).find((p) => /portable|CardianSpriteStudio/i.test(path.basename(p)) && p.endsWith('.exe') && !p.includes('win-unpacked'))
  : null;

if (portableOk && (fs.existsSync(portableExe) || altPortable)) {
  const src = fs.existsSync(portableExe) ? portableExe : altPortable;
  fs.copyFileSync(src, path.join(distRelease, 'CardianSpriteStudio.exe'));
  console.log('Portable exe ready:', path.join(distRelease, 'CardianSpriteStudio.exe'));
} else {
  // Fallback: zip the app folder but also copy the main exe to release root for direct download
  const winUnpacked = path.join(appDist, 'win-unpacked');
  if (!fs.existsSync(winUnpacked)) {
    console.error('No Windows build found');
    process.exit(1);
  }
  const mainExe = path.join(winUnpacked, 'CardianSpriteStudio.exe');
  // Use 7z/sfx is hard; ship zip AND document extract.
  // Also try to use electron-builder's portable from existing unpacked via npx.
  run(
    `powershell -NoProfile -Command "Compress-Archive -Path '${winUnpacked}\\*' -DestinationPath '${path.join(distRelease, 'cardian-sprite-studio-windows.zip')}' -Force"`,
  );
  // Copy main exe alone won't work (missing electron deps). Must use portable or full folder.
  console.log('Shipped zip fallback only');
}

// Always also produce zip of unpacked for users who need it
const winUnpacked = path.join(appDist, 'win-unpacked');
if (fs.existsSync(winUnpacked)) {
  const zipPath = path.join(distRelease, 'cardian-sprite-studio-windows.zip');
  if (!fs.existsSync(zipPath)) {
    run(
      `powershell -NoProfile -Command "Compress-Archive -Path '${winUnpacked}\\*' -DestinationPath '${zipPath}' -Force"`,
    );
  }
}

console.log('\nRelease assets:');
for (const f of fs.readdirSync(distRelease)) {
  const p = path.join(distRelease, f);
  if (fs.statSync(p).isFile()) {
    console.log(`  ${f} (${(fs.statSync(p).size / 1024 / 1024).toFixed(1)} MB)`);
  }
}
