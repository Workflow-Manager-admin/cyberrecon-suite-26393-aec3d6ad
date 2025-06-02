import React, { useState } from "react";
import "./WordlistModule.css";

/**
 * PUBLIC_INTERFACE
 * Wordlist Generator + Analyzer UI – Paste/upload code/text, perform TF-IDF/highlight, export.
 */
const DEMO_TEXT = [
  "var secret = 'FLAG{demo_123}';",
  "let apiKey = 'sk_live_example';",
  "https://demo.example.com/api/endpoint",
  "admin / password123",
].join("\n");

function tfidfRank(text) {
  // Simple tokenizer and count for demo; real implementation would be more advanced
  if (!text || typeof text !== "string") return [];
  const words = text
    .replace(/[\W_]+/g, " ")
    .toLowerCase()
    .split(/\s+/)
    .filter(w => w.length > 2 && !/^https?:/.test(w));
  const freq = {};
  for (const w of words) freq[w] = (freq[w] || 0) + 1;
  return Object.entries(freq)
    .sort((a, b) => b[1] - a[1])
    .map(([word, count]) => ({ word, count }));
}

export default function WordlistModule() {
  const [input, setInput] = useState(DEMO_TEXT);
  const [tokens, setTokens] = useState(tfidfRank(DEMO_TEXT));
  const [err, setErr] = useState("");
  const [exported, setExported] = useState(false);

  function handleInput(e) {
    setInput(e.target.value);
    try {
      setTokens(tfidfRank(e.target.value));
      setErr("");
    } catch (e) {
      setErr("Tokenization error: " + (e?.message || "unknown"));
      setTokens([]);
    }
  }
  function handlePasteDemo() {
    setInput(DEMO_TEXT);
    setTokens(tfidfRank(DEMO_TEXT));
    setErr("");
  }
  function handleExport() {
    const lines = tokens.map(t => t.word).join("\n");
    const blob = new window.Blob([lines], { type: "text/plain" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "cyberrecon-wordlist.txt";
    a.click();
    setTimeout(() => window.URL.revokeObjectURL(url), 80);
    setExported(true);
    setTimeout(() => setExported(false), 1600);
  }

  return (
    <div>
      <div className="wordlist-panel">
        <div className="wordlist-header">
          Wordlist Generator <span className="badge-faint">Premium</span>
        </div>
        <div className="wordlist-description">
          Paste or upload JavaScript/HTML/output analyzed for high-value tokens/words. Export or use in attacks.
        </div>
        <div className="wordlist-toolbox">
          <textarea
            className="wordlist-inputarea"
            value={input}
            onChange={handleInput}
            rows={8}
            placeholder="Paste JS/HTML/words here..."
            aria-label="Wordlist source input"
          />
          <div className="wordlist-actions">
            <button className="wordlist-btn" onClick={handlePasteDemo}>
              Demo
            </button>
            <button className="wordlist-btn" onClick={handleExport} disabled={!tokens.length}>
              Export
            </button>
          </div>
        </div>
        <div className="wordlist-section-title">Top Words</div>
        <table className="wordlist-table">
          <thead>
            <tr>
              <th>Token/Word</th>
              <th>Count</th>
            </tr>
          </thead>
          <tbody>
            {tokens.length === 0 && (
              <tr>
                <td colSpan={2} style={{ color: "#babfc7", textAlign: "center" }}>(No tokens found)</td>
              </tr>
            )}
            {tokens.map((t, i) => (
              <tr key={t.word + i}>
                <td>{t.word}</td>
                <td style={{ color: "#ff9800", fontWeight: 600 }}>{t.count}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {err && (
          <div className="description" style={{ color: "#ff545f", marginTop: "11px" }}>
            {err}
          </div>
        )}
        {exported && (
          <span className="badge-faint" style={{ marginTop: 11, display: "inline-block", color: "#4be38d" }}>
            Exported!
          </span>
        )}
      </div>
      <div className="description" style={{ color: "#babfc7", marginTop: "17px" }}>
        <b>Tip:</b> Export top tokens or use <span className="badge-faint" style={{ marginLeft: 2 }}>Premium</span> for advanced filters.
      </div>
    </div>
  );
}
