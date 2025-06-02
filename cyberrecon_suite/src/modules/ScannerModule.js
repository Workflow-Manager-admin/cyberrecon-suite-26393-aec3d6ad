/**
 * PUBLIC_INTERFACE
 * Vulnerability Scanner module – demonstrates usage of Masscan and Nuclei via secure Electron IPC.
 */

import React, { useState } from "react";
import { ipcMasscan, ipcNuclei } from "./utils/ipcScan";

/**
 * ScannerModule: Example UI to launch Masscan and Nuclei, capture/display result, and handle errors.
 */
export default function ScannerModule() {
  const [loading, setLoading] = useState(false);
  const [engine, setEngine] = useState(null); // 'masscan' or 'nuclei'
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  // Sample input for demonstration. Normally, would be user-supplied.
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
      </div>
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
    </div>
  );
}
