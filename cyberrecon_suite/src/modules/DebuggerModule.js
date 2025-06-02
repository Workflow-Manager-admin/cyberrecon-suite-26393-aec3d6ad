 /**
  * PUBLIC_INTERFACE
  * JS Debugger – Paste/upload JS/HTML, extract secrets/tokens/endpoints in real-time (production version).
  *
  * This is a robust, fully functional, client-side module that:
  * - Accepts pasted/uploaded JS, HTML, or text.
  * - Extracts secrets, API keys, tokens, endpoints, JWTs, and more (using RegEx).
  * - Provides live table updates, error feedback, and stats.
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
 `;
 
 // Robust, production-friendly RegEx extraction covering a range of token types
 function extractFindings(text) {
   // API keys (common providers)
   const apiKeys = [
     ...text.matchAll(/(sk_live_[\w-]{8,99})/gi),
     ...text.matchAll(/(?:api[_-]?key|access[_-]?key)[\"'\s:=]+([A-Za-z0-9_\-]{12,99})/gi),
   ].map(m => m[1]);
   // JWTs
   const jwts = [
     ...text.matchAll(/[A-Za-z0-9-_]{10,}\.[A-Za-z0-9-_]{10,}\.[A-Za-z0-9-_]{10,}/g)
   ].map(m => m[0]);
   // Bearer tokens
   const bearerTokens = [
     ...text.matchAll(/Bearer\s+([A-Za-z0-9\-\._~\+\/]+=*)/gi)
   ].map(m => m[1]);
   // Flags and secret constants
   const flags = [
     ...text.matchAll(/FLAG\{[A-Za-z0-9_:\-@!#\$%&\*\(\)]+\}/g),
     ...text.matchAll(/CTF\{[^\}]{4,100}\}/g)
   ].map(m => m[0]);
   // Password assignments (simple)
   const passwords = [
     ...text.matchAll(/password["'\s:=]+([^\s\"']{6,})/gi)
   ].map(m => m[1]);
   // Client/secret style tokens
   const genericSecrets = [
     ...text.matchAll(/client[_-]?secret["'\s:=]+([A-Za-z0-9_\-:%@!#\$&]{6,99})/gi),
     ...text.matchAll(/secret["'\s:=]+([A-Za-z0-9_\-:%@!#\$&]{8,99})/gi)
   ].map(m => m[1]);
   // Endpoints/URLs (http, ws, etc.)
   const urls = [
     ...text.matchAll(/https?:\/\/[\w\-:.]+(?:\/[\w\-\.~:/?#\[\]@!$&'()*+,;=%]*)?/gi),
     ...text.matchAll(/wss?:\/\/[^\s"'\\]+/gi)
   ].map(m => m[0]);
   // IPv4 endpoints (not localhost)
   const ips = [
     ...text.matchAll(/\b(?!127\.)(?:\d{1,3}\.){3}\d{1,3}:\d{2,6}\b/g)
   ].map(m => m[0]);
 
   // Remove empties and deduplicate each
   function dedupe(arr) { return Array.from(new Set(arr).values()).filter(Boolean); }
   const results = {
     "API Key": dedupe(apiKeys),
     "JWT": dedupe(jwts),
     "Bearer Token": dedupe(bearerTokens),
     "Secret Flag": dedupe(flags),
     "Password": dedupe(passwords),
     "Generic Secret": dedupe(genericSecrets),
     "Endpoint/URL": dedupe(urls),
     "IP Endpoint": dedupe(ips),
   };
   // Flatten for rendering: [{type, value}]
   const findings = [];
   for (const type in results) {
     results[type].forEach(val => {
       findings.push({ type, value: val });
     });
   }
   return { findings, summary: results };
 }
 
 export default function DebuggerModule() {
   const [input, setInput] = useState(DEMO_JS);
   const [auto, setAuto] = useState(true);
   const [findings, setFindings] = useState(() => extractFindings(DEMO_JS));
   const [error, setError] = useState("");
   const textareaRef = useRef();
 
   // Effectively react to input change for live update
   function updateFindings(newText) {
     try {
       const result = extractFindings(newText || "");
       setFindings(result);
       setError("");
     } catch (e) {
       setFindings({ findings: [], summary: {} });
       setError("Regex parsing error: " + e.message);
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
     // Limit max file size for client-side parsing (512KB)
     if (file.size > 512 * 1024) {
       setError("File too large (limit: 512KB)");
       return;
     }
     const isBinary = file.type && !file.type.startsWith("text/");
     const reader = new FileReader();
     reader.onload = evt => {
       const text = String(evt.target.result);
       // Check heuristically for binary content as well
       if (/[\x00-\x08\x0E-\x1F]/.test(text)) {
         setError("Binary file detected. Only text/JS/HTML files allowed.");
         return;
       }
       setInput(text);
       if (auto) updateFindings(text);
     };
     reader.onerror = () => setError("Failed to read file: " + file.name);
     reader.readAsText(file);
   }
 
   // Keyboard shortcut: Ctrl+Enter to extract in manual mode
   function handleKeyDown(e) {
     if (!auto && (e.ctrlKey || e.metaKey) && e.key === "Enter") {
       e.preventDefault();
       handleExtract();
     }
   }
 
   // Focus marking for accessibility
   function tableHighlight(rowIdx) {
     return { background: rowIdx % 2 === 0 ? "rgba(255,152,0,0.07)" : "#22272e" };
   }
 
   // Stats: Compute per-type counts
   const stats = Object.entries(findings.summary || {}).filter(([, vals]) => vals.length > 0);
 
   return (
     <div>
       <div className="panel" style={{ marginBottom: "34px" }}>
         <div className="panel-header" style={{display:"flex",alignItems:"center",gap:9}}>
           JS Debugger & Secret Extractor
           <span className="badge">Full</span>
           <span className="badge-faint">Production</span>
         </div>
         <div className="description">
           Paste, edit, or upload JS/HTML. <b>Auto-extracts secrets, tokens, endpoints</b> in real-time.<br/>
           <span style={{fontSize:"0.98em",color:"#ffc436"}}>Regex extraction covers keys, JWTs, Bearer tokens, passwords, flags, endpoints, and more.</span>
         </div>
         <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
           <textarea
             ref={textareaRef}
             rows={13}
             style={{ width: "100%", maxWidth: 690, background: "#24272f", fontFamily: "JetBrains Mono,monospace" }}
             value={input}
             onChange={handleChange}
             onKeyDown={handleKeyDown}
             placeholder="Paste or write JavaScript/HTML/code here..."
             autoComplete="off"
             spellCheck={false}
             aria-label="Source code input for extraction"
           />
           <div style={{minWidth:180, maxWidth:280}}>
             <input
               type="file"
               accept=".js,.html,.txt"
               onChange={handleUploadFile}
               style={{
                 marginBottom:"10px",
                 background: "#181a20",
                 color:"#fff",
                 borderRadius:6,
                 padding:"4px"
               }}
               aria-label="Upload JS or HTML file for analysis"
             />
             <div style={{marginBottom:8}}>
               <label style={{ fontSize: "0.99em", color: "#ff9800", userSelect:"none" }}>
                 <input
                   type="checkbox"
                   checked={auto}
                   onChange={e => setAuto(e.target.checked)}
                   style={{ marginRight: 7 }}
                   aria-checked={auto}
                 />
                 Auto Extract
               </label>
             </div>
             <button className="btn" style={{ marginTop: "9px" }} onClick={handleExtract} disabled={auto}>
               Extract Now
             </button>
             <div style={{marginTop: 11,fontSize:"0.96em", color:"#ff3333"}}>
               {error && <span>{error}</span>}
             </div>
             <div style={{marginTop: auto ? 15 : 19}}>
               <div className="badge-faint" style={{fontSize:"0.97em",fontWeight:420,marginBottom: 3, display: "inline-block"}}>
                 <b>Stats:</b>{' '}
                 {stats.length === 0
                   ? <span style={{color:"#babfc7"}}>(No secrets/tokens/endpoints found)</span>
                   : stats.map(([type, vals]) => (
                       <span key={type} style={{marginRight:"13px",color:"#ffa726"}}>
                         {type}: <span style={{color:"#fff"}}>{vals.length}</span>
                       </span>
                     ))}
               </div>
             </div>
             <div style={{marginTop:15}}>
               <span className="badge-faint" style={{fontWeight:420,fontSize:"0.97em"}}>CTRL+Enter</span> <span style={{color:"#babfc7"}}>Extract (manual mode)</span>
             </div>
           </div>
         </div>
       </div>
       <div className="panel">
         <div className="panel-header" style={{display:"flex",alignItems:"center",gap:8}}>
           Extracted Findings
           {findings.findings.length > 0 && (
             <span className="badge-faint">{findings.findings.length} Results</span>
           )}
         </div>
         <table className="table" style={{background:"#24272f",marginBottom:0, fontSize:"1em"}}>
           <thead>
             <tr>
               <th>Type</th>
               <th>Secret/Endpoint/Token</th>
             </tr>
           </thead>
           <tbody>
             {findings.findings.length === 0 && (
               <tr>
                 <td colSpan={2} style={{ textAlign:"center", color: "#babfc7"}}>
                   (No secrets/tokens/endpoints found)
                 </td>
               </tr>
             )}
             {findings.findings.map(({type, value}, idx) => (
               <tr
                 key={type+value+idx}
                 tabIndex={0}
                 aria-label={type + " " + value}
                 style={tableHighlight(idx)}
               >
                 <td style={{fontWeight:600,color:"#ff9800"}}>{type}</td>
                 <td style={{fontFamily:"monospace",fontSize:"1em",wordBreak:"break-all"}}>{value}</td>
               </tr>
             ))}
           </tbody>
         </table>
       </div>
       <div className="description" style={{marginTop:"18px", color:"#babfc7"}}>
         <b>How it works:</b> Regex-based extraction for popular API keys/tokens, endpoints, passwords, JWTs, secrets, and more.<br />
         <span className="badge-faint" style={{ marginLeft: 7 }}>
           Full parsing engine & source mapping planned for next releases!
         </span>
       </div>
     </div>
   );
 }
