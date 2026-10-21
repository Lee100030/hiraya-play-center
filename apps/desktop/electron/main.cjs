const { app, BrowserWindow, Menu, shell, protocol, session, net } = require('electron');
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');

app.setName('HIRAYA Desktop');

const APP_ORIGIN = 'hiraya://app';
const PUBLIC_SITE = 'https://hirayakidslearningcenter.com';
const LIVE_API = 'https://hiraya-play-center.onrender.com';
const API_CUSTOM = 'https://api.hirayakidslearningcenter.com';

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

function setHeader(headers, name, value) {
  for (const key of Object.keys(headers)) {
    if (key.toLowerCase() === name.toLowerCase()) delete headers[key];
  }
  headers[name] = Array.isArray(value) ? value : [value];
}

function headerValue(headers, name) {
  if (!headers) return '';
  const wanted = name.toLowerCase();
  for (const key of Object.keys(headers)) {
    if (key.toLowerCase() !== wanted) continue;
    const value = headers[key];
    if (Array.isArray(value)) return value[0] || '';
    return value || '';
  }
  return '';
}

function installApiCors() {
  const urls = [
    `${PUBLIC_SITE}/*`,
    `https://www.hirayakidslearningcenter.com/*`,
    `${LIVE_API}/*`,
    `${API_CUSTOM}/*`,
  ];
  const origins = new Map();

  session.defaultSession.webRequest.onBeforeSendHeaders({ urls }, (details, callback) => {
    const headers = details.requestHeaders || {};
    const origin = headerValue(headers, 'origin');
    if (origin) origins.set(details.id, origin);
    callback({ requestHeaders: headers });
  });

  const forget = (details) => origins.delete(details.id);
  session.defaultSession.webRequest.onCompleted({ urls }, forget);
  session.defaultSession.webRequest.onErrorOccurred({ urls }, forget);

  session.defaultSession.webRequest.onHeadersReceived({ urls }, (details, callback) => {
    const origin = origins.get(details.id) || '';
    origins.delete(details.id);
    // The local window is http://127.0.0.1:5173. The live API already allows that
    // with Access-Control-Allow-Origin: *. Replacing it with hiraya://app makes
    // Chromium drop sign-in, which the login screen reports as port 5188.
    // Only the packaged hiraya://app window needs the custom-scheme origin.
    const packagedPage = origin === APP_ORIGIN || (!origin && app.isPackaged);
    if (!packagedPage) {
      callback({ responseHeaders: details.responseHeaders });
      return;
    }
    const responseHeaders = { ...(details.responseHeaders || {}) };
    // Render sends Access-Control-Allow-Origin: *. A second hiraya://app value
    // makes Chromium fail the request, so replace the header instead of adding one.
    // Sign-in is a POST and needs a successful preflight. A non-2xx OPTIONS
    // response is what made 1.0.6 report the center as online while blocking login.
    setHeader(responseHeaders, 'Access-Control-Allow-Origin', APP_ORIGIN);
    setHeader(responseHeaders, 'Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
    setHeader(responseHeaders, 'Access-Control-Allow-Headers', 'Content-Type, X-Hiraya-Session, X-Hiraya-Client');
    setHeader(responseHeaders, 'Access-Control-Max-Age', '600');
    if (details.method === 'OPTIONS') {
      callback({ responseHeaders, statusLine: 'HTTP/1.1 204 No Content' });
      return;
    }
    callback({ responseHeaders });
  });
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
