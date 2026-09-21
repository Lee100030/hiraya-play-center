const { app, BrowserWindow, Menu, shell } = require('electron');
const path = require('path');

app.disableHardwareAcceleration();
app.commandLine.appendSwitch('disable-gpu');
app.commandLine.appendSwitch('disable-software-rasterizer');

function createWindow() {
  const win = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1100,
    minHeight: 720,
    show: false,
    backgroundColor: '#0B3D2E',
    autoHideMenuBar: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  const devUrl = process.env.VITE_DEV_SERVER_URL || 'http://127.0.0.1:5173';
  if (!app.isPackaged) {
    win.loadURL(devUrl);
  } else {
    win.loadFile(path.join(__dirname, '../dist/index.html'));
  }
  win.once('ready-to-show', () => {
    win.show();
    win.focus();
  });

  Menu.setApplicationMenu(
    Menu.buildFromTemplate([
      {
        label: 'HIRAYA',
        submenu: [
          { role: 'about' },
          { type: 'separator' },
          { role: 'quit' },
        ],
      },
      {
        label: 'View',
        submenu: [{ role: 'reload' }, { role: 'togglefullscreen' }, { role: 'toggleDevTools' }],
      },
      {
        label: 'Help',
        submenu: [
          {
            label: 'Open public website',
            click: () =>
              shell.openExternal(process.env.HIRAYA_PUBLIC_URL || 'https://www.hirayalearningcenter.app'),
          },
        ],
      },
    ]),
  );
}

app.whenReady().then(createWindow);
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
