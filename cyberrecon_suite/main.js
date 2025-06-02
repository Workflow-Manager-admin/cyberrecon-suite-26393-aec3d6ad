const { app, BrowserWindow, ipcMain, nativeTheme } = require('electron');
const path = require('path');
const { exec } = require('child_process'); // To run CLI commands securely

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

// Electron app event hooks
app.whenReady().then(createWindow);

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

// Here you can add more handlers for modules (recon, scan, etc.)
// Example (uncomment and write implementation as needed)
// ipcMain.handle('run-amass', async (event, params) => { /* ... */ });
