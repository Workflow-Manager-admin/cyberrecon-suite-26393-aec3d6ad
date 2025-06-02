//
// PUBLIC_INTERFACE
// Secure frontend utilities to invoke Masscan/Nuclei via IPC bridge (Electron).
// All argument validation/escaping is enforced on the backend.
// Each function returns a Promise: { stdout, stderr, code, error } as returned by backend.
//
/**
 * Runs masscan via Electron backend IPC.
 * @param {string[]} args - CLI arguments for masscan.
 * @returns {Promise<{stdout: string, stderr: string, code: number, error: string}>}
 */
/**
 * Calls Masscan via Electron IPC if available, otherwise provides error for web context.
 * @param {string[]} args - CLI arguments for masscan.
 * @returns {Promise<{stdout: string, stderr: string, code: number, error: string}>}
 */
export async function ipcMasscan(args = []) {
  if (typeof window === "undefined" || !window.electronAPI?.runMasscan) {
    // Fallback for web (non-Electron), matching preload.js stub error
    return {
      stdout: "",
      stderr: "Not available in browser build",
      code: 1,
      error: "Masscan is only available in Electron environment",
    };
  }
  return await window.electronAPI.runMasscan({ args });
}

/**
 * Calls Nuclei via Electron IPC if available, otherwise provides error for web context.
 * @param {string[]} args - CLI arguments for nuclei.
 * @returns {Promise<{stdout: string, stderr: string, code: number, error: string}>}
 */
export async function ipcNuclei(args = []) {
  if (typeof window === "undefined" || !window.electronAPI?.runNuclei) {
    // Fallback for web (non-Electron), matching preload.js stub error
    return {
      stdout: "",
      stderr: "Not available in browser build",
      code: 1,
      error: "Nuclei is only available in Electron environment",
    };
  }
  return await window.electronAPI.runNuclei({ args });
}

/**
 * Runs nuclei via Electron backend IPC.
 * @param {string[]} args - CLI arguments for nuclei.
 * @returns {Promise<{stdout: string, stderr: string, code: number, error: string}>}
 */

