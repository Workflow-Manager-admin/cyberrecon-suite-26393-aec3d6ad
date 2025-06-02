const { contextBridge, ipcRenderer } = require('electron');

/**
 * PUBLIC_INTERFACE
 * Secure bridge exposing IPC API for the renderer (React) app.
 * Only documented and whitelisted methods are available in window.electronAPI.
 */
contextBridge.exposeInMainWorld('electronAPI', {
  /**
   * Example: Ping-pong test.
   * Usage in React: window.electronAPI.ping()
   * @returns {Promise<string>} 'pong'
   */
  ping: () => ipcRenderer.invoke('ping'),

  /**
   * PUBLIC_INTERFACE
   * Run a whitelisted CLI tool and get its output.
   * Usage: window.electronAPI.runCliCommand({command: 'echo', args: ['hello']})
   * Returns: Promise<{stdout, stderr, code, error}>
   *
   * This only supports commands allowed in main.js (see allowedCommands[]).
   * Extend with module-specific wrappers as needed (see below).
   */
  runCliCommand: (params) => ipcRenderer.invoke('run-cli-command', params),

  // Template for adding secure backend methods for modules (recon, scan, etc)
  // Example:
  // runAmass: (params) => ipcRenderer.invoke('run-amass', params),

  /**
   * HOW TO ADD A MODULE-SPECIFIC BRIDGE EXAMPLE
   * ------------------------------------------
   * To call Amass from renderer:
   * 1. Add an ipcMain.handle('run-amass', async ...) in main.js,
   * 2. Add runAmass: (params) => ipcRenderer.invoke('run-amass', params) here.
   * 3. Use: window.electronAPI.runAmass({ ...params });
   */
});

// Optionally, expose theme info for dark mode support
contextBridge.exposeInMainWorld('theme', {
  // Placeholder: Extend with theme change listeners if needed
  isDark: true
});
