const { contextBridge } = require('electron');

contextBridge.exposeInMainWorld('hirayaDesktop', {
  platform: process.platform,
  isDesktop: true,
});
