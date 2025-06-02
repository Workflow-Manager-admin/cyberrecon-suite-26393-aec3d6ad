/**
 * PUBLIC_INTERFACE
 * Wordlist Generator – Paste/upload JS/HTML, TF-IDF/keyword extraction, export to CSV/JSON. Accessible, robust, live.
 */
import React, { useState, useRef } from "react";

// Demo corpus for offline TF-IDF/keywords demo
const DEMO_TEXT = `Login admin admin123 admin panel portal /api/login password admin password123 administrator
ReportGenerator export flag{cyb3r} login submit admin@example.com Default credentials admin panel dashboard
change password frontend devtest 123456 guest login info burpSuite

<!-- Paste JS/HTML or text. Try: function login(username, password) { fetch("/api/login"); } -->
`;

// Basic English stopwords for filtering noisy tokens
const STOPWORDS = new Set([
  "the", "and", "for", "that", "with", "are", "you", "but", "not", "was", "this", "have", "from", "they",
  "your", "will", "all", "can", "has", "get", "use", "one", "out", "about", "who", "its", "new", "when", "had", "our"
]);

// PUBLIC_INTERFACE
/**
 * Extract tokens (heuristic-TF-IDF demo, not full NLP, but live in-browser).
 * Removes boilerplate, HTML tags, JS comments/strings (to some extent), ranks tokens.
 */
function extractKeywords(raw) {
  if (!raw) return [];
  let text = String(raw);

  // Try to strip HTML tags, JS comments, and some string literals
  // Strip script/style tags + content (simple heuristic)
  text = text.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, " ");
  text = text.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, " ");
  text = text.replace(/<!--[\s\S]*?-->/g, " ");
  text = text.replace(/<[^>]+>/g, " "); // strip any other tags

  // Remove common JS single-line and multi-line comments
  text = text.replace(/\/\/.*$/gm, " ");
  text = text.replace(/\/\*[\s\S]*?\*\//g, " ");

  // Remove some quoted JS/HTML string literals (preserves actual words, but not perfect in all cases)
  text = text.replace(/(['"`])(\\?.)*?\1/g, " ");

  // Normalize, remove punctuation except word chars, curly/string, email, dot, slash
  text = text.replace(/[^a-zA-Z0-9{}_@.\/\-]/g, " ");

  // Split, filter short words and stopwords
  const tokens = text
    .toLowerCase()
    .split(/[\s,;]+/)
    .filter(w => !!w && w.length > 2 && !STOPWORDS.has(w) && !/^(\d{1,4}|[a-f0-9]{32,})$/.test(w)); // skip pure numbers or hash-like

  // Compute frequency (local TF), ignore <3 chars
  const freq = {};
  for (const w of tokens) freq[w] = (freq[w] || 0) + 1;

  // Heuristic fake-IDF: bonus to tokens that look "techy", penalize boring ones (domain-specific, demo only)
  const IDF_BONUS = w =>
    /flag|admin|login|report|export|panel|dashboard|submit|guest|frontend|burp|suite|token|secret|api|endpoint|debug|js|password|session|encode|decode/.test(
      w
    )
      ? 3.5
      : /^[a-z_][\w-]+$/.test(w) && w.length > 4
      ? 2
      : w.length >= 10
      ? 1.7
      : 1;

  // Score, sort
  const scored = Object.entries(freq)
    .map(([t, c]) => ({
      token: t,
      count: c,
      score: Math.round(c * IDF_BONUS(t) * 100) / 100
    }))
    .sort((a, b) => b.score - a.score || b.count - a.count)
    .slice(0, 32);

  return scored;
}

export default function WordlistModule() {
  const [input, setInput] = useState(DEMO_TEXT);
  const [results, setResults] = useState(() => extractKeywords(DEMO_TEXT));
  const [auto, setAuto] = useState(true);
  const [error, setError] = useState("");
  const fileInputRef = useRef();

  function handleUpdate(newText) {
    setInput(newText);
    if (auto) {
      try {
        setResults(extractKeywords(newText));
        setError("");
      } catch (e) {
        setResults([]);
        setError("Parsing error: " + (e?.message || "Unknown"));
      }
    }
  }

  function handleChange(e) {
    handleUpdate(e.target.value);
  }

  function handleExtract() {
    try {
      setResults(extractKeywords(input));
      setError("");
    } catch (e) {
      setResults([]);
      setError("Parsing error: " + (e?.message || "Unknown"));
    }
  }

  function handleUploadFile(e) {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 1024 * 1024) {
      setError("File too large (limit: 1MB)");
      return;
    }
    if ((file.type && !file.type.startsWith("text/")) || /\.(exe|bin|dll|img|iso)$/i.test(file.name)) {
      setError("Binary file detected -- only JS/HTML/text allowed.");
      return;
    }
    const reader = new window.FileReader();
    reader.onload = evt => {
      const text = String(evt.target.result);
      if (/[\x00-\x08\x0E-\x1F]/.test(text)) {
        setError("Binary file detected -- only JS/HTML/text allowed.");
        return;
      }
      setInput(text);
      if (auto) setResults(extractKeywords(text));
      if (fileInputRef.current) fileInputRef.current.value = "";
    };
    reader.onerror = () => setError("Failed to read file: " + file.name);
    reader.readAsText(file);
  }

  // Export results as .txt (wordlist), CSV, or JSON
  function handleExport(type = "txt") {
    let blob, url, link;
    if (type === "csv") {
      const rows = [["Keyword", "Score", "Count"]];
      for (const row of results) rows.push([row.token, row.score, row.count]);
      const csv = rows.map(r => r.map(x => `"${String(x).replace(/"/g, '""')}"`).join(",")).join("\n");
      blob = new Blob([csv], { type: "text/csv" });
      url = URL.createObjectURL(blob);
      link = document.createElement("a");
      link.href = url;
      link.download = "wordlist.csv";
    } else if (type === "json") {
      blob = new Blob([JSON.stringify(results, null, 2)], { type: "application/json" });
      url = URL.createObjectURL(blob);
      link = document.createElement("a");
      link.href = url;
      link.download = "wordlist.json";
    } else {
      // default txt: just word list, one per line
      blob = new Blob([results.map(row => row.token).join("\n")], { type: "text/plain" });
      url = URL.createObjectURL(blob);
      link = document.createElement("a");
      link.href = url;
      link.download = "wordlist.txt";
    }
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 120);
  }

  // Accessible table focus for keyboard navigation
  function onTableKeyDown(e, idx) {
    if (!results.length) return;
    if ((e.key === "ArrowDown" && idx < results.length - 1) || (e.key === "ArrowUp" && idx > 0)) {
      const nextIdx = e.key === "ArrowDown" ? idx + 1 : idx - 1;
      const node = document.querySelector(`[data-rowidx="wordrow${nextIdx}"]`);
      if (node) node.focus();
      e.preventDefault();
    }
  }

  // Accessibility: describe panel content + stats
  const hasResults = results.length > 0;
  const stats = hasResults
    ? `Top ${results.length} keywords, ranked by frequency and context relevance.`
    : "(No relevant keywords found)";

  return (
    <div>
      <div className="panel" style={{ marginBottom: "32px" }}>
        <div className="panel-header" style={{ display: "flex", alignItems: "center", gap: 9 }}>
          Wordlist Generator <span className="badge">TF-IDF</span>
          <span className="badge-faint">Exports</span>
        </div>
        <div className="description">
          Paste/upload JS/HTML/text. <b>Extracts ranked keywords for attack wordlists</b> using heuristic/offline TF-IDF.{" "}
          <span style={{ fontSize: "0.96em", color: "#ffc436" }}>
            Export as <b>TXT, CSV, or JSON</b>.
          </span>
        </div>
        <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
          <textarea
            rows={10}
            style={{
              width: "100%",
              maxWidth: 630,
              background: "#24272f",
              fontFamily: "JetBrains Mono,monospace",
              fontSize: "1em"
            }}
            value={input}
            onChange={handleChange}
            placeholder="Paste JS/HTML, code, or text here..."
            autoComplete="off"
            spellCheck={false}
            aria-label="Source text/code input for keyword extraction"
            aria-describedby="wordinput-desc"
          />
          <div style={{ minWidth: 200, maxWidth: 320 }}>
            <input
              ref={fileInputRef}
              type="file"
              accept=".js,.html,.txt"
              onChange={handleUploadFile}
              style={{
                marginBottom: "10px",
                background: "#181a20",
                color: "#fff",
                borderRadius: 6,
                padding: "4px"
              }}
              aria-label="Upload JS/HTML/text file"
            />
            <div style={{ marginBottom: 7 }}>
              <label style={{ fontSize: "0.99em", color: "#ff9800", userSelect: "none" }}>
                <input
                  type="checkbox"
                  checked={auto}
                  onChange={e => setAuto(e.target.checked)}
                  style={{ marginRight: 7 }}
                  aria-checked={auto}
                  aria-label="Enable live extraction"
                />
                Auto Extract
              </label>
            </div>
            <button
              className="btn"
              style={{ marginTop: "9px" }}
              onClick={handleExtract}
              disabled={auto}
              aria-label="Manual extract keywords"
            >
              Extract Now
            </button>
            <div style={{ marginTop: 15 }}>
              <button className="btn btn-success" style={{ marginBottom: 8, marginRight: 8 }} onClick={() => handleExport("txt")}>
                Export .txt
              </button>
              <button className="btn btn-ghost" style={{ marginBottom: 8, marginRight: 8 }} onClick={() => handleExport("csv")}>
                Export CSV
              </button>
              <button className="btn btn-ghost" style={{ marginBottom: 8 }} onClick={() => handleExport("json")}>
                Export JSON
              </button>
            </div>
            <div style={{ marginTop: 8, color: "#ff3333", fontSize: "0.96em", minHeight: "18px" }}>
              {error && <span role="alert" aria-live="assertive">{error}</span>}
            </div>
            <div style={{ marginTop: 9 }}>
              <div className="badge-faint" style={{ fontWeight: 420, fontSize: "0.97em", marginBottom: 2, display: "inline-block" }}>
                <span>{stats}</span>
              </div>
            </div>
            <div style={{ marginTop: 12, fontSize: "0.97em" }}>
              <span className="badge-faint" style={{ fontWeight: 420 }}>CTRL+Enter</span>
              <span style={{ color: "#babfc7" }}> Extract (manual mode)</span>
            </div>
          </div>
        </div>
      </div>
      <div className="panel" aria-labelledby="wordlist-table-header">
        <div className="panel-header" style={{ display: "flex", alignItems: "center", gap: 8 }} id="wordlist-table-header">
          Ranked Keywords
          {hasResults && <span className="badge-faint">{results.length} Results</span>}
          <span className="badge-faint" style={{ marginLeft: 8 }}>Offline</span>
        </div>
        <table
          className="table"
          style={{ background: "#24272f", marginBottom: 0, fontSize: "1em" }}
          aria-label="Ranked keywords for export"
          role="table"
        >
          <thead>
            <tr>
              <th scope="col">Keyword</th>
              <th scope="col">Score</th>
              <th scope="col">Count</th>
            </tr>
          </thead>
          <tbody>
            {!hasResults && (
              <tr>
                <td colSpan={3} style={{ textAlign: "center", color: "#babfc7" }} tabIndex={0}>
                  (No relevant keywords found)
                </td>
              </tr>
            )}
            {results.map((row, idx) => (
              <tr
                key={row.token + idx}
                tabIndex={0}
                aria-label={row.token + " (" + row.count + ")"}
                data-rowidx={"wordrow" + idx}
                style={{
                  background: idx % 2 === 0 ? "rgba(255,152,0,0.04)" : "#22272e",
                  outline: false
                }}
                onKeyDown={e => onTableKeyDown(e, idx)}
              >
                <td style={{ fontWeight: 600, color: "#ff9800" }}>{row.token}</td>
                <td style={{ fontFamily: "JetBrains Mono,monospace", fontSize: "1em" }}>{row.score}</td>
                <td style={{ fontFamily: "monospace", fontSize: "0.99em" }}>{row.count}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="description" style={{ marginTop: "16px", color: "#babfc7" }}>
        <b>How it works:</b> Robust offline keyword extraction for custom wordlists. Scrubs boilerplate, ranks context tokens.<br />
        <span className="badge-faint">CSV, JSON, and classic .txt export</span>
        <span className="badge-faint" style={{ marginLeft: 9 }}>Premium UI</span>
        <span className="badge-faint" style={{ marginLeft: 9 }}>Accessibility Improved</span>
      </div>
    </div>
  );
}
