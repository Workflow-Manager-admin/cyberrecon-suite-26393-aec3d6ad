 /**
  * PUBLIC_INTERFACE
  * JS Debugger – Paste/upload JS/HTML, extract secrets/tokens/endpoints in real-time (advanced version).
  *
  * Robust client-side regex-based extractor scanning JS/HTML/text for secrets, API keys, tokens, endpoints, JWTs, etc.
  * - Accepts pasted/uploaded code, live updates table with results as the code changes.
  * - Handles large files (limits), binary/edge cases, errors and accessibility.
  * - Polished UI for clarity, accessibility, focus management.
  */
 import React, { useState, useRef } from "react";

 // Demo input for onboarding users
 const DEMO_JS = `
 // Paste JS/HTML containing secrets, tokens, endpoints, etc.
 let apiKey = "sk_live_a1b2c3d4-example";
 const jwt = "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJ1c2VyIjoidGVzdCJ9.mU5WwzABEXAMPLETOKEN123456";
 window.endpointUrl = "https://api.bugsite.com/data";
 const secret = "FLAG{hardcoded_1234}";
 let bearer = "Bearer abcd1234EFGH.ijklmnopqrstUVWX5678_982345";
 const password = "UltraSecret!@#";
 const client_secret = "srn:***:my-prod-SECRET-12";
 // GCP: "AIzaSyA2QHFT4AFiAiSX1TQBcEXAMPLEKEY"
 // AWS AKIAEXAMPLEAKIA, amzn secret = "wJalrXUtnFEMI/K7MDENG/bPxRfiCYzEXAMPLEKEY"
 `;

 // Regex patterns for various secrets/tokens (expandable/configurable)
 const REGEX_PATTERNS = [
   // API keys for major platforms, basic generic
   { type: "API Key", re: /(sk_live_[\w-]{10,99})/gi },         // Stripe, etc.
   { type: "API Key", re: /AIza[0-9A-Za-z\-_]{35,}/g },         // Google API Key
   { type: "API Key", re: /(AKIA[0-9A-Z]{16})/g },              // AWS Access Key
   { type: "API Key", re: /(?:api[_-]?key|access[_-]?key)['":=\s]+([A-Za-z0-9_\-]{14,100})/gi },
   // JWT
   { type: "JWT", re: /([A-Za-z0-9-_]{10,}\.[A-Za-z0-9-_]{10,}\.[A-Za-z0-9-_]{10,})/g },
   // Bearer
   { type: "Bearer Token", re: /Bearer\s+([A-Za-z0-9\-\._~\+\/]+=*)/gi },
   // Secret/Flag
   { type: "Secret Flag", re: /FLAG\{[A-Za-z0-9_:\-@!#\$%&\*\(\)]+\}/g },
   { type: "Secret Flag", re: /CTF\{[^\}]{4,100}\}/g },
   // Password
   { type: "Password", re: /password["'\s:=]+([^\s"']{6,})/gi },
   // AWS secret key
   { type: "Generic Secret", re: /(?:aws)?_?secret['":\s=]+([A-Za-z0-9\/\+\=]{20,100})/gi },
   // Generic secret tokens ("client_secret" etc)
   { type: "Generic Secret", re: /client[_-]?secret["'\s:=]+([A-Za-z0-9_\-:%@!#\$&]{8,99})/gi },
   { type: "Generic Secret", re: /secret["'\s:=]+([A-Za-z0-9_\-:%@!#\$&]{8,99})/gi },
   // Endpoints / URLs
   { type: "Endpoint/URL", re: /https?:\/\/[\w\-:.]+(?:\/[\w\-\.~:/?#\[\]@!$&'()*+,;=%]*)?/gi },
   { type: "Endpoint/URL", re: /wss?:\/\/[^\s"\'\\]+/gi },
   // IP/Ports (exclude local addresses)
   { type: "IP Endpoint", re: /\b(?!127\.|10\.|192\.168\.|172\.(?:1[6-9]|2[0-9]|3[0-1])\.)(?:\d{1,3}\.){3}\d{1,3}:\d{2,6}\b/g }
 ];

 // PUBLIC_INTERFACE
 function extractFindings(text) {
   // Map to sets for deduplication
   const res = {};
   for (const pat of REGEX_PATTERNS) {
     if (!res[pat.type]) res[pat.type] = new Set();
     for (const match of text.matchAll(pat.re)) {
       // Prefer group result if present; else match[0]
       res[pat.type].add(match[1] || match[0]);
     }
   }
   // Strip empties/dupes per type
   const summary = {};
   for (const [type, set] of Object.entries(res)) {
     const vals = Array.from(set.values()).filter(Boolean);
     summary[type] = vals;
   }
   // Flatten findings as table rows
   const findings = [];
   for (const type in summary) {
     summary[type].forEach(val => findings.push({ type, value: val }));
   }
   return { findings, summary };
 }

 export default function DebuggerModule() {
   const [input, setInput] = useState(DEMO_JS);
   const [auto, setAuto] = useState(true);
   const [findings, setFindings] = useState(() => extractFindings(DEMO_JS));
   const [error, setError] = useState("");
   const textareaRef = useRef();
   const fileInputRef = useRef();

   // Controlled textarea update (live or manual)
   function updateFindings(newText) {
     try {
       const result = extractFindings(newText || "");
       setFindings(result);
       setError("");
     } catch (e) {
       setFindings({ findings: [], summary: {} });
       setError("Regex parsing error: " + (e?.message || "Unknown error"));
     }
   }

   function handleChange(e) {
     setInput(e.target.value);
     if (auto) updateFindings(e.target.value);
   }

   function handleExtract() {
     updateFindings(input);
   }

   function handleUploadFile(e) {
     const file = e.target.files[0];
     if (!file) return;
     // Limit max file size (768KB for safety; adjust as needed)
     if (file.size > 768 * 1024) {
       setError("File too large (limit: 768KB)");
       return;
     }
     // Detect binary (by "application/*" non-text type or by sniff)
     if ((file.type && !file.type.startsWith("text/")) || /\.(exe|bin|dll|img|iso)$/i.test(file.name)) {
       setError("Binary file detected. Only JS/HTML/text files are allowed.");
       return;
     }
     const reader = new window.FileReader();
     reader.onload = evt => {
       const text = String(evt.target.result);
       if (/[\x00-\x08\x0E-\x1F]/.test(text)) {
         setError("Binary file detected. Only JS/HTML/text files are allowed.");
         return;
       }
       setInput(text);
       if (auto) updateFindings(text);
       // Clear file input so same file can be selected again
       if (fileInputRef.current) fileInputRef.current.value = "";
     };
     reader.onerror = () => setError("Failed to read file: " + file.name);
     reader.readAsText(file);
   }

   // Keyboard shortcut: Ctrl+Enter/⌘+Enter runs extraction (manual mode)
   function handleKeyDown(e) {
     if (!auto && (e.ctrlKey || e.metaKey) && e.key === "Enter") {
       e.preventDefault();
       handleExtract();
     }
   }

   // Visually highlight rows, add ARIA attributes for accessibility
   function tableHighlight(rowIdx) {
     return { background: rowIdx % 2 === 0 ? "rgba(255,152,0,0.07)" : "#22272e" };
   }

   // Stats: Only show counts where relevant
   const stats = Object.entries(findings.summary || {}).filter(([, vals]) => vals.length > 0);

   // Focus management for table
   function onTableKeyDown(e, idx) {
     if (!findings.findings.length) return;
     if ((e.key === "ArrowDown" && idx < findings.findings.length - 1) ||
         (e.key === "ArrowUp" && idx > 0)) {
       const nextIdx = e.key === "ArrowDown" ? idx + 1 : idx - 1;
       const node = document.querySelector(`[data-rowidx="${nextIdx}"]`);
       if (node) node.focus();
       e.preventDefault();
     }
   }

   return (
     <div>
       <div className="panel" style={{ marginBottom: "34px" }}>
         <div className="panel-header" style={{display:"flex",alignItems:"center",gap:9}}>
           JS Debugger & Secret Extractor
           <span className="badge">Full</span>
           <span className="badge-faint">Advanced</span>
         </div>
         <div className="description">
           Paste, edit, or upload JS/HTML. <b>Auto-extracts secrets, tokens, endpoints</b> in real time.<br />
           <span style={{fontSize:"0.98em",color:"#ffc436"}}>
             Regex covers cloud/API keys, JWTs/tokens, passwords, flags, endpoints, and much more.
           </span>
         </div>
         <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
           <textarea
             ref={textareaRef}
             rows={14}
             style={{
               width: "100%",
               maxWidth: 700,
               background: "#24272f",
               fontFamily: "JetBrains Mono,monospace",
               fontSize:"1em"
             }}
             value={input}
             onChange={handleChange}
             onKeyDown={handleKeyDown}
             placeholder="Paste or write JavaScript/HTML/code here..."
             autoComplete="off"
             spellCheck={false}
             aria-label="Source code input for secrets extraction"
             aria-describedby="srcinput-desc"
           />
           <div style={{minWidth:185, maxWidth:290}}>
             <input
               ref={fileInputRef}
               type="file"
               accept=".js,.html,.jsx,.txt"
               onChange={handleUploadFile}
               style={{
                 marginBottom:"10px",
                 background: "#181a20",
                 color:"#fff",
                 borderRadius:6,
                 padding:"4px"
               }}
               aria-label="Upload JS/HTML/text file for extraction"
             />
             <div style={{marginBottom:8}}>
               <label style={{ fontSize: "0.99em", color: "#ff9800", userSelect:"none" }}>
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
               aria-label="Manual extract secrets/tokens"
             >
               Extract Now
             </button>
             <div style={{marginTop: 11,fontSize:"0.96em", color:"#ff3333"}}>
               {error && <span role="alert" aria-live="assertive">{error}</span>}
             </div>
             <div style={{marginTop: auto ? 15 : 19}}>
               <div className="badge-faint" style={{fontSize:"0.97em",fontWeight:420,marginBottom:3,display:"inline-block"}}>
                 <b>Stats:</b>{" "}
                 {stats.length === 0
                   ? <span style={{color:"#babfc7"}}>(No secrets/tokens/endpoints found)</span>
                   : stats.map(([type, vals]) => (
                     <span key={type} style={{marginRight:"13px",color:"#ffa726"}}>
                       {type}: <span style={{color:"#fff"}}>{vals.length}</span>
                     </span>
                   ))}
               </div>
             </div>
             <div style={{marginTop:15, fontSize:"0.97em"}}>
               <span className="badge-faint" style={{fontWeight:420}}>CTRL+Enter</span>
               <span style={{color:"#babfc7"}}> Extract (manual mode)</span>
             </div>
           </div>
         </div>
       </div>
       <div className="panel" tabIndex={0} aria-labelledby="findings-table-header">
         <div className="panel-header" style={{display:"flex",alignItems:"center",gap:8}} id="findings-table-header">
           Extracted Findings
           {findings.findings.length > 0 && (
             <span className="badge-faint">{findings.findings.length} Results</span>
           )}
         </div>
         <table
           className="table"
           style={{background:"#24272f",marginBottom:0, fontSize:"1em"}}
           aria-label="Extracted secrets and endpoints"
           role="table"
         >
           <thead>
             <tr>
               <th>Type</th>
               <th>Secret/Endpoint/Token</th>
             </tr>
           </thead>
           <tbody>
             {findings.findings.length === 0 && (
               <tr>
                 <td colSpan={2} style={{ textAlign:"center", color: "#babfc7"}} tabIndex={0}>
                   (No secrets/tokens/endpoints found)
                 </td>
               </tr>
             )}
             {findings.findings.map(({type, value}, idx) => (
               <tr
                 key={type + value + idx}
                 tabIndex={0}
                 aria-label={type + ": " + value}
                 data-rowidx={idx}
                 style={tableHighlight(idx)}
                 onKeyDown={e => onTableKeyDown(e, idx)}
               >
                 <td style={{fontWeight:600, color:"#ff9800"}}>{type}</td>
                 <td style={{fontFamily:"monospace",fontSize:"1em",wordBreak:"break-all"}}>{value}</td>
               </tr>
             ))}
           </tbody>
         </table>
       </div>
       <div className="description" style={{marginTop:"18px", color:"#babfc7"}}>
         <b>How it works:</b> Robust pattern matching with advanced regular expressions for popular API keys/tokens,
         JWTs, passwords, flags, endpoints, and more. All code analysis is done client-side in the browser for privacy.<br />
         <span className="badge-faint" style={{ marginLeft: 7 }}>
           Syntax-aware parsing, entropy warnings, and advanced source mapping coming soon!
         </span>
       </div>
     </div>
   );
 }
