const { contextBridge, ipcRenderer } = require('electron');

// PUBLIC_INTERFACE
contextBridge.exposeInMainWorld('electronAPI', {
  /**
   * Example: Ping-pong test
   * Usage in React: window.electronAPI.ping()
   * @returns {Promise<string>} 'pong'
   */
  ping: () => ipcRenderer.invoke('ping'),

  // Template for adding secure backend methods for modules (recon, scan, etc)
  // Example:
  // runAmass: (params) => ipcRenderer.invoke('run-amass', params),
});

// Optionally, expose theme info for dark mode support
contextBridge.exposeInMainWorld('theme', {
  // Placeholder: Extend with theme change listeners if needed
  isDark: true
});
