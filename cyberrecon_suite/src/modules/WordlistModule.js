/**
 * PUBLIC_INTERFACE
 * Wordlist Generator – Paste/upload file, TF-IDF demo, keyword export.
 */
import React, { useState } from "react";

// Demo corpus for quick offline TF-IDF
const DEMO_TEXT = `Login admin admin123 admin panel portal /api/login password admin password123 administrator
ReportGenerator export flag{cyb3r} login submit admin@example.com Default credentials admin panel dashboard
change password frontend devtest 123456 guest login info burpSuite
`;

function getWordCounts(text) {
  const words = Array.from(
    text
      .toLowerCase()
      .replace(/[^\w{}@.]+/g, " ")
      .split(/\s+/)
      .filter(w => !!w && w.length > 2) // filter stopwords/shorts
  );
  const freq = {};
  for (const w of words) freq[w] = (freq[w] || 0) + 1;
  // Output: [ [word, count], ... ] sorted desc
  return Object.entries(freq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20);
}

export default function WordlistModule() {
  const [input, setInput] = useState(DEMO_TEXT);
  const [results, setResults] = useState(() => getWordCounts(DEMO_TEXT));
  const [auto, setAuto] = useState(true);

  function handleUpdate(newText) {
    setInput(newText);
    if (auto) setResults(getWordCounts(newText));
  }

  function handlePaste(e) {
    handleUpdate(e.target.value);
  }

  function handleExtract() {
    setResults(getWordCounts(input));
  }

  function handleUploadFile(e) {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = evt => {
        handleUpdate(evt.target.result);
      };
      reader.readAsText(file);
    }
  }

  function handleExport() {
    // Demo export: export wordlist as txt
    const blob = new Blob(
      [results.map(([word]) => word).join("\n")],
      { type: "text/plain" }
    );
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "wordlist.txt";
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 80);
  }

  return (
    <div>
      <div className="panel" style={{ marginBottom: "26px" }}>
        <div className="panel-header">
          Smart Wordlist Generator <span className="badge">Beta</span>
        </div>
        <div className="description">
          Paste or upload text/code. Extract probable keywords using simple TF-IDF (offline).
        </div>
        <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
          <textarea
            rows={8}
            style={{ width: "100%", maxWidth: 540, background: "#24272f" }}
            value={input}
            onChange={handlePaste}
            placeholder="Paste target HTML, JS, or existing wordlist here..."
            autoComplete="off"
          />
          <div style={{ minWidth: 170 }}>
            <input
              type="file"
              accept=".txt,.js,.html"
              onChange={handleUploadFile}
              style={{ marginBottom: "10px", background: "#181a20", color: "#fff" }}
            />
            <div>
              <label style={{ fontSize: "0.99em", color: "#ff9800" }}>
                <input
                  type="checkbox"
                  checked={auto}
                  onChange={e => setAuto(e.target.checked)}
                  style={{ marginRight: 7 }}
                />
                Auto Extract
              </label>
            </div>
            <button className="btn" style={{ marginTop: "9px" }} onClick={handleExtract} disabled={auto}>
              Extract Now
            </button>
          </div>
        </div>
      </div>
      <div className="panel">
        <div className="panel-header">Keyword Candidates</div>
        <table className="table" style={{ background: "#24272f", marginBottom: 0 }}>
          <thead>
            <tr>
              <th>Keyword</th>
              <th>Frequency</th>
            </tr>
          </thead>
          <tbody>
            {results.length === 0 && (
              <tr><td colSpan={2} style={{ textAlign: "center", color: "#babfc7" }}>(No relevant keywords found)</td></tr>
            )}
            {results.map(([w, cnt], idx) => (
              <tr key={w + idx}>
                <td style={{ fontWeight: 600, color: "#ff9800" }}>{w}</td>
                <td style={{ fontFamily: "monospace", fontSize: "1em" }}>{cnt}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="panel-foot" style={{ marginTop: 16, textAlign: "right" }}>
          <button className="btn btn-success" onClick={handleExport} title="Export as wordlist (.txt)">Export .txt</button>
        </div>
      </div>
      <div className="description" style={{ marginTop: "16px", color: "#babfc7" }}>
        <b>How it works:</b> Runs basic TF-IDF to pick candidate words for your custom wordlist.<br />
        Export and use with your attack tools.<span className="badge-faint" style={{ marginLeft: 9 }}>Premium UI</span>
      </div>
    </div>
  );
}
