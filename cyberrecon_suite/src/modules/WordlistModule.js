 /**
  * PUBLIC_INTERFACE
  * Wordlist Generator – Paste/upload JS/HTML, live TF-IDF/keyword extraction, export CSV/JSON. Robust, modern UI.
  *
  * Features:
  * - Allows paste or file upload of JS/HTML/text (handles encoding, large/binary checks).
  * - Real-time, in-browser TF-IDF/heuristic keyword extraction (client-side, privacy-preserving).
  * - Keywords are ranked (frequency/context) and exportable (CSV/JSON/txt).
  * - Modern, accessible, error-resilient UI.
  */
import React, { useState, useRef, useCallback } from "react";

// Demo sample to show onboarding
const DEMO_TEXT = `
// Paste JavaScript, HTML, or raw code/text here.
// Try for example: <script>function login(username,password){fetch("/api/login");}</script>
// Or real-word: admin login, endpoint, dashboard, password123, burpSuite, token, session, encode, decode
<html>
  <body>
    <h1>Admin Portal</h1>
    <input type="text" id="user" />
    <input type="password" id="password" />
    <button onclick="login()">Login</button>
    <!-- password: admin123, default creds for admin site -->
    <script>
      // flag{cyb3rval}
      function login(user, pass) {
        fetch("/api/login");
      }
    </script>
  </body>
</html>
`;

// Standard English stopwords to be ignored
const STOPWORDS = new Set([
  "the","and","for","that","with","are","you","but","not","was","this","have","from","they",
  "your","will","all","can","has","get","use","one","out","about","who","its","new","when","had","our",
  "his","her","their","any","may","its","each","such","too","how","more","via","per","which",
]);

// Heuristic TF-IDF-inspired scoring (since we don't have a corpus, give bonus to domain-specific tokens)
function extractKeywords(inputText) {
  if (!inputText) return [];
  let text = String(inputText);

  // Heuristically strip HTML tags, script/style blocks, comments, and string literals
  // Remove script/style tags + content
  text = text.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, " ");
  text = text.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, " ");
  text = text.replace(/<!--[\s\S]*?-->/g, " ");
  text = text.replace(/<[^>]+>/g, " ");
  // JS comments
  text = text.replace(/\/\/.*$/gm, " ");
  text = text.replace(/\/\*[\s\S]*?\*\//g, " ");
  // String literals
  text = text.replace(/(['"`])((?:\\.|.)*?)\1/g, " ");
  // Remove some punctuation except word chars, curly/string, @, . and / for URLs, emails, flags
  text = text.replace(/[^a-zA-Z0-9\{\}_@.\/\-]/g, " ");

  // Tokenize - also remove tokens <3 chars and stopwords
  const tokens = text
    .toLowerCase()
    .split(/[\s,;]+/)
    .map(t => t.trim())
    .filter(t =>
      t && t.length > 2 &&
      !STOPWORDS.has(t) &&
      !/^(\d{1,4}|[a-f0-9]{32,})$/.test(t) // no pure numbers/hash-like
    );

  // Build term frequency
  const freq = {};
  for (const t of tokens) freq[t] = (freq[t] || 0) + 1;

  // Scoring: domain keywords, then length, then frequency
  function bonus(token) {
    if (/flag|admin|login|report|token|password|burp|suite|dashboard|encode|decode|portal|session|key|secret|export|panel|frontend|debug|endpoint|api/.test(token)) return 3.8;
    if (/^[a-z_][\w-]+$/.test(token) && token.length > 5) return 2.25;
    if (token.length > 13) return 1.4;
    return 1;
  }

  // Score and rank
  const scored = Object.entries(freq)
    .map(([token, count]) => ({
      token,
      count,
      score: Math.round(count * bonus(token) * 100) / 100
    }))
    .sort((a, b) => b.score - a.score || b.count - a.count)
    .slice(0, 40);

  return scored;
}

export default function WordlistModule() {
  const [input, setInput] = useState(DEMO_TEXT);
  const [results, setResults] = useState(() => extractKeywords(DEMO_TEXT));
  const [auto, setAuto] = useState(true);
  const [error, setError] = useState("");
  const fileInputRef = useRef();
  const textareaRef = useRef();

  // Handle updates (live or manual)
  const doExtract = useCallback((txt) => {
    try {
      const out = extractKeywords(txt);
      setResults(out);
      setError("");
    } catch (e) {
      setResults([]);
      setError("Extraction error: " + (e?.message || "Unknown"));
    }
  }, []);

  function handleInputChange(e) {
    const val = e.target.value;
    setInput(val);
    if (auto) doExtract(val);
  }

  function handleExtractClick() {
    doExtract(input);
  }

  // Keyboard shortcut: Ctrl+Enter/⌘+Enter for manual trigger
  function handleKeyDown(e) {
    if (!auto && (e.ctrlKey || e.metaKey) && e.key === "Enter") {
      e.preventDefault();
      handleExtractClick();
    }
  }

  // Robust, safe JS/HTML/text file upload
  function handleUploadFile(e) {
    const file = e.target.files[0];
    if (!file) return;
    // 1MB body limit, can be tuned
    if (file.size > 1024 * 1024) {
      setError("File too large (limit: 1MB)");
      return;
    }
    if ((file.type && !file.type.startsWith("text/")) || /\.(exe|bin|dll|img|iso)$/i.test(file.name)) {
      setError("Binary file detected. Only JS/HTML/text accepted.");
      return;
    }
    const reader = new window.FileReader();
    reader.onload = evt => {
      const text = String(evt.target.result);
      // Detect binary by control chars
      if (/[\x00-\x08\x0E-\x1F]/.test(text)) {
        setError("Binary file detected. Only JS/HTML/text accepted.");
        return;
      }
      setInput(text);
      if (auto) doExtract(text);
      // clear input so same file can be selected again if needed
      if (fileInputRef.current) fileInputRef.current.value = "";
    };
    reader.onerror = () => setError("Failed to read file: " + file.name);
    reader.readAsText(file);
  }

  // Export - file type: txt (plain list), csv, or json
  function handleExport(type = "txt") {
    let blob, url, link;
    if (type === "csv") {
      const rows = [["Keyword","Score","Count"]];
      for (const row of results) rows.push([row.token, row.score, row.count]);
      const csv = rows.map(r => r.map(x => `"${String(x).replace(/"/g,'""')}"`).join(",")).join("\n");
      blob = new Blob([csv], { type:"text/csv" });
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
      // txt: just token list, one per line
      blob = new Blob([results.map(r=>r.token).join("\n")], { type: "text/plain" });
      url = URL.createObjectURL(blob);
      link = document.createElement("a");
      link.href = url;
      link.download = "wordlist.txt";
    }
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 150);
  }

  // Keyboard-accessible table nav
  function onTableKeyDown(e, idx) {
    if (!results.length) return;
    if ((e.key === "ArrowDown" && idx < results.length - 1) || (e.key === "ArrowUp" && idx > 0)) {
      const nextIdx = e.key === "ArrowDown" ? idx + 1 : idx - 1;
      const node = document.querySelector(`[data-rowidx="wordrow${nextIdx}"]`);
      if (node) node.focus();
      e.preventDefault();
    }
  }

  // Result stats/summary
  const hasResults = results.length > 0;
  const statsText = hasResults
    ? `Top ${results.length} keywords, ranked by frequency, context, and domain relevance.`
    : "(No relevant keywords found)";

  // Error overlay for visual feedback (modern)
  const errorAlert = error ? (
    <div className="alert alert-error" style={{
      marginBottom: 14,
      fontWeight: 600,
      color: "#ff545f",
      background: "#2b1014",
      border: "1px solid #902d2b"
    }}>
      <span role="alert" aria-live="assertive">{error}</span>
    </div>
  ) : null;

  return (
    <div>
      <div className="panel" style={{marginBottom:"32px"}}>
        <div className="panel-header" style={{display:"flex",alignItems:"center",gap:8}}>
          Wordlist Generator
          <span className="badge">TF-IDF</span>
          <span className="badge-faint">Modern Export</span>
        </div>
        <div className="description">
          Paste or upload JavaScript/HTML/text. <b>Extracts, ranks, and exports wordlists</b> from source via advanced heuristics.<br />
          <span style={{fontSize:"0.96em",color:"#ffc436"}}>
            Export as <b>TXT, CSV, or JSON</b> for dictionary/bruteforce use.
          </span>
        </div>
        <div style={{display:"flex",gap:24,flexWrap:"wrap"}}>
          <textarea
            ref={textareaRef}
            rows={11}
            style={{
              width: "100%",
              maxWidth: 650,
              background: "#24272f",
              fontFamily: "JetBrains Mono,monospace",
              fontSize:"1em"
            }}
            value={input}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder="Paste JS/HTML, code, or text here..."
            autoComplete="off"
            spellCheck={false}
            aria-label="Paste JS/HTML/code/text for wordlist extraction"
            aria-describedby="wordinput-desc"
          />
          <div style={{minWidth:210, maxWidth:330}}>
            <input
              ref={fileInputRef}
              type="file"
              accept=".js,.html,.txt"
              onChange={handleUploadFile}
              style={{
                marginBottom:"10px",
                background: "#181a20",
                color: "#fff",
                borderRadius:7,
                padding:"4px"
              }}
              aria-label="Upload JS/HTML/text file"
            />
            <div style={{marginBottom:7}}>
              <label style={{fontSize:"0.99em",color:"#ff9800",userSelect:"none"}}>
                <input
                  type="checkbox"
                  checked={auto}
                  onChange={e=>setAuto(e.target.checked)}
                  style={{marginRight:7}}
                  aria-checked={auto}
                  aria-label="Enable live extraction"
                />
                Auto Extract
              </label>
            </div>
            <button
              className="btn"
              style={{marginTop:"9px"}}
              onClick={handleExtractClick}
              disabled={auto}
              aria-label="Manual extract keywords"
            >
              Extract Now
            </button>
            <div style={{marginTop:15}}>
              <button className="btn btn-success" style={{marginBottom:8,marginRight:8}} onClick={()=>handleExport("txt")}>
                Export .txt
              </button>
              <button className="btn btn-ghost" style={{marginBottom:8, marginRight:8}} onClick={()=>handleExport("csv")}>
                Export CSV
              </button>
              <button className="btn btn-ghost" style={{marginBottom:8}} onClick={()=>handleExport("json")}>
                Export JSON
              </button>
            </div>
            {errorAlert}
            <div style={{marginTop:9}}>
              <div className="badge-faint" style={{fontWeight:420,fontSize:"0.97em",marginBottom:2,display:"inline-block"}}>
                <span>{statsText}</span>
              </div>
            </div>
            <div style={{marginTop:10, fontSize:"0.97em"}}>
              <span className="badge-faint" style={{fontWeight:420}}>CTRL+Enter</span>
              <span style={{color:"#babfc7"}}> Extract (manual mode)</span>
            </div>
          </div>
        </div>
      </div>
      <div className="panel" aria-labelledby="wordlist-table-header">
        <div className="panel-header" style={{display:"flex",alignItems:"center",gap:8}} id="wordlist-table-header">
          Ranked Keywords
          {hasResults && <span className="badge-faint">{results.length} Results</span>}
          <span className="badge-faint" style={{marginLeft:8}}>Offline</span>
        </div>
        <table
          className="table"
          style={{background:"#24272f",marginBottom:0,fontSize:"1em"}}
          aria-label="Ranked keywords for export"
          role="table"
        >
          <thead>
            <tr>
              <th scope="col" style={{minWidth:"110px"}}>Keyword</th>
              <th scope="col" style={{minWidth:"70px"}}>Score</th>
              <th scope="col" style={{minWidth:"50px"}}>Count</th>
            </tr>
          </thead>
          <tbody>
            {!hasResults && (
              <tr>
                <td colSpan={3} style={{ textAlign:"center", color: "#babfc7" }} tabIndex={0}>
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
                <td style={{fontWeight:600, color:"#ff9800"}}>{row.token}</td>
                <td style={{fontFamily:"JetBrains Mono,monospace",fontSize:"1em"}}>{row.score}</td>
                <td style={{fontFamily:"monospace",fontSize:"0.99em"}}>{row.count}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="description" style={{marginTop:"16px", color:"#babfc7"}}>
        <b>How it works:</b> Offline keyword extraction for attack wordlists. Strips boilerplate, ranks top tokens.<br />
        <span className="badge-faint">CSV, JSON, .txt export</span>
        <span className="badge-faint" style={{marginLeft:9}}>Premium UI</span>
        <span className="badge-faint" style={{marginLeft:9}}>Accessibility</span>
      </div>
    </div>
  );
}
