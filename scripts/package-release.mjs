/**
 * Build Cardian Sprite Studio desktop app (Electron).
 * Download → run → sign in inside the UI.
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
run('npx electron-builder --win dir --x64', appDir);

try {
  run('npx electron-builder --linux AppImage --x64', appDir);
} catch {
  console.warn('Linux AppImage build skipped.');
}

const winUnpacked = path.join(appDist, 'win-unpacked');
if (!fs.existsSync(winUnpacked)) {
  console.error('Missing win-unpacked. Dist:', fs.existsSync(appDist) ? fs.readdirSync(appDist) : 'none');
  process.exit(1);
}

fs.writeFileSync(
  path.join(winUnpacked, 'README.txt'),
  `Cardian Sprite Studio
=====================

1. Double-click CardianSpriteStudio.exe
2. Sign in with your Cardian account in the app window
3. Open the editor, draw, Save or Publish

https://playcardian.com/art-studio
`,
  'utf8',
);

const winZip = path.join(distRelease, 'cardian-sprite-studio-windows.zip');
run(
  `powershell -NoProfile -Command "Compress-Archive -Path '${winUnpacked}\\*' -DestinationPath '${winZip}' -Force"`,
);

const linuxApp = fs.existsSync(appDist)
  ? fs.readdirSync(appDist).find((n) => n.endsWith('.AppImage'))
  : null;
if (linuxApp) {
  const linStage = path.join(distRelease, 'linux-stage');
  fs.mkdirSync(linStage, { recursive: true });
  fs.copyFileSync(path.join(appDist, linuxApp), path.join(linStage, 'CardianSpriteStudio.AppImage'));
  fs.writeFileSync(
    path.join(linStage, 'README.txt'),
    `Cardian Sprite Studio
=====================

1. chmod +x CardianSpriteStudio.AppImage && ./CardianSpriteStudio.AppImage
2. Sign in with your Cardian account in the app window

https://playcardian.com/art-studio
`,
    'utf8',
  );
  run(
    `powershell -NoProfile -Command "Compress-Archive -Path '${linStage}\\*' -DestinationPath '${path.join(distRelease, 'cardian-sprite-studio-linux-x64.zip')}' -Force"`,
  );
}

console.log('\nRelease assets:');
for (const f of fs.readdirSync(distRelease)) {
  const p = path.join(distRelease, f);
  if (fs.statSync(p).isFile()) {
    console.log(`  ${f} (${(fs.statSync(p).size / 1024 / 1024).toFixed(1)} MB)`);
  }
}
