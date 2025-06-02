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

  // ... (previous handlers unchanged)

  runCliCommand: (params) => ipcRenderer.invoke('run-cli-command', params),
  runMasscan: (params) => ipcRenderer.invoke('run-masscan', params),
  runNuclei: (params) => ipcRenderer.invoke('run-nuclei', params),
  dbSaveSession: (session) => ipcRenderer.invoke('db-save-session', session),
  dbGetSessions: (opts) => ipcRenderer.invoke('db-get-sessions', opts),
  getSettings: () => ipcRenderer.invoke('get-settings'),
  saveSettings: (settings) => ipcRenderer.invoke('save-settings', settings),

  // PUBLIC_INTERFACE
  // Exploitation Toolkit Proxy IPC handlers
  /**
   * Starts the proxy server for exploitation (returns {ok,port,error?})
   * Usage: window.electronAPI.proxyStart({target,port})
   */
  proxyStart: (params) => ipcRenderer.invoke('proxy-start', params),
  /**
   * Stops the proxy server ({ok,error?})
   */
  proxyStop: () => ipcRenderer.invoke('proxy-stop'),
  /**
   * Get the current proxy session timeline as array of {id, ts, reqRaw, resRaw, ...}
   */
  proxyGetSessions: () => ipcRenderer.invoke('proxy-get-sessions'),
  /**
   * Replay previous request (optionally modified req string); returns {ok,resRaw,reqRaw,error?}
   */
  proxyReplayRequest: (params) => ipcRenderer.invoke('proxy-replay-request', params),
  /**
   * Clear proxy session history (for UI)
   */
  proxyClearSessions: () => ipcRenderer.invoke('proxy-clear-sessions'),
});

ipcRenderer.on('proxy-session-added', (_event, session) => {
  if (window && window.dispatchEvent) {
    const evt = new CustomEvent('cyberrecon:proxySessionAdded', { detail: session });
    window.dispatchEvent(evt);
  }
});


// Optionally, expose theme info for dark mode support
contextBridge.exposeInMainWorld('theme', {
  // Placeholder: Extend with theme change listeners if needed
  isDark: true
});

// PUBLIC_INTERFACE (important for browser fallback)
// If not running in Electron, define a stub electronAPI for web context
if (typeof window !== "undefined" && !window.electronAPI) {
  // This block only runs if preload was NOT injected (i.e., not Electron, or contextIsolation/browser)
  window.electronAPI = {
    ping: async () => "pong (web fallback)",
    runCliCommand: async () =>
      ({ stdout: "", stderr: "Not available in browser build", code: 1, error: "Electron bridge unavailable" }),
    runMasscan: async () =>
      ({ stdout: "", stderr: "Not available in browser build", code: 1, error: "Electron bridge unavailable" }),
    runNuclei: async () =>
      ({ stdout: "", stderr: "Not available in browser build", code: 1, error: "Electron bridge unavailable" }),
    dbSaveSession: async () =>
      ({ success: false, error: "Electron session API unavailable (web)" }),
    dbGetSessions: async () =>
      ({ success: false, error: "Electron session API unavailable (web)" }),
    getSettings: async () =>
      ({ success: true, apiKeys: { amass: "", nuclei: "", hackerone: "", bugcrowd: "", intigriti: "" } }),
    saveSettings: async () =>
      ({ success: false, error: "Electron settings API unavailable (web)" }),

    // --- Proxy/exploitation module APIs (stubs for browser context) ---
    proxyStart: async () =>
      ({ ok: false, port: 0, error: "Proxy API unavailable in browser build (Electron required)" }),
    proxyStop: async () =>
      ({ ok: false, error: "Proxy API unavailable in browser build (Electron required)" }),
    proxyGetSessions: async () =>
      ({ ok: false, timeline: [], error: "Proxy API unavailable in browser build (Electron required)" }),
    proxyReplayRequest: async () =>
      ({ ok: false, resRaw: "", reqRaw: "", error: "Proxy API unavailable in browser build (Electron required)" }),
    proxyClearSessions: async () =>
      ({ ok: false, error: "Proxy API unavailable in browser build (Electron required)" }),
    // Any more future API additions here...
  };
  window.theme = window.theme || { isDark: true };
}
