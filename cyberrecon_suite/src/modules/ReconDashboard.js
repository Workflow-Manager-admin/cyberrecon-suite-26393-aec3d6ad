/**
 * PUBLIC_INTERFACE
 * Recon Dashboard module – triggers a sample CLI via Electron IPC and displays output.
 */

import React, { useState, useEffect } from "react";
import { saveSession, getSessions } from "./utils/ipcSession";

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
      // window.electronAPI.runCliCommand is defined in preload.js for Electron.
      // Add guard for browser context/injected stub.
      const bridge = (typeof window !== "undefined" && window.electronAPI && typeof window.electronAPI.runCliCommand === "function")
        ? window.electronAPI : null;
      if (!bridge) throw new Error("Electron bridge API not available in this context.");
      const res = await bridge.runCliCommand({
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

// PUBLIC_INTERFACE
/**
 * ReconDashboard UI: Sample "Run Echo" button, displays stdout/stderr/code.
 */
export default function ReconDashboard() {
  const { runCliCommand, loading, result, error } = useCliCommand();

  // Session save/load state
  const [saveStatus, setSaveStatus] = useState("");
  const [history, setHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [fetchError, setFetchError] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(false);

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
  useEffect(() => {
    handleFetchSessions();
    // eslint-disable-next-line
  }, []);

  // Sample test of 'echo "hello world"' via IPC
  const handleEchoClick = () => {
    runCliCommand("echo", ["hello world from Electron CLI!"]);
  };

  // Premium slide-in sidebar with quick actions & history preview
  const sidebarPanel = (
    <aside
      style={{
        position: "fixed",
        right: sidebarOpen ? 0 : "-360px",
        top: 0,
        height: "100vh",
        width: 340,
        background: "var(--color-bg-panel)",
        boxShadow: "-6px 0 32px #000a, 0 1.5px 0 #150b0450",
        borderLeft: "2px solid var(--color-accent50)",
        zIndex: 100,
        transition: "right 0.26s cubic-bezier(.41,1.2,.54,.98)",
        padding: "34px 19px 24px 22px"
      }}
      aria-label="Recon Quick Panel"
    >
      <button
        className="btn btn-ghost"
        style={{ position: "absolute", left: -80, top: 33, fontWeight: 900 }}
        onClick={() => setSidebarOpen(false)}
        aria-label="Close quick panel"
      >
        ← Close
      </button>
      <div className="panel-header" style={{ marginTop: "1.5em" }}>
        Recon Quick Actions
      </div>
      <div style={{ margin: "2em 0 1.4em 0" }}>
        <button
          className="btn btn-success"
          style={{ width: "100%", marginBottom: "12px" }}
          onClick={handleEchoClick}
          disabled={loading}
        >
          {loading ? "Running..." : "Run Demo Scan"}
        </button>
        <button
          className="btn"
          style={{ width: "100%" }}
          onClick={handleSaveSession}
          disabled={loading}
          title="Save current demo result to recon session history"
        >
          {saveStatus === "Saving..." ? "Saving..." : "Quick Save Session"}
        </button>
        <div className="description" style={{ marginTop: 13, color: "#fff" }}>
          Jump to scanner, recon, or export (coming soon).
        </div>
      </div>
      <hr className="divider" />
      <div className="panel-header" style={{ marginBottom: "10px" }}>
        History
      </div>
      <div style={{ maxHeight: "230px", overflowY: "auto" }}>
        <table className="table" style={{ background: "#1b1d22", fontSize: "0.99em" }}>
          <thead>
            <tr>
              <th>ID</th>
              <th>Label</th>
              <th>Time</th>
            </tr>
          </thead>
          <tbody>
            {history.length === 0 && (
              <tr>
                <td colSpan={3} style={{ textAlign: "center", color: "#888" }}>
                  (none)
                </td>
              </tr>
            )}
            {history.map((session) => (
              <tr key={session.id || `pane-sess-${Math.random()}`}>
                <td style={{ fontFamily: "monospace" }}>{session.id}</td>
                <td>
                  <span style={{ color: "#ffa726", fontWeight: 500 }}>
                    {session.label || <span style={{ color: "#888" }}>(none)</span>}
                  </span>
                </td>
                <td>
                  {session.started_at
                    ? new Date(session.started_at).toLocaleTimeString()
                    : <span style={{ color: "#aaa" }}>(-)</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <hr className="divider" />
      <div className="panel-header" style={{ marginBottom: "11px" }}>Tips</div>
      <div className="description" style={{ color: "#babfc7" }}>
        - Use <strong>Run Demo Scan</strong> to test IPC wiring.<br />
        - Sessions are cached locally.<br />
        - Export, graph, and more coming soon.
      </div>
    </aside>
  );

  return (
    <div style={{ position: "relative" }}>
      {/* Slide-in Sidebar Trigger */}
      <button
        className="btn btn-ghost"
        style={{
          position: "fixed",
          right: sidebarOpen ? 340 : 15,
          top: 80,
          zIndex: 101,
          borderRadius: "8px 0 0 8px",
          boxShadow: sidebarOpen ? "none" : "0 2px 8px 0 #0002",
          transition: "right 0.25s"
        }}
        onClick={() => setSidebarOpen(s => !s)}
        aria-label={sidebarOpen ? "Hide quick panel" : "Show quick panel"}
      >
        {sidebarOpen ? <>»</> : <>☰ Panel</>}
      </button>
      {sidebarPanel}

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
