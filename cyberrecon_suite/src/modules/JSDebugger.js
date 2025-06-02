 /**
  * PUBLIC_INTERFACE
  * JS Debugger (Premium) – Paste/upload JS/HTML, extract secrets/tokens/endpoints demo.
  * Modern, dark, premium layout, visually consistent with suite.
  */
import React, { useState } from "react";

const DEMO_JS = `
// Example JS to demo extraction
var apiKey = "sk_live_EXAMPLE1234";
window.endpointUrl = "https://api.bugsite.com/data";
const secret = "FLAG{hardcoded_1234}";
`;

function extractDemoFindings(text) {
  const apiKeys = [...text.matchAll(/(sk_live_[\w\d]+)/gi)].map(m => m[1]);
  const flags = [...text.matchAll(/FLAG\{[A-Za-z0-9_]+\}/g)].map(m => m[0]);
  const urls = [
    ...text.matchAll(
      /https?:\/\/(?:[\w-]+\.)+[a-z]{2,}(?::\d{1,5})?\/[\w\-\.\/?%&=]*/gi
    )
  ].map(m => m[0]);
  return { apiKeys, flags, urls };
}

export default function JSDebugger() {
  const [input, setInput] = useState(DEMO_JS);
  const [extracted, setExtracted] = useState(() => extractDemoFindings(DEMO_JS));
  const [auto, setAuto] = useState(true);

  function handlePaste(e) {
    setInput(e.target.value);
    if (auto) setExtracted(extractDemoFindings(e.target.value));
  }

  function handleUpload(e) {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = evt => {
        setInput(evt.target.result);
        if (auto) setExtracted(extractDemoFindings(evt.target.result));
      };
      reader.readAsText(file);
    }
  }

  function handleExtract() {
    setExtracted(extractDemoFindings(input));
  }

  return (
    <div>
      <div className="panel" style={{marginBottom:"34px"}}>
        <div className="panel-header" style={{display:"flex", alignItems:"center", gap:9}}>
          JS Debugger & Secret Extractor <span className="badge">Beta</span><span className="badge-faint">Premium</span>
        </div>
        <div className="description">
          Paste, edit, or upload JS/HTML. Auto-extract secrets, tokens, endpoints.
        </div>
        <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
          <textarea
            rows={11}
            style={{ width: "100%", maxWidth: 600, background: "#24272f" }}
            value={input}
            onChange={handlePaste}
            placeholder="Paste or write JavaScript/HTML code here..."
            autoComplete="off"
          />
          <div style={{minWidth:180}}>
            <input
              type="file"
              accept=".js,.html,.txt"
              onChange={handleUpload}
              style={{
                marginBottom:"10px",
                background: "#181a20",
                color:"#fff"
              }}
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
        <div className="panel-header">Extracted Findings <span className="badge-faint" style={{marginLeft:8}}>Demo</span></div>
        <table className="table" style={{background:"#24272f",marginBottom:0}}>
          <thead>
            <tr>
              <th>Type</th>
              <th>Value</th>
            </tr>
          </thead>
          <tbody>
            {[...extracted.apiKeys.map(key => ["API Key", key]),
              ...extracted.flags.map(f => ["Secret Flag", f]),
              ...extracted.urls.map(u => ["Endpoint", u])
            ].length === 0 && (
              <tr><td colSpan={2} style={{ textAlign:"center", color: "#babfc7"}}>(No secrets/tokens found)</td></tr>
            )}
            {[...extracted.apiKeys.map(key => ["API Key", key]),
              ...extracted.flags.map(f => ["Secret Flag", f]),
              ...extracted.urls.map(u => ["Endpoint", u])
            ].map(([type, val], idx) => (
              <tr key={type+val+idx}>
                <td style={{fontWeight:600,color:"#ff9800"}}>{type}</td>
                <td style={{fontFamily:"monospace",fontSize:"1em",wordBreak:"break-all"}}>{val}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="description" style={{marginTop:"18px", color:"#babfc7"}}>
        <b>How it works –</b> Extracts API keys, secrets, and endpoints (Regex). <span className="badge-faint" style={{ marginLeft: 9 }}>Premium UI</span>
        <br />
        <span className="badge-faint" style={{ marginLeft: 7 }}>Full parsing engine & source mapping in roadmap!</span>
      </div>
    </div>
  );
}
