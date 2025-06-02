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

// Demo recon data for session save
function getDemoReconData(lastResult) {
  return {
    demo: true,
    from: "echo",
    stdout: lastResult?.stdout || "",
    stderr: lastResult?.stderr || "",
    code: lastResult?.code,
    timestamp: new Date().toISOString(),
  };
}

export default function ReconDashboard() {
  const { runCliCommand, loading, result, error } = useCliCommand();

  // Session save/load state
  const [saveStatus, setSaveStatus] = React.useState("");
  const [history, setHistory] = React.useState([]);
  const [historyLoading, setHistoryLoading] = React.useState(false);
  const [fetchError, setFetchError] = React.useState("");

  // Save demo session (recon) button handler
  async function handleSaveSession() {
    setSaveStatus("Saving...");
    const saveRes = await saveSession(
      "recon",
      getDemoReconData(result),
      "Echo test session"
    );
    if (saveRes.success) {
      setSaveStatus(`Saved (ID: ${saveRes.id})`);
      handleFetchSessions(); // refresh history
    } else {
      setSaveStatus("Save failed: " + (saveRes.error || "unknown error"));
    }
  }

  // Fetch sessions (recent recon) and update state
  async function handleFetchSessions() {
    setHistoryLoading(true);
    setFetchError("");
    const response = await getSessions({ type: "recon", limit: 8 });
    if (response.success) {
      setHistory(response.sessions || []);
    } else {
      setFetchError(response.error || "Failed to load history.");
      setHistory([]);
    }
    setHistoryLoading(false);
  }

  // Auto-fetch session history on mount
  React.useEffect(() => {
    handleFetchSessions();
    // eslint-disable-next-line
  }, []);

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
          For demo: wires to <code>window.electronAPI.runCliCommand(&#123;command:"echo", args:["hello"]&#125;)</code>
        </small>
      </p>
      <button className="btn" onClick={handleEchoClick} disabled={loading}>
        {loading ? "Running..." : "Run Echo (IPC)"}
      </button>
      <button
        className="btn"
        style={{ marginLeft: "16px" }}
        onClick={handleSaveSession}
        disabled={loading}
        title="Save current demo result to recon session history"
      >
        {saveStatus === "Saving..." ? "Saving..." : "Save as Recon Session"}
      </button>
      <button
        className="btn"
        style={{ marginLeft: "12px" }}
        onClick={handleFetchSessions}
        disabled={historyLoading}
        title="Reload session history"
      >
        {historyLoading ? "Refreshing..." : "Show Recent History"}
      </button>
      {saveStatus && (
        <div style={{ marginTop: 7, color: saveStatus.startsWith("Saved") ? "#4be38d" : "#faa" }}>
          {saveStatus}
        </div>
      )}
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
      <div style={{ marginTop: 38 }}>
        <h3 style={{ marginBottom: 7 }}>Recent Recon Sessions</h3>
        {fetchError && (
          <div style={{ color: "#ff6066", marginBottom: 10 }}>
            Fetch error: {fetchError}
          </div>
        )}
        <table style={{
          width: "100%",
          background: "#222427",
          color: "#eee",
          borderCollapse: "collapse",
          marginTop: 8
        }}>
          <thead>
            <tr>
              <th style={{ textAlign: "left", padding: 7, borderBottom: "1px solid #3d414b" }}>ID</th>
              <th style={{ textAlign: "left", padding: 7, borderBottom: "1px solid #3d414b" }}>Label</th>
              <th style={{ textAlign: "left", padding: 7, borderBottom: "1px solid #3d414b" }}>Started At</th>
              <th style={{ textAlign: "left", padding: 7, borderBottom: "1px solid #3d414b" }}>Data/Info</th>
            </tr>
          </thead>
          <tbody>
            {history.length === 0 && (
              <tr><td colSpan={4} style={{ textAlign: "center", color: "#aaa" }}>(No session history found.)</td></tr>
            )}
            {history.map(session => (
              <tr key={session.id || `sess-${Math.random()}`}>
                <td style={{ padding: 7, fontFamily: "monospace" }}>{session.id}</td>
                <td style={{ padding: 7 }}>{session.label || <span style={{ color: "#888" }}>(none)</span>}</td>
                <td style={{ padding: 7, fontSize: "0.98em" }}>
                  {session.started_at
                    ? new Date(session.started_at).toLocaleString()
                    : <span style={{ color: "#aaa" }}>(unknown)</span>}
                </td>
                <td style={{ padding: 7, maxWidth: 400, fontSize: "0.97em", overflowWrap: "anywhere" }}>
                  {session.data && typeof session.data === "object"
                    ? Object.entries(session.data)
                        .map(([k, v]) => `${k}: ${typeof v === "string" ? v.slice(0, 38) : JSON.stringify(v)}`)
                        .join(", ")
                    : <span style={{ color: "#888" }}>(unavailable)</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
