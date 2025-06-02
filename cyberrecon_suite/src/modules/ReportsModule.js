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

// Get session findings from the Debugger, Wordlist or other modules
// For now, stub as "demo findings" unless backend sharing is implemented
function getModuleFindings() {
  return [
    "- [ ] Exposed token found in main.js",
    "- [ ] Admin endpoint accessible"
  ];
}

export default function ReportsModule() {
  const [md, setMd] = useState(DEFAULT_MD);
  const [images, setImages] = useState([]); // local images for preview/uploaded
  const [exporting, setExporting] = useState(false);
  const fileInputRef = useRef();

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
      // Insert ![imageName](blob...) at caret if desirable
    };
    reader.readAsDataURL(file);
  };

  // Insert image markdown at cursor (optional)
  function insertImageMarkdown(imgIdx) {
    if (imgIdx >= 0 && images[imgIdx]) {
      const img = images[imgIdx];
      // Insert ![Screenshot](img.url) at the cursor in textarea
      const textarea = document.getElementById("cybr-md-input");
      if (textarea) {
        const { selectionStart, selectionEnd } = textarea;
        const before = md.slice(0, selectionStart);
        const after = md.slice(selectionEnd);
        const newMd =
          before + `\n![${img.name}](${img.url})\n` + after;
        setMd(newMd);
        // Focus and set caret after the image markdown
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

  // Insert findings table from other modules (stub/demo)
  function insertModuleFindings() {
    insertFindingSnippet(getModuleFindings().join("\n"));
  }

  // Export HTML or PDF using Electron if available, else fallback to browser print
  async function handleExport(type) {
    setExporting(true);
    // HTML export - robust
    if (type === "html") {
      const blob = new Blob(
        [
          `<!DOCTYPE html><html><head><meta charset="utf-8"><title>CyberRecon Report</title></head><body style="background:#181a20;color:#fff">${parseMarkdown(
            md
          )}</body></html>`
        ],
        { type: "text/html" }
      );
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "cyberrecon-report.html";
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 80);
    } else if (type === "pdf") {
      // If Electron IPC exists, try to call backend PDF print
      if (window?.electron?.webFrame?.printToPDF) {
        // This API is only present if contextIsolation is off (rare), so fallback
        window.electron.webFrame.printToPDF({ printBackground: true });
      } else {
        window.alert("PDF export prototype: Use Print > Save as PDF from your browser.");
        setTimeout(() => window.print(), 180);
      }
    }
    setExporting(false);
  }

  // Polished, accessible, premium editor UI
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
              <span
                className="badge-faint"
                style={{fontWeight:420,cursor:"pointer"}}
                onClick={insertModuleFindings}
                tabIndex={0}
                title="Insert auto-generated findings from modules"
                aria-label="Insert findings from modules"
              >
                +Findings from modules
              </span>
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
          {/* Live preview pane, full-featured */}
          <div style={{ flex: 2, minWidth: 290, background: "#1a1a1a", borderRadius: 7, padding: 21, marginLeft:10 }}>
            <div className="section-subtitle" style={{ marginBottom: 11 }}>
              Live Preview
            </div>
            <div
              className="codearea"
              style={{
                minHeight: 260,
                maxHeight: 520,
                background: "#232130",
                fontFamily: "inherit",
                overflowY: "auto",
                border: "1.5px solid #3d414b"
              }}
              dangerouslySetInnerHTML={{ __html: parseMarkdown(md) }}
            />
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
            title="Export PDF using Print > Save as PDF"
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
          <li>Quickly paste in findings from other modules or use instant snippets.</li>
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
