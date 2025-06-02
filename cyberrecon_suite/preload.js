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

  /**
   * PUBLIC_INTERFACE
   * Run Masscan from the renderer (secure, arg-sanitized).
   * Usage: window.electronAPI.runMasscan({ args: [...] })
   * Returns: Promise<{stdout, stderr, code, error}>
   */
  runMasscan: (params) => ipcRenderer.invoke('run-masscan', params),

  /**
   * PUBLIC_INTERFACE
   * Run Nuclei from the renderer (secure, arg-sanitized).
   * Usage: window.electronAPI.runNuclei({ args: [...] })
   * Returns: Promise<{stdout, stderr, code, error}>
   */
  runNuclei: (params) => ipcRenderer.invoke('run-nuclei', params),

  // Template for adding secure backend methods for modules (recon, scan, etc)
  // Example:
  // runAmass: (params) => ipcRenderer.invoke('run-amass', params),

  /**
   * PUBLIC_INTERFACE
   * Insert a session/scan record (for sessions of kind 'recon' or 'scan').
   * Usage: window.electronAPI.dbSaveSession({type: "scan"|"recon", label, data}); returns {success, id} or {success: false, error}
   */
  dbSaveSession: (session) => ipcRenderer.invoke('db-save-session', session),
  /**
   * PUBLIC_INTERFACE
   * Retrieve saved recon/scan session records.
   * Usage: window.electronAPI.dbGetSessions({type?, limit?}); returns {success, sessions} or {success: false, error}
   */
  dbGetSessions: (opts) => ipcRenderer.invoke('db-get-sessions', opts),

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
