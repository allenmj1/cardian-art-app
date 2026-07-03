// Reserved for future native bridges. Studio UI runs on playcardian.com.
const { contextBridge } = require('electron');

contextBridge.exposeInMainWorld('cardianDesktop', {
  isDesktopApp: true,
  platform: process.platform,
});
