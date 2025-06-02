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

// Here you can add more handlers for modules (recon, scan, etc.)
// Example (uncomment and write implementation as needed)
// ipcMain.handle('run-amass', async (event, params) => { /* ... */ });
