const { app, BrowserWindow, shell, Menu, nativeImage, ipcMain } = require('electron');
const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');
const { spawn } = require('node:child_process');

const STUDIO_URL = process.env.CARDIAN_STUDIO_URL || 'https://playcardian.com/art-studio/app';
const GITHUB_REPO = 'allenmj1/cardian-art-app';
const UPDATE_ASSET = 'CardianSpriteStudio.exe';
const isDev = !app.isPackaged;
const iconPath = path.join(__dirname, 'assets', 'icon.png');
const appIcon = nativeImage.createFromPath(iconPath);

function parseVersion(v) {
  return String(v)
    .replace(/^v/i, '')
    .split(/[.+-]/)
    .filter(Boolean)
    .map((n) => parseInt(n, 10) || 0);
}

function isNewerVersion(latest, current) {
  const a = parseVersion(latest);
  const b = parseVersion(current);
  const len = Math.max(a.length, b.length);
  for (let i = 0; i < len; i++) {
    const x = a[i] || 0;
    const y = b[i] || 0;
    if (x > y) return true;
    if (x < y) return false;
  }
  return false;
}

async function checkForUpdate() {
  const currentVersion = app.getVersion();
  if (!app.isPackaged) {
    return { updateAvailable: false, currentVersion, latestVersion: currentVersion };
  }

  const res = await fetch(`https://api.github.com/repos/${GITHUB_REPO}/releases/latest`, {
    headers: { 'User-Agent': 'CardianCardArtStudio' },
  });
  if (!res.ok) {
    throw new Error('Could not check for updates');
  }

  const release = await res.json();
  const latestVersion = String(release.tag_name || '').replace(/^v/i, '');
  const asset = (release.assets || []).find((a) => a.name === UPDATE_ASSET);
  if (!asset?.browser_download_url) {
    return { updateAvailable: false, currentVersion, latestVersion };
  }

  return {
    updateAvailable: isNewerVersion(latestVersion, currentVersion),
    currentVersion,
    latestVersion,
    downloadUrl: asset.browser_download_url,
  };
}

async function downloadAndInstallUpdate(downloadUrl) {
  if (!downloadUrl || typeof downloadUrl !== 'string') {
    throw new Error('Missing download URL');
  }

  const dest = path.join(os.tmpdir(), `CardianSpriteStudio-update-${Date.now()}.exe`);
  const res = await fetch(downloadUrl, {
    headers: { 'User-Agent': 'CardianCardArtStudio' },
    redirect: 'follow',
  });
  if (!res.ok) {
    throw new Error(`Download failed (${res.status})`);
  }

  const buffer = Buffer.from(await res.arrayBuffer());
  if (buffer.length < 1_000_000) {
    throw new Error('Downloaded file looks incomplete');
  }
  fs.writeFileSync(dest, buffer);

  // Wait for this process to exit, then launch the new build.
  // Spawning immediately can fail on Windows while the old portable is still running.
  if (process.platform === 'win32') {
    const batPath = path.join(os.tmpdir(), `cardian-art-studio-relaunch-${Date.now()}.cmd`);
    const bat = [
      '@echo off',
      'setlocal',
      // Give the current app time to fully quit and release file locks.
      'timeout /t 2 /nobreak >nul',
      `start "" "${dest.replace(/"/g, '""')}"`,
      // Remove this helper script.
      'del "%~f0"',
      '',
    ].join('\r\n');
    fs.writeFileSync(batPath, bat, 'utf8');
    const helper = spawn('cmd.exe', ['/c', batPath], {
      detached: true,
      stdio: 'ignore',
      windowsHide: true,
    });
    helper.unref();
  } else {
    const helper = spawn(dest, [], {
      detached: true,
      stdio: 'ignore',
    });
    helper.unref();
  }

  // Quit after the relaunch helper is running.
  setTimeout(() => {
    app.exit(0);
  }, 200);

  return { ok: true, path: dest };
}

ipcMain.handle('desktop:getVersion', () => app.getVersion());
ipcMain.handle('desktop:checkUpdate', async () => checkForUpdate());
ipcMain.handle('desktop:installUpdate', async (_event, downloadUrl) => {
  return downloadAndInstallUpdate(downloadUrl);
});

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 900,
    minHeight: 640,
    title: 'Cardian Card Art Studio',
    backgroundColor: '#030712',
    autoHideMenuBar: true,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
    icon: appIcon.isEmpty() ? iconPath : appIcon,
  });

  if (process.platform === 'darwin' && !appIcon.isEmpty()) {
    app.dock?.setIcon(appIcon);
  }

  win.once('ready-to-show', () => win.show());

  const menu = Menu.buildFromTemplate([
    {
      label: 'Card Art Studio',
      submenu: [
        {
          label: 'Card Art Studio',
          click: () => win.loadURL(STUDIO_URL),
        },
        {
          label: 'Check for updates',
          click: async () => {
            try {
              const info = await checkForUpdate();
              win.webContents.send('desktop:update-status', info);
            } catch (err) {
              win.webContents.send('desktop:update-status', {
                updateAvailable: false,
                error: err instanceof Error ? err.message : 'Update check failed',
              });
            }
          },
        },
        { type: 'separator' },
        { role: 'reload' },
        { role: 'toggleDevTools', visible: isDev },
        { type: 'separator' },
        { role: 'quit' },
      ],
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' },
      ],
    },
    {
      label: 'View',
      submenu: [
        { role: 'togglefullscreen' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { role: 'resetZoom' },
      ],
    },
  ]);
  Menu.setApplicationMenu(menu);

  win.webContents.setWindowOpenHandler(({ url }) => {
    try {
      const u = new URL(url);
      const allowed =
        u.hostname === 'playcardian.com' ||
        u.hostname === 'www.playcardian.com' ||
        u.hostname.endsWith('.supabase.co');
      if (allowed) {
        return { action: 'allow' };
      }
    } catch {
      // fall through
    }
    shell.openExternal(url);
    return { action: 'deny' };
  });

  win.loadURL(STUDIO_URL);
}

app.whenReady().then(() => {
  if (process.platform === 'win32') {
    app.setAppUserModelId('com.playcardian.sprite-studio');
  }
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
