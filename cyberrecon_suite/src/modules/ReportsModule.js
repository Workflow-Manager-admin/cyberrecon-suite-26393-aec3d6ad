/**
 * PUBLIC_INTERFACE
 * Report Generator – Professional Markdown editor w/ live preview, screenshot upload, findings insert, PDF/HTML export.
 */
import React, { useState, useRef } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { getSessions } from "./utils/ipcSession";
import { extractFindings } from "./DebuggerModule";
import * as htmlToImage from "html-to-image";
import jsPDF from "jspdf";

const DEFAULT_MD = `# Vulnerability Report: Demo App

## Executive Summary

This penetration test discovered several key findings that require attention.

## Findings

- [x] Login page reveals admin user
- [x] JS file leaks API secrets
- [ ] SQLi attempt failed (rate limited)

> _Proof of concept snippets below._

\`\`\`http
POST /api/login
Content-Type: application/json

{"user":"admin", "pass":"admin123"}
\`\`\`
`;

const findingSnippets = [
  {
    key: "login",
    label: "Login page credential finding",
    snippet:
      "- [x] Login page reveals admin user (credentials can be brute-forced)\n\n```http\nPOST /api/login\nContent-Type: application/json\n\n{\"user\":\"admin\", \"pass\":\"admin123\"}\n```"
  },
  {
    key: "js-leak",
    label: "JS file leaks API secrets",
    snippet:
      "- [x] JS file contains API secret leak\n\n```javascript\n// main.js\nconst SECRET_KEY = 'sk_live_xxxx';\n```"
  },
  {
    key: "sql-rate",
    label: "SQL Injection detected but rate limited",
    snippet: "- [ ] SQLi attempt failed (rate limited)\n"
  }
];

export default function ReportsModule() {
  const [md, setMd] = useState(DEFAULT_MD);
  const [images, setImages] = useState([]); // uploaded images: { name, url }
  const [exporting, setExporting] = useState(false);
  const [importLoading, setImportLoading] = useState(false);
  const [importError, setImportError] = useState("");
  const fileInputRef = useRef();
  const previewRef = useRef();

  // Handle image upload for screenshot embedding (dataURL for local/offline preview)
  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      alert("Image too large (max 2MB)");
      return;
    }
    if (!/^image\//.test(file.type)) {
      alert("Invalid file type");
      return;
    }
    const reader = new window.FileReader();
    reader.onload = evt => {
      setImages(imgs => [...imgs, { name: file.name, url: evt.target.result }]);
    };
    reader.readAsDataURL(file);
  };

  // Insert image markdown at cursor
  function insertImageMarkdown(imgIdx) {
    if (imgIdx >= 0 && images[imgIdx]) {
      const img = images[imgIdx];
      const textarea = document.getElementById("cybr-md-input");
      if (textarea) {
        const { selectionStart, selectionEnd } = textarea;
        const before = md.slice(0, selectionStart);
        const after = md.slice(selectionEnd);
        const newMd =
          before + `\n![${img.name}](${img.url})\n` + after;
        setMd(newMd);
        setTimeout(() => {
          textarea.focus();
          textarea.selectionStart = textarea.selectionEnd = before.length + `\n![${img.name}](${img.url})\n`.length;
        }, 1);
      } else {
        setMd(md + `\n![${img.name}](${img.url})\n`);
      }
    }
  }

  // Insert a finding snippet
  function insertFindingSnippet(snippet) {
    const textarea = document.getElementById("cybr-md-input");
    if (textarea) {
      const { selectionStart, selectionEnd } = textarea;
      const before = md.slice(0, selectionStart);
      const after = md.slice(selectionEnd);
      const newMd = before + "\n" + snippet + "\n" + after;
      setMd(newMd);
      setTimeout(() => {
        textarea.focus();
        textarea.selectionStart = textarea.selectionEnd = before.length + snippet.length + 2;
      }, 1);
    } else {
      setMd(md + "\n" + snippet);
    }
  }

  // Async findings import from session cache (scan/recon)
  async function importSessionFindings() {
    setImportLoading(true);
    setImportError("");
    // Try scan sessions first, then recon if none
    let sessions = [];
    try {
      let resp = await getSessions({ type: "scan", limit: 3 });
      if (resp.success && Array.isArray(resp.sessions) && resp.sessions.length) {
        sessions = resp.sessions;
      } else {
        resp = await getSessions({ type: "recon", limit: 3 });
        if (resp.success && Array.isArray(resp.sessions) && resp.sessions.length) {
          sessions = resp.sessions;
        }
      }
    } catch (e) {
      setImportLoading(false);
      setImportError("Failed to load sessions.");
      return;
    }
    if (!sessions.length) {
      setImportLoading(false);
      setImportError("No scan/recon findings in local session cache.");
      return;
    }
    // Try to extract findings from the most recent session(s)
    let findingsLines = [];
    for (const sess of sessions) {
      let src = "";
      if (typeof sess.data === "object") {
        // Try stdout, input, or similar fields
        if (sess.data.stdout && typeof sess.data.stdout === "string") src = sess.data.stdout;
        else if (sess.data.input && typeof sess.data.input === "string") src = sess.data.input;
        else if (sess.data.text && typeof sess.data.text === "string") src = sess.data.text;
        // If full scan output present, this will find
      }
      if (src && src.length > 12) {
        // Results: extractFindings always returns {findings:[], summary:{}}
        try {
          const result = extractFindings(src);
          if (Array.isArray(result.findings) && result.findings.length > 0) {
            for (const f of result.findings) {
              findingsLines.push(`- [ ] [${f.type}] ${f.value}`);
            }
          }
        } catch (e) {
          // Swallow parsing errors per session
        }
      }
    }
    if (!findingsLines.length) {
      setImportError("No findings found in recent sessions.");
    } else {
      insertFindingSnippet(findingsLines.join("\n"));
    }
    setImportLoading(false);
  }

  // Export HTML/PDF using premium tools if possible, else fallback
  async function handleExport(type) {
    setExporting(true);
    // HTML export is always available
    if (type === "html") {
      // Export from the live preview, includes rendered markdown and theme
      const html = `
        <!DOCTYPE html>
        <html><head>
          <meta charset="utf-8">
          <title>CyberRecon Report</title>
          <style>
            body { background: #181a20; color: #fff; font-family: 'Inter', 'sans-serif'; padding: 0 20px 20px 20px;}
            h1,h2,h3 { color: #ff9800; }
            pre { background: #232130; color: #feedb9; border-radius: 5px; border: 1px solid #333; padding:9px 13px;}
            code { background: #232130; color: #ffca80; border-radius: 4px; padding: 0.1em 0.45em;}
            blockquote { color: #ffa726; background: #24272f; padding: 6px 15px; border-left: 3px solid #ffa726; margin: 9px 2px;}
            ul,ol { margin-bottom:1.7em;}
            img { max-width: 460px;}
          </style>
        </head><body>
          <div id="cybr-md-html-export">
            ${document.getElementById("cybr-md-preview")?.innerHTML || ""}
          </div>
        </body></html>
      `;
      const blob = new Blob([html], { type: "text/html" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "cyberrecon-report.html";
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 80);
    } else if (type === "pdf") {
      // Try to render the preview panel into a PDF.
      const previewNode = document.getElementById("cybr-md-preview");
      if (previewNode) {
        try {
          const imgData = await htmlToImage.toPng(previewNode, { backgroundColor: "#181a20" });
          const pdf = new jsPDF({
            orientation: "p",
            unit: "pt",
            format: "a4"
          });
          // Fit image into A4: scale
          const width = 580;
          pdf.addImage(imgData, "PNG", 18, 18, width, 720, undefined, "FAST");
          pdf.save("cyberrecon-report.pdf");
        } catch (err) {
          window.alert("PDF export failed. Try using browser Print as fallback.");
          setTimeout(() => window.print(), 180);
        }
      } else {
        window.alert("PDF export unavailable. Try using Print as fallback.");
        setTimeout(() => window.print(), 180);
      }
    }
    setExporting(false);
  }

  return (
    <div>
      <div className="panel" style={{ marginBottom: 32, maxWidth: 1200, marginLeft: "auto", marginRight: "auto" }}>
        <div className="panel-header" style={{display:"flex",alignItems:"center",gap:12}}>
          Report Generator
          <span className="badge">Modern</span>
          <span className="badge-faint">Premium</span>
        </div>
        <div className="description">
          Write pentest findings with advanced Markdown editor. Live preview, screenshot/image uploads, auto-insert findings, export.
        </div>
        <div style={{ display: "flex", gap: 38, flexWrap: "wrap", alignItems: "stretch" }}>
          <div style={{ flex: 1.5, minWidth: 370, maxWidth: 580, display: "flex", flexDirection: "column" }}>
            <textarea
              id="cybr-md-input"
              rows={17}
              style={{
                width: "100%",
                minHeight: 340,
                flex: "1 1 300px",
                background: "#23272e",
                borderRadius: 7,
                fontFamily: "JetBrains Mono,monospace",
                fontSize: "1.06em",
                marginBottom: 8,
                padding: "13px"
              }}
              value={md}
              onChange={e => setMd(e.target.value)}
              placeholder="Write your pentest report using Markdown..."
              autoComplete="off"
              spellCheck={false}
              aria-label="Write report markdown"
            />
            {/* Utility bar below editor */}
            <div style={{ display: "flex", gap: 13, alignItems: "center", minHeight: 36 }}>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleImageUpload}
                style={{
                  fontSize: "1em",
                  background: "#181a20",
                  color: "#fff",
                  borderRadius: 5,
                  border: "1px solid #433",
                  minWidth: "110px"
                }}
                aria-label="Upload screenshot/image for your report"
              />
              <button
                className="btn btn-ghost"
                style={{marginRight:8, fontWeight:500, fontSize:"0.96em", minWidth:124}}
                onClick={importSessionFindings}
                disabled={importLoading}
                type="button"
                aria-label="Auto-import findings from session cache"
                title="Auto-import findings from recent scan or recon sessions"
              >
                {importLoading ? "Importing..." : "Auto-Import Findings"}
              </button>
              {importError && <span className="text-error" style={{fontSize:"0.98em"}}>{importError}</span>}
              {/* Quick snippets insert */}
              <div style={{display:"flex",gap:7}}>
                {findingSnippets.map(f => (
                  <button
                    key={f.key}
                    className="btn btn-ghost"
                    style={{fontSize:"0.96em",marginLeft:2}}
                    type="button"
                    onClick={() => insertFindingSnippet(f.snippet)}
                  >
                    +{f.label}
                  </button>
                ))}
              </div>
            </div>
            {/* Uploaded images inline for access */}
            {images.length > 0 && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginTop: 7 }}>
                {images.map((img, idx) => (
                  <div key={img.name + idx} style={{background:"#232130",borderRadius:6,padding:7}}>
                    <img src={img.url} alt={img.name} style={{maxWidth:"84px", maxHeight:"84px", borderRadius:4, display:"block",marginBottom:3}} />
                    <button
                      className="btn btn-ghost"
                      style={{fontSize:"0.91em",margin:"0 auto"}}
                      type="button"
                      onClick={() => insertImageMarkdown(idx)}
                    >Insert</button>
                  </div>
                ))}
              </div>
            )}
          </div>
          {/* Live preview pane, modern ReactMarkdown + theme */}
          <div style={{ flex: 2, minWidth: 290, background: "#1a1a1a", borderRadius: 7, padding: 21, marginLeft:10 }}>
            <div className="section-subtitle" style={{ marginBottom: 11 }}>
              Live Preview
            </div>
            <div
              id="cybr-md-preview"
              className="codearea"
              ref={previewRef}
              style={{
                minHeight: 260,
                maxHeight: 520,
                background: "#232130",
                fontFamily: "inherit",
                overflowY: "auto",
                border: "1.5px solid #3d414b"
              }}
            >
              <ReactMarkdown
                children={md}
                remarkPlugins={[remarkGfm]}
                components={{
                  code({node, inline, className, children, ...props}) {
                    return !inline
                      ? <pre {...props} style={{background:'#232130', color:'#feedb9', borderRadius:5, padding:'9px 13px', margin:'8px 0', fontFamily:'JetBrains Mono,monospace', fontSize:'1em'}}>{children}</pre>
                      : <code {...props} style={{background:'#232130', color:'#ffca80', borderRadius:4, padding:'0.1em 0.4em'}}>{children}</code>;
                  },
                  blockquote({ children, ...props }) {
                    return <blockquote {...props} style={{color:'#ffa726', background:'#24272f', padding:'6px 15px', borderLeft:'3px solid #ffa726', margin:'9px 2px'}}>{children}</blockquote>;
                  },
                  img(props) {
                    return <img {...props} style={{maxWidth:"100%", borderRadius:4}} alt={props.alt || "screenshot"} />;
                  },
                  // Other elements could be themed further here
                }}
              />
            </div>
            {/* Display embedded images only (for offline preview, not PDF/HTML) */}
            {images.length > 0 && (
              <div style={{ marginTop: 20 }}>
                <b style={{ color: "#ffa726" }}>Screenshots:</b>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 14 }}>
                  {images.map((img, idx) => (
                    <img key={"imgpre-" + idx} src={img.url} alt={img.name} style={{ maxWidth: "120px", borderRadius: 4 }} />
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
        {/* Export Buttons */}
        <div style={{ marginTop: "15px", textAlign: "right" }}>
          <button className="btn btn-success" onClick={() => handleExport("html")} disabled={exporting}>
            {exporting ? "Exporting..." : "Export HTML"}
          </button>
          <button
            className="btn btn-ghost"
            style={{ marginLeft: "11px" }}
            onClick={() => handleExport("pdf")}
            title="Export PDF"
            disabled={exporting}
          >
            Export PDF
          </button>
        </div>
      </div>
      {/* Help/Explanation */}
      <div className="panel" style={{marginBottom:0}}>
        <div className="panel-header">Tips &amp; Features</div>
        <ul style={{color:"#babfc7",fontSize:"1.02em"}}>
          <li>Use <span className="badge-faint">Markdown</span> for formatting code, lists, links, tables.</li>
          <li>Upload screenshots/images. Click <b>Insert</b> to embed them into your report.</li>
          <li>Auto-import findings from recent modules or use instant snippets.</li>
          <li style={{marginTop:8}}>Export your report as <span className="badge-faint">HTML</span> or <span className="badge-faint">PDF</span>.</li>
        </ul>
      </div>
      <div className="description" style={{ marginTop: 14, color: "#babfc7" }}>
        <b>How it works:</b> Write reports in Markdown, insert screenshots, import findings from other modules, preview instantly, export as HTML/PDF.<br />
        <span className="badge-faint">Premium UI</span>
        <span className="badge-faint" style={{ marginLeft: 9 }}>Feature Roadmap</span>
      </div>
    </div>
  );
}
