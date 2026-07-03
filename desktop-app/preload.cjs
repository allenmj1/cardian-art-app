const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('cardianDesktop', {
  isDesktopApp: true,
  platform: process.platform,
  getVersion: () => ipcRenderer.invoke('desktop:getVersion'),
  checkUpdate: () => ipcRenderer.invoke('desktop:checkUpdate'),
  installUpdate: (downloadUrl) => ipcRenderer.invoke('desktop:installUpdate', downloadUrl),
  onUpdateStatus: (callback) => {
    const handler = (_event, info) => callback(info);
    ipcRenderer.on('desktop:update-status', handler);
    return () => ipcRenderer.removeListener('desktop:update-status', handler);
  },
});
