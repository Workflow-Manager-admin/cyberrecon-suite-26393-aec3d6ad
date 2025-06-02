const { app, BrowserWindow, ipcMain, nativeTheme } = require('electron');
const path = require('path');
const { exec } = require('child_process'); // To run CLI commands securely

// Initialize database abstraction
const db = require('./electron-utils/db.js');

// PUBLIC_INTERFACE
function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 1000,
    minHeight: 700,
    backgroundColor: '#181a20',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      enableRemoteModule: false,
      sandbox: true
    },
    show: false // Wait for content to show for a smooth appearance
  });

  // Load React app build or dev server depending on environment
  if (process.env.NODE_ENV === 'development') {
    win.loadURL('http://localhost:3000/');
  } else {
    win.loadFile(path.join(__dirname, 'build', 'index.html'));
  }

  win.once('ready-to-show', () => {
    win.show();
  });

  // Optionally: set theme according to system (for dark/light theme handling)
  nativeTheme.themeSource = 'dark';

  // Handle window closed
  win.on('closed', () => {
    // Dereference window object
  });
}

/** 
 * Persistent DB init (called before window launch)
 */
async function initializeAppWithDB() {
  try {
    await db.initialize();
    console.log(`[CyberReconSuite] DB initialized with: ${db.dbType}`);
  } catch (err) {
    console.error('[CyberReconSuite] Failed to init DB:', err);
  }
  createWindow();
}

/** 
 * Proxy server for exploitation toolkit (start/stop, session record, replay, etc)
 * Runs only in Electron main!
 */
const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');
const http = require('http');

let proxyServer = null;
let proxyApp = null;
let proxyPort = 8088; // default, could IPC config later
let proxyTarget = ''; // will forward all traffic unless set
let proxySessions = []; // Array of {id, ts, reqRaw, resRaw, meta, replayable}
let lastProxySessionId = 0;

/**
 * Start the proxy server if not already running
 * @returns {Promise<{ok: boolean, port: number, error?: string}>}
 */
// PUBLIC_INTERFACE for IPC
async function startProxyServer({ target = '', port } = {}) {
  if (proxyServer) return { ok: false, error: 'Proxy already running', port: proxyPort };
  try {
    proxyTarget = target || '';
    proxyPort = port || 8088;
    proxySessions = [];
    lastProxySessionId = 0;

    proxyApp = express();

    // Simple body parser for POST, PUT, etc
    proxyApp.use(express.raw({ type: '*/*', limit: '10mb' }));

    proxyApp.use('*', createProxyMiddleware({
      target: proxyTarget || 'http://example.com', // dummy if unused, will be overridden per req if target param
      changeOrigin: true,
      selfHandleResponse: true,
      logLevel: 'silent',
      /**
       * Modify the proxy request (for replay/target override).
       */
      onProxyReq: (proxyReq, req, res) => {
        let rawBody = req.body;
        if (Buffer.isBuffer(rawBody) && rawBody.length > 0) {
          proxyReq.setHeader('content-length', rawBody.length);
          proxyReq.write(rawBody);
        }
      },
      /**
       * Capture proxied response, log both request/response, return to client.
       */
      onProxyRes: async (proxyRes, req, res) => {
        try {
          let reqRaw = '';
          try {
            reqRaw = `${req.method} ${req.originalUrl} HTTP/${req.httpVersion}\n`;
            Object.entries(req.headers).forEach(([k, v]) => {
              reqRaw += `${k}: ${v}\n`;
            });
            reqRaw += '\n';
            if (req.body && Buffer.isBuffer(req.body)) {
              reqRaw += req.body.toString('utf8');
            }
          } catch {}

          let resRaw = '';
          try {
            resRaw = `HTTP/${proxyRes.httpVersion} ${proxyRes.statusCode} ${proxyRes.statusMessage}\n`;
            Object.entries(proxyRes.headers).forEach(([k, v]) => {
              resRaw += `${k}: ${v}\n`;
            });
            resRaw += '\n';
          } catch {}

          // Pipe response to buffer
          let chunks = [];
          proxyRes.on('data', chunk => chunks.push(chunk));
          proxyRes.on('end', () => {
            let body = Buffer.concat(chunks).toString('utf8');
            resRaw += body;

            // Push new session object
            const sess = {
              id: (++lastProxySessionId),
              ts: new Date().toISOString(),
              reqRaw, resRaw,
              reqMeta: {
                method: req.method,
                url: req.originalUrl,
                headers: req.headers,
              },
              resMeta: {
                status: proxyRes.statusCode,
                headers: proxyRes.headers,
              },
              replayable: true
            };
            proxySessions.unshift(sess);
            // Only keep last 128 for memory
            if (proxySessions.length > 128) proxySessions.length = 128;

            // Write response to client
            try {
              res.status(proxyRes.statusCode);
              Object.entries(proxyRes.headers).forEach(([k, v]) => {
                res.setHeader(k, v);
              });
              res.send(body);
            } catch (e) {
              res.status(500).send('Proxy internal error');
            }

            // Optionally: send IPC event/notification
            if (BrowserWindow.getAllWindows().length) {
              BrowserWindow.getAllWindows().forEach(win => {
                win.webContents.send('proxy-session-added', { id: sess.id, ...sess });
              });
            }
          });
        } catch (err) {
          res.status(500).send('Proxy session error');
        }
      }
    }));

    proxyServer = http.createServer(proxyApp);
    await new Promise((resolve, reject) => {
      proxyServer.listen(proxyPort, () => resolve());
      proxyServer.on('error', reject);
    });

    return { ok: true, port: proxyPort };
  } catch (err) {
    proxyServer = null;
    proxyApp = null;
    return { ok: false, error: String(err), port: proxyPort };
  }
}

/**
 * Stop proxy server.
 * @returns {Promise<{ok: boolean, error?: string}>}
 */
// PUBLIC_INTERFACE for IPC
async function stopProxyServer() {
  if (!proxyServer) return { ok: false, error: 'Proxy not running' };
  try {
    await new Promise((resolve, reject) => {
      proxyServer.close(err => (err ? reject(err) : resolve()));
    });
    proxyServer = null;
    proxyApp = null;
    return { ok: true };
  } catch (err) {
    return { ok: false, error: String(err) };
  }
}

/**
 * Fetch proxy session timeline.
 * @returns {Promise<{ok: true, timeline: Array}>}
 */
function getProxySessions() {
  return { ok: true, timeline: proxySessions };
}

/**
 * Replay and optionally modify a proxy session request by session id and request string.
 * @param {number} id - Session id
 * @param {string} newRequest - Raw HTTP request to replay
 * @returns {Promise<{ok: boolean, resRaw: string, reqRaw: string, error?: string}>}
 */
// PUBLIC_INTERFACE for IPC
async function replayProxyRequest({ sessionId, newRequest }) {
  // Parse raw HTTP and fire upstream (poor man's implementation)
  // For full-fidelity use, parse the text HTTP request; here, just forward as is.
  try {
    const session = proxySessions.find(sess => sess.id === sessionId);
    if (!session) return { ok: false, error: 'Session not found' };
    // Parse first line
    const lines = (newRequest || session.reqRaw).split(/\r?\n/);
    const [method, url] = lines[0].split(' ');
    let headers = {};
    let body = '';
    let inBody = false;
    for (let i = 1; i < lines.length; ++i) {
      if (!inBody && lines[i].trim() === '') { inBody = true; continue; }
      if (!inBody) {
        const idx = lines[i].indexOf(':');
        if (idx > 0) {
          let h = lines[i].slice(0, idx).trim().toLowerCase();
          let v = lines[i].slice(idx + 1).trim();
          headers[h] = v;
        }
      } else {
        body += lines[i] + '\n';
      }
    }

    // Replay by sending HTTP request to target
    return await new Promise((resolve) => {
      const reqOpts = {
        method,
        headers,
      };
      // Target host: header, or use session original target, or last known
      let targetHost = headers['host'] || proxyTarget.replace(/^https?:\/\//, '') || '';
      let tgt = (proxyTarget ? proxyTarget : 'http://' + targetHost);
      const reqLib = tgt.startsWith('https://') ? require('https') : require('http');
      const fullUrl = tgt + url;
      const reqObj = reqLib.request(fullUrl, reqOpts, (res) => {
        let resp = '';
        res.on('data', chunk => resp += chunk);
        res.on('end', () => {
          const resRaw = `HTTP/${res.httpVersion} ${res.statusCode} ${res.statusMessage}\n` +
            Object.entries(res.headers).map(([k, v]) => `${k}: ${v}`).join('\n') + '\n\n' +
            resp;
          resolve({ ok: true, resRaw, reqRaw: newRequest || session.reqRaw });
        });
      });
      reqObj.on('error', (err) => {
        resolve({ ok: false, error: String(err) });
      });
      if (body.trim()) reqObj.write(body);
      reqObj.end();
    });
  } catch (err) {
    return { ok: false, error: String(err) };
  }
}

// IPC HANDLERS FOR PROXY SERVER

ipcMain.handle('proxy-start', async (_event, params) => {
  return await startProxyServer(params);
});
ipcMain.handle('proxy-stop', async (_event) => {
  return await stopProxyServer();
});
ipcMain.handle('proxy-get-sessions', async () => {
  return getProxySessions();
});
ipcMain.handle('proxy-replay-request', async (_event, params) => {
  return await replayProxyRequest(params);
});
ipcMain.handle('proxy-clear-sessions', async () => {
  proxySessions = [];
  lastProxySessionId = 0;
  return { ok: true };
});


// Electron app event hooks
app.whenReady().then(initializeAppWithDB);

app.on('window-all-closed', () => {
  // On macOS, apps generally stay active until explicit quit
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  // On macOS, recreate the window if the dock icon is clicked and there are no windows
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

/**
 * PUBLIC_INTERFACE
 * IPC skeleton (securely handle channels in preload.js)
 */

// Simple ping for diagnostics
ipcMain.handle('ping', async (_event, ...args) => {
  return 'pong';
});

/**
 * PUBLIC_INTERFACE
 * IPC handler for running generic CLI commands.
 * Expects: { command: string, args?: string[] }
 * Only allows certain commands (extend allowedCommands as needed for safety).
 * Returns: { stdout, stderr, code }
 */
const allowedCommands = ['echo', 'masscan', 'nuclei']; // extended with safe/expected CLI commands

ipcMain.handle('run-cli-command', async (_event, params) => {
  try {
    if (!params || typeof params.command !== 'string') {
      throw new Error("Invalid parameters");
    }

    // Only allow commands explicitly whitelisted
    const target = params.command.trim().toLowerCase();
    if (!allowedCommands.includes(target)) {
      return { error: 'Command not allowed', code: 403 };
    }

    // Sanitize arguments
    const args = Array.isArray(params.args)
      ? params.args.filter(arg => typeof arg === 'string')
      : [];
    const cmdline = [params.command, ...args.map(escapeShellArg)].join(' ');

    return new Promise((resolve) => {
      exec(cmdline, { timeout: 30000, maxBuffer: 1024 * 200 }, (error, stdout, stderr) => {
        resolve({
          stdout,
          stderr,
          code: error ? (error.code || 1) : 0,
          error: error ? error.message : null
        });
      });
    });
  } catch (err) {
    return { error: String(err), code: 500, stdout: '', stderr: '' };
  }
});

/**
 * PUBLIC_INTERFACE
 * IPC handler for running Masscan securely.
 * Expects: { args?: string[] }
 * Only runs masscan, returns: { stdout, stderr, code, error }
 */
ipcMain.handle('run-masscan', async (_event, params) => {
  try {
    // Validate input
    const args = Array.isArray(params?.args)
      ? params.args.filter(arg => typeof arg === 'string')
      : [];
    // For added security, only allow common masscan params, expand as required
    // Optionally, add restrictive validation of flags here if necessary
    const cmdline = ['masscan', ...args.map(escapeShellArg)].join(' ');
    return await execPromise(cmdline, 120000); // up to 2 min for large scan
  } catch (err) {
    return { error: String(err), code: 500, stdout: '', stderr: '' };
  }
});

/**
 * PUBLIC_INTERFACE
 * IPC handler for running Nuclei securely.
 * Expects: { args?: string[] }
 * Only runs nuclei, returns: { stdout, stderr, code, error }
 */
ipcMain.handle('run-nuclei', async (_event, params) => {
  try {
    // Validate input
    const args = Array.isArray(params?.args)
      ? params.args.filter(arg => typeof arg === 'string')
      : [];
    // Optionally: only allow --target, --template, etc. by flag validation
    const cmdline = ['nuclei', ...args.map(escapeShellArg)].join(' ');
    return await execPromise(cmdline, 120000);
  } catch (err) {
    return { error: String(err), code: 500, stdout: '', stderr: '' };
  }
});

/**
 * Helper: Sanitize/shell-escape argument for CLI
 * Minimal, cross-platform (no, or few meta-chars allowed), prevents injection
 */
function escapeShellArg(arg) {
  // Windows: wrap with double quotes, escape inner quotes.
  if (process.platform === 'win32') {
    return `"${String(arg).replace(/(["%])/g, '^$1')}"`;
  }
  // POSIX: wrap with single quotes, escape single inside
  return `'${String(arg).replace(/'/g, `'\\''`)}'`;
}

/**
 * Helper: Promise wrapper for exec, reusable for custom timeout/output size.
 */
function execPromise(cmd, timeoutMs = 30000) {
  return new Promise((resolve) => {
    exec(cmd, { timeout: timeoutMs, maxBuffer: 1024 * 500 }, (error, stdout, stderr) => {
      resolve({
        stdout,
        stderr,
        code: error ? (error.code || 1) : 0,
        error: error ? error.message : null
      });
    });
  });
}

/**
 * PUBLIC_INTERFACE
 * IPC handlers for DB-backed session/scan history (insert and find).
 * Usage from renderer: window.electronAPI.dbInsertSession({type, label, data}), dbGetSessions({type, limit})
 */

// Save new session/scan result
ipcMain.handle('db-insert-session', async (_event, session) => {
  try {
    if (!session || typeof session !== 'object' || !session.type)
      throw new Error('Session object with "type" required');
    const id = await db.insertSession(session);
    return { success: true, id };
  } catch (err) {
    return { success: false, error: String(err) };
  }
});

// Retrieve recon/scan session history
ipcMain.handle('db-get-sessions', async (_event, query = {}) => {
  try {
    const sessions = await db.getSessions(query);
    return { success: true, sessions };
  } catch (err) {
    return { success: false, error: String(err) };
  }
});

/**
 * PUBLIC_INTERFACE
 * Additional IPC handlers for secure database access: db-save-session and db-get-sessions for frontend contextBridge
 * - db-save-session: validates type, label, and data, and inserts sanitized session
 * - db-get-sessions: provides limited filterable queries to renderer safely
 */
ipcMain.handle('db-save-session', async (_event, session) => {
  // Validate session: should be object with {type: string, label?: string, data: object}
  try {
    if (
      !session ||
      typeof session !== 'object' ||
      typeof session.type !== 'string' ||
      !['recon', 'scan'].includes(session.type) ||
      typeof session.data !== 'object'
    ) {
      throw new Error('Invalid session object (type & data required, type=recon|scan)');
    }
    // Label is optional, must be string if present
    if (
      session.label &&
      typeof session.label !== 'string'
    ) throw new Error('Session label must be string if provided');
    // Data: do minimal recursion to ensure serializable
    const safeSession = {
      type: session.type,
      label: session.label ? String(session.label).slice(0, 512) : '',
      data: JSON.parse(JSON.stringify(session.data || {})), // deep copy, strips functions/unsafe refs
    };
    const id = await db.insertSession(safeSession);
    return { success: true, id };
  } catch (err) {
    return { success: false, error: String(err) };
  }
});

ipcMain.handle('db-get-sessions', async (_event, opts = {}) => {
  try {
    // Only allow limit <= 1000, and whitelisted types
    let type = undefined, limit = 100;
    if (typeof opts === 'object') {
      if (opts.type && (opts.type === 'recon' || opts.type === 'scan')) type = opts.type;
      if (typeof opts.limit === 'number' && opts.limit > 0 && opts.limit <= 1000) limit = opts.limit;
    }
    const sessions = await db.getSessions({ type, limit });

    // Serialize result: Each session sanitized to: {id, type, label, started_at, data}
    const safeSessions = Array.isArray(sessions)
      ? sessions.map(s => ({
          id: s.id,
          type: String(s.type),
          label: typeof s.label === 'string' ? s.label : '',
          started_at: s.started_at,
          data: typeof s.data === 'object'
            ? JSON.parse(JSON.stringify(s.data))
            : (typeof s.data === 'string'
                ? (() => { try { return JSON.parse(s.data); } catch { return {}; } })()
                : {}),
        }))
      : [];
    return { success: true, sessions: safeSessions };
  } catch (err) {
    return { success: false, error: String(err) };
  }
});

/**
 * PUBLIC_INTERFACE
 * IPC handlers for global settings (used for API key storage, config, etc).
 * Use db.getSetting / db.setSetting. Only exposes/retrieves keys in a safe dictionary {apiKeys: {...}, ...}.
 */
ipcMain.handle('get-settings', async (_event) => {
  try {
    // Bulk-get all for settings dialog (never log or console sensitive info).
    const settings = await db.getSetting();
    // Shape sensitive keys as { apiKeys: { ... } }
    function safeObj(s) {
      if (!s || typeof s !== 'object') return { apiKeys: {} };
      // Only expose recognized keys, in a namespace
      const apiKeys = {};
      ['amass', 'nuclei', 'hackerone', 'bugcrowd', 'intigriti'].forEach((k) => {
        if (typeof s[`apiKey_${k}`] === 'string') apiKeys[k] = s[`apiKey_${k}`];
      });
      // Optionally merge proxy, plugins, etc, later
      // Return at least API key bundle
      return { apiKeys };
    }
    return { success: true, ...safeObj(settings) };
  } catch (err) {
    return { success: false, error: String(err) };
  }
});

ipcMain.handle('save-settings', async (_event, inputSettings) => {
  try {
    if (!inputSettings || typeof inputSettings !== 'object')
      throw new Error('Invalid settings');
    // Only allow saving API keys for specified platforms
    if (inputSettings.apiKeys && typeof inputSettings.apiKeys === 'object') {
      for (const k of ['amass', 'nuclei', 'hackerone', 'bugcrowd', 'intigriti']) {
        const v = inputSettings.apiKeys[k];
        if (typeof v === 'string')
          await db.setSetting(`apiKey_${k}`, v);
      }
    }
    // Add saving for other settings (proxy/plugins) if desired here
    return { success: true };
  } catch (err) {
    return { success: false, error: String(err) };
  }
});
// Here you can add more handlers for modules (recon, scan, etc.)
// Example (uncomment and write implementation as needed)
// ipcMain.handle('run-amass', async (event, params) => { /* ... */ });
