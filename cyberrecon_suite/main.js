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

// PUBLIC_INTERFACE
// IPC skeleton (securely handle channels in preload.js)
ipcMain.handle('ping', async (_event, ...args) => {
  return 'pong';
});

// Here you can add more handlers for modules (recon, scan, etc.)
// Example (uncomment and write implementation as needed)
// ipcMain.handle('run-amass', async (event, params) => { /* ... */ });
