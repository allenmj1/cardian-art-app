const { app, BrowserWindow, shell, Menu, nativeImage } = require('electron');
const path = require('node:path');

const STUDIO_URL = process.env.CARDIAN_STUDIO_URL || 'https://playcardian.com/art-studio/app';
const isDev = !app.isPackaged;
const iconPath = path.join(__dirname, 'assets', 'icon.png');
const appIcon = nativeImage.createFromPath(iconPath);

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

  // Cardian-branded minimal menu
  const menu = Menu.buildFromTemplate([
    {
      label: 'Card Art Studio',
      submenu: [
        {
          label: 'Card Art Studio',
          click: () => win.loadURL(STUDIO_URL),
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

  // Open external links in the system browser (keep auth/studio in-app)
  win.webContents.setWindowOpenHandler(({ url }) => {
    try {
      const u = new URL(url);
      const allowed = u.hostname === 'playcardian.com' || u.hostname === 'www.playcardian.com'
        || u.hostname.endsWith('.supabase.co');
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
