const { app, BrowserWindow, Menu, shell } = require('electron');
const fs = require('fs');
const path = require('path');

app.setName('HIRAYA Desktop');

function resolveIcon() {
  const ico = path.join(__dirname, '../build/icon.ico');
  const png = path.join(__dirname, '../public/images/hiraya-crest.png');
  if (fs.existsSync(ico)) return ico;
  if (fs.existsSync(png)) return png;
  return undefined;
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 900,
    minHeight: 680,
    title: 'HIRAYA | Desktop',
    icon: resolveIcon(),
    backgroundColor: '#07140D',
    autoHideMenuBar: true,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  const distIndex = path.join(__dirname, '../dist/index.html');
  const forceDist = process.env.HIRAYA_USE_DIST === '1';
  const devUrl = process.env.VITE_DEV_SERVER_URL || 'http://127.0.0.1:5173';
  win.once('ready-to-show', () => win.show());

  if (app.isPackaged || forceDist) {
    win.loadFile(distIndex);
  } else {
    win.loadURL(devUrl);
  }

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
            click: () => shell.openExternal('http://127.0.0.1:3000'),
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
