/**
 * PUBLIC_INTERFACE
 * Vulnerability Scanner module – demonstrates usage of Masscan and Nuclei via secure Electron IPC.
 */

import React, { useState, useEffect } from "react";
import { ipcMasscan, ipcNuclei } from "./utils/ipcScan";
import { saveSession, getSessions } from "./utils/ipcSession";

/**
 * Get scan session object for db (scan).
 */
function getDemoScanSession(engine, args, res) {
  return {
    engine,
    args: Array.isArray(args) ? args : [],
    ...res,
    timestamp: new Date().toISOString(),
  };
}

// PUBLIC_INTERFACE
export default function ScannerModule() {
  const [loading, setLoading] = useState(false);
  const [engine, setEngine] = useState(null); // 'masscan' or 'nuclei'
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  // Session save/load state
  const [saveStatus, setSaveStatus] = useState("");
  const [history, setHistory] = useState([]);
  const [fetchError, setFetchError] = useState("");
  const [historyLoading, setHistoryLoading] = useState(false);

  const masscanArgs = ["-p80,443,8000-8100", "scanme.nmap.org", "--rate=500"];
  const nucleiArgs = ["-u", "https://scanme.nmap.org", "--tags","cves"];

  // PUBLIC_INTERFACE
  async function handleMasscanClick() {
    setLoading(true);
    setEngine("masscan");
    setResult(null);
    setError(null);
    try {
      const res = await ipcMasscan(masscanArgs);
      setResult(res);
      if (res?.error) setError(res.error);
    } catch (err) {
      setError(String(err));
      setResult(null);
    } finally {
      setLoading(false);
    }
  }

  // PUBLIC_INTERFACE
  async function handleNucleiClick() {
    setLoading(true);
    setEngine("nuclei");
    setResult(null);
    setError(null);
    try {
      const res = await ipcNuclei(nucleiArgs);
      setResult(res);
      if (res?.error) setError(res.error);
    } catch (err) {
      setError(String(err));
      setResult(null);
    } finally {
      setLoading(false);
    }
  }

  // Save scan session to db
  async function handleSaveSession() {
    if (!engine || !result) {
      setSaveStatus("Run a scan first!");
      return;
    }
    setSaveStatus("Saving...");
    const scanSession = getDemoScanSession(engine, engine === "masscan" ? masscanArgs : nucleiArgs, result);
    const saveRes = await saveSession(
      "scan",
      scanSession,
      `Scan (${engine})`
    );
    if (saveRes.success) {
      setSaveStatus(`Saved (ID: ${saveRes.id})`);
      handleFetchSessions();
    } else {
      setSaveStatus("Save failed: " + (saveRes.error || "unknown error"));
    }
  }

  // Fetch recent scan sessions
  async function handleFetchSessions() {
    setHistoryLoading(true);
    setFetchError("");
    const response = await getSessions({ type: "scan", limit: 8 });
    if (response.success) {
      setHistory(response.sessions || []);
    } else {
      setFetchError(response.error || "Failed to load history.");
      setHistory([]);
    }
    setHistoryLoading(false);
  }

  // Auto-load scan session history
  useEffect(() => {
    handleFetchSessions();
    // eslint-disable-next-line
  }, []);

  return (
    <div>
      <h2 style={{ marginTop: 0 }}>Vulnerability Scanner</h2>
      <p>
        This panel demonstrates calling Masscan/Nuclei CLI via Electron IPC.
        <br />
        <small>
          Masscan: <code>{"masscan " + masscanArgs.join(" ")}</code>
        </small>
        <br />
        <small>
          Nuclei: <code>{"nuclei " + nucleiArgs.join(" ")}</code>
        </small>
      </p>
      <div style={{ display: "flex", gap: "16px", marginBottom: "1.5em" }}>
        <button className="btn" onClick={handleMasscanClick} disabled={loading}>
          {loading && engine === "masscan" ? "Running..." : "Run Masscan"}
        </button>
        <button className="btn" onClick={handleNucleiClick} disabled={loading}>
          {loading && engine === "nuclei" ? "Running..." : "Run Nuclei"}
        </button>
        <button
          className="btn"
          onClick={handleSaveSession}
          disabled={loading}
          style={{ marginLeft: "12px" }}
          title="Save this scan result to scan history"
        >
          {saveStatus === "Saving..." ? "Saving..." : "Save as Scan Session"}
        </button>
        <button
          className="btn"
          onClick={handleFetchSessions}
          disabled={historyLoading}
          style={{ marginLeft: "12px" }}
          title="Reload recent scan session history"
        >
          {historyLoading ? "Refreshing..." : "Show Scan History"}
        </button>
      </div>
      {saveStatus && (
        <div style={{ marginTop: 7, color: saveStatus.startsWith("Saved") ? "#4be38d" : "#faa" }}>
          {saveStatus}
        </div>
      )}
      <div style={{ marginTop: 12 }}>
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
              <strong>stdout:</strong>
              <pre style={{ margin: 0, color: "#fff" }}>
                {result.stdout?.trim() || <span style={{ color: "#aaa" }}>(empty)</span>}
              </pre>
            </div>
            <div>
              <strong>stderr:</strong>
              <pre style={{ margin: 0, color: "#aaa" }}>
                {result.stderr?.trim() || <span style={{ color: "#aaa" }}>(empty)</span>}
              </pre>
            </div>
            <div>
              <strong>exit code:</strong> {typeof result.code !== "undefined" ? result.code : "-"}
            </div>
          </div>
        )}
      </div>
      <div style={{ marginTop: 38 }}>
        <h3 style={{ marginBottom: 7 }}>Recent Scan Sessions</h3>
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
              <th style={{ textAlign: "left", padding: 7, borderBottom: "1px solid #3d414b" }}>Engine</th>
              <th style={{ textAlign: "left", padding: 7, borderBottom: "1px solid #3d414b" }}>Results/Info</th>
            </tr>
          </thead>
          <tbody>
            {history.length === 0 && (
              <tr><td colSpan={5} style={{ textAlign: "center", color: "#aaa" }}>(No scan session history found.)</td></tr>
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
                <td style={{ padding: 7 }}>
                  {session.data?.engine || <span style={{ color: "#aaa" }}>(unknown)</span>}
                </td>
                <td style={{ padding: 7, maxWidth: 400, fontSize: "0.97em", overflowWrap: "anywhere" }}>
                  {session.data && typeof session.data === "object"
                    ? Object.entries(session.data)
                        .filter(([k]) => k !== "args" && k !== "timestamp")
                        .map(([k, v]) => `${k}: ${typeof v === "string" ? v.slice(0, 38) : JSON.stringify(v).slice(0, 38)}`)
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
