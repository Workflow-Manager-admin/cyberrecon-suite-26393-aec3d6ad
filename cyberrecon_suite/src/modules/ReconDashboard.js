/**
 * PUBLIC_INTERFACE
 * Recon Dashboard module – triggers a sample CLI via Electron IPC and displays output.
 */

import React, { useState } from "react";

/**
 * useCliCommand – React hook to request CLI operations via Electron IPC.
 * Pattern: Exposes `runCliCommand(command, args)` and handles loading/result/error.
 * Result: {stdout, stderr, code, error} from backend handler.
 */
function useCliCommand() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  // PUBLIC_INTERFACE
  async function runCliCommand(command, args = []) {
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      // window.electronAPI.runCliCommand is defined in preload.js
      const res = await window.electronAPI.runCliCommand({
        command,
        args
      });
      setResult(res);
      if (res && res.error) setError(res.error);
    } catch (err) {
      setError(String(err));
      setResult(null);
    } finally {
      setLoading(false);
    }
  }

  return { runCliCommand, loading, result, error };
}

/**
 * PUBLIC_INTERFACE
 * ReconDashboard UI: Sample "Run Echo" button, displays stdout/stderr/code.
 */
export default function ReconDashboard() {
  const { runCliCommand, loading, result, error } = useCliCommand();

  // Sample test of 'echo "hello world"' via IPC
  const handleEchoClick = () => {
    runCliCommand("echo", ["hello world from Electron CLI!"]);
  };

  return (
    <div>
      <h2 style={{ marginTop: 0 }}>Recon Dashboard</h2>
      <p>
        This is a placeholder. Below is a test button that calls a secure backend CLI via Electron IPC.<br />
        <small>
          For demo: wires to <code>window.electronAPI.runCliCommand({"{"}command:"echo", args:["hello"]{"}"})</code>
        </small>
      </p>
      <button className="btn" onClick={handleEchoClick} disabled={loading}>
        {loading ? "Running..." : "Run Echo (IPC)"}
      </button>
      <div style={{ marginTop: 24 }}>
        {error && (
          <div style={{ color: "#ff6666", marginBottom: 8 }}>
            <strong>Error:</strong> {error}
          </div>
        )}
        {result && (
          <div style={{
            background: "#23272e",
            border: "1px solid #2f333a",
            padding: "13px",
            borderRadius: "5px",
            marginTop: "4px",
            fontFamily: "monospace",
            color: "#fff"
          }}>
            <div>
              <strong>stdout:</strong> {result.stdout?.trim() || <span style={{ color: "#aaa" }}>(empty)</span>}
            </div>
            <div>
              <strong>stderr:</strong> {result.stderr?.trim() || <span style={{ color: "#aaa" }}>(empty)</span>}
            </div>
            <div>
              <strong>exit code:</strong> {typeof result.code !== "undefined" ? result.code : "-"}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
