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
  ping: () => {
    try {
      if (!ipcRenderer) throw new Error("IPC not available");
      return ipcRenderer.invoke('ping');
    } catch (err) {
      return Promise.resolve("pong (bridge error)");
    }
  },

  // --- CLI/Scanner/Settings IPC ---
  runCliCommand: (params) => {
    try {
      if (!ipcRenderer) throw new Error("IPC not available");
      return ipcRenderer.invoke('run-cli-command', params);
    } catch (err) {
      return Promise.resolve({ stdout: "", stderr: "IPC bridge unavailable", code: 1, error: "Electron bridge unavailable" });
    }
  },
  runMasscan: (params) => {
    try {
      if (!ipcRenderer) throw new Error("IPC not available");
      return ipcRenderer.invoke('run-masscan', params);
    } catch (err) {
      return Promise.resolve({ stdout: "", stderr: "IPC bridge unavailable", code: 1, error: "Electron bridge unavailable" });
    }
  },
  runNuclei: (params) => {
    try {
      if (!ipcRenderer) throw new Error("IPC not available");
      return ipcRenderer.invoke('run-nuclei', params);
    } catch (err) {
      return Promise.resolve({ stdout: "", stderr: "IPC bridge unavailable", code: 1, error: "Electron bridge unavailable" });
    }
  },
  dbSaveSession: (session) => {
    try {
      if (!ipcRenderer) throw new Error("IPC not available");
      return ipcRenderer.invoke('db-save-session', session);
    } catch (err) {
      return Promise.resolve({ success: false, error: "Electron session API unavailable" });
    }
  },
  dbGetSessions: (opts) => {
    try {
      if (!ipcRenderer) throw new Error("IPC not available");
      return ipcRenderer.invoke('db-get-sessions', opts);
    } catch (err) {
      return Promise.resolve({ success: false, error: "Electron session API unavailable" });
    }
  },
  getSettings: () => {
    try {
      if (!ipcRenderer) throw new Error("IPC not available");
      return ipcRenderer.invoke('get-settings');
    } catch (err) {
      return Promise.resolve({ success: true, apiKeys: { amass: "", nuclei: "", hackerone: "", bugcrowd: "", intigriti: "" } });
    }
  },
  saveSettings: (settings) => {
    try {
      if (!ipcRenderer) throw new Error("IPC not available");
      return ipcRenderer.invoke('save-settings', settings);
    } catch (err) {
      return Promise.resolve({ success: false, error: "Electron settings API unavailable" });
    }
  },

  // PUBLIC_INTERFACE
  // Exploitation Toolkit Proxy IPC handlers - robust error guarding
  /**
   * Starts the proxy server for exploitation (returns {ok,port,error?})
   * Usage: window.electronAPI.proxyStart({target,port})
   */
  proxyStart: (params) => {
    try {
      if (!ipcRenderer) throw new Error("IPC not available");
      return ipcRenderer.invoke('proxy-start', params);
    } catch (err) {
      return Promise.resolve({ ok: false, port: 0, error: "Proxy API bridge unavailable or Electron required" });
    }
  },
  /**
   * Stops the proxy server ({ok,error?})
   */
  proxyStop: () => {
    try {
      if (!ipcRenderer) throw new Error("IPC not available");
      return ipcRenderer.invoke('proxy-stop');
    } catch (err) {
      return Promise.resolve({ ok: false, error: "Proxy API bridge unavailable or Electron required" });
    }
  },
  /**
   * Get the current proxy session timeline as array of {id, ts, reqRaw, resRaw, ...}
   */
  proxyGetSessions: () => {
    try {
      if (!ipcRenderer) throw new Error("IPC not available");
      return ipcRenderer.invoke('proxy-get-sessions');
    } catch (err) {
      return Promise.resolve({ ok: false, timeline: [], error: "Proxy API bridge unavailable or Electron required" });
    }
  },
  /**
   * Replay previous request (optionally modified req string); returns {ok,resRaw,reqRaw,error?}
   */
  proxyReplayRequest: (params) => {
    try {
      if (!ipcRenderer) throw new Error("IPC not available");
      return ipcRenderer.invoke('proxy-replay-request', params);
    } catch (err) {
      return Promise.resolve({ ok: false, resRaw: "", reqRaw: "", error: "Proxy API bridge unavailable or Electron required" });
    }
  },
  /**
   * Clear proxy session history (for UI)
   */
  proxyClearSessions: () => {
    try {
      if (!ipcRenderer) throw new Error("IPC not available");
      return ipcRenderer.invoke('proxy-clear-sessions');
    } catch (err) {
      return Promise.resolve({ ok: false, error: "Proxy API bridge unavailable or Electron required" });
    }
  },
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
