const { app, BrowserWindow, Menu, shell, protocol, session, net } = require('electron');
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');

app.setName('HIRAYA Desktop');

const APP_ORIGIN = 'hiraya://app';
const PUBLIC_SITE = 'https://www.hirayalearningcenter.app';

protocol.registerSchemesAsPrivileged([
  {
    scheme: 'hiraya',
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      corsEnabled: true,
      stream: true,
    },
  },
]);

function resolveIcon() {
  const ico = path.join(__dirname, '../build/icon.ico');
  const png = path.join(__dirname, '../public/images/hiraya-crest.png');
  if (fs.existsSync(ico)) return ico;
  if (fs.existsSync(png)) return png;
  return undefined;
}

function distFile(requestUrl) {
  let url;
  try {
    url = new URL(requestUrl);
  } catch {
    return null;
  }
  if (url.hostname !== 'app') return null;
  let pathname = '/';
  try {
    pathname = decodeURIComponent(url.pathname || '/');
  } catch {
    return null;
  }
  if (pathname === '/' || pathname.endsWith('/')) pathname += 'index.html';
  const distRoot = path.resolve(__dirname, '../dist');
  const filePath = path.resolve(distRoot, pathname.replace(/^\/+/, ''));
  const fromRoot = path.relative(distRoot, filePath);
  if (fromRoot.startsWith('..') || path.isAbsolute(fromRoot)) return null;
  if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) return null;
  return filePath;
}

function installAppProtocol() {
  protocol.handle('hiraya', (request) => {
    const filePath = distFile(request.url);
    if (!filePath) return new Response('Not found', { status: 404 });
    return net.fetch(pathToFileURL(filePath).toString());
  });
}

function installApiCors() {
  session.defaultSession.webRequest.onHeadersReceived(
    { urls: [`${PUBLIC_SITE}/*`] },
    (details, callback) => {
      const responseHeaders = {
        ...(details.responseHeaders || {}),
        'Access-Control-Allow-Origin': [APP_ORIGIN],
        'Access-Control-Allow-Methods': ['GET, POST, PUT, PATCH, DELETE, OPTIONS'],
        'Access-Control-Allow-Headers': ['Content-Type, X-Hiraya-Session, X-Hiraya-Client'],
        'Access-Control-Max-Age': ['600'],
      };
      if (details.method === 'OPTIONS') {
        callback({ responseHeaders, statusLine: 'HTTP/1.1 204 No Content' });
        return;
      }
      callback({ responseHeaders });
    },
  );
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
      webSecurity: true,
    },
  });

  const forceDist = process.env.HIRAYA_USE_DIST === '1';
  const devUrl = process.env.VITE_DEV_SERVER_URL || 'http://127.0.0.1:5173';
  win.once('ready-to-show', () => win.show());

  if (app.isPackaged || forceDist) {
    win.loadURL(`${APP_ORIGIN}/index.html`);
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
            click: () => shell.openExternal(PUBLIC_SITE),
          },
        ],
      },
    ]),
  );
}

app.whenReady().then(() => {
  installAppProtocol();
  installApiCors();
  createWindow();
});
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
