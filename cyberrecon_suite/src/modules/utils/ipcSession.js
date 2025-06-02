//
// PUBLIC_INTERFACE
// Secure frontend utilities for session history (save/load) via Electron IPC.
// All argument validation is backend-enforced. Returns { success, id } / { success, sessions }.
//
/**
 * Save a scan/recon session to persistent storage.
 * @param {"scan"|"recon"} type - The session type.
 * @param {Object} data - The main data (result payload).
 * @param {string} [label] - Optional human label.
 * @returns {Promise<{success:boolean, id?:number, error?:string}>}
 */
export async function saveSession(type, data, label = "") {
  if (!window.electronAPI?.dbSaveSession) {
    if (typeof window !== "undefined" && !window.electronAPI) {
      // Fallback to browser stub (see preload.js edit)
      if (window.console && console.warn)
        console.warn("window.electronAPI.dbSaveSession not available: using fallback");
    }
    return { success: false, error: "Electron session API unavailable" };
  }
  try {
    return await window.electronAPI.dbSaveSession({ type, label, data });
  } catch (err) {
    if (window.console && console.error)
      console.error("Electron session saveSession error:", err);
    return { success: false, error: String(err) };
  }
}

/**
 * Fetch a list of saved scan/recon sessions.
 * @param {{type?: "scan"|"recon", limit?: number}} [opts] - Optional filters.
 * @returns {Promise<{success:boolean, sessions?:Array, error?:string}>}
 */
export async function getSessions(opts = {}) {
  if (!window.electronAPI?.dbGetSessions) {
    if (typeof window !== "undefined" && !window.electronAPI) {
      // Fallback to browser stub (see preload.js edit)
      if (window.console && console.warn)
        console.warn("window.electronAPI.dbGetSessions not available: using fallback");
    }
    return { success: false, error: "Electron session API unavailable" };
  }
  try {
    return await window.electronAPI.dbGetSessions(opts);
  } catch (err) {
    if (window.console && console.error)
      console.error("Electron session getSessions error:", err);
    return { success: false, error: String(err) };
  }
}
