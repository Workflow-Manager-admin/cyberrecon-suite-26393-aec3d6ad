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
export async function ipcMasscan(args = []) {
  // Assume window.electronAPI.runMasscan defined in preload.js
  return await window.electronAPI.runMasscan({ args });
}

/**
 * Runs nuclei via Electron backend IPC.
 * @param {string[]} args - CLI arguments for nuclei.
 * @returns {Promise<{stdout: string, stderr: string, code: number, error: string}>}
 */
export async function ipcNuclei(args = []) {
  // Assume window.electronAPI.runNuclei defined in preload.js
  return await window.electronAPI.runNuclei({ args });
}
