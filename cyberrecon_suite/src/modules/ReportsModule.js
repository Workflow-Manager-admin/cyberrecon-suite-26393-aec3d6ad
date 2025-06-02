/**
 * PUBLIC_INTERFACE
 * Report Generator – Markdown editor, live preview, screenshot/demo export.
 */
import React, { useState } from "react";

const DEMO_MD = `# Vulnerability Report: Demo App

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

function markdownToHtml(md) {
  // Super minimal offline markdown format translation (demo only)
  let html = md
    .replace(/^# (.+)/gm, "<h2>$1</h2>")
    .replace(/^## (.+)/gm, "<h3>$1</h3>")
    .replace(/^- \[x\] (.+)/gm, '<li style="color:#84ff9e;">✔️ $1</li>')
    .replace(/^- \[ \] (.+)/gm, '<li style="color:#ffd699;">☐ $1</li>')
    .replace(/^- (.+)/gm, '<li>$1</li>')
    .replace(/```[a-zA-Z]*(.*?)```/gs, '<pre>$1</pre>')
    .replace(/> _([^_]*)_/gm, '<blockquote style="color:#ffa726;">$1</blockquote>');
  // Simple block for <ul>
  html = html.replace(/(<li[\s\S]+<\/li>)/g, "<ul>$1</ul>");
  html = html.replace(/\n/g, "<br/>");
  return html;
}

export default function ReportsModule() {
  const [md, setMd] = useState(DEMO_MD);

  function handleExport(type) {
    if (type === "html") {
      const blob = new Blob(
        [
          `<!DOCTYPE html><html><head><meta charset="utf-8"><title>CyberRecon Report</title></head><body style="background:#181a20;color:#fff">${markdownToHtml(
            md
          )}</body></html>`,
        ],
        { type: "text/html" }
      );
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "report.html";
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 80);
    }
    // PDF export could launch window.print(view only) or use more advanced render in future
    if (type === "pdf") {
      window.alert("PDF export prototype: Use Print > Save as PDF from browser.");
      window.print();
    }
  }

  return (
    <div>
      <div className="panel" style={{ marginBottom: 24 }}>
        <div className="panel-header">
          Report Generator <span className="badge">Beta</span><span className="badge-faint" style={{marginLeft:7}}>Premium</span>
        </div>
        <div className="description">
          Write your pentest report with Markdown. Upload screenshots, live preview, and export.
        </div>
        <div style={{ display: "flex", gap: 22, flexWrap: "wrap" }}>
          <textarea
            rows={18}
            style={{
              width: "100%",
              maxWidth: 480,
              background: "#23272e"
            }}
            value={md}
            onChange={e => setMd(e.target.value)}
            placeholder="Write your pentest report using Markdown..."
            autoComplete="off"
          />
          <div style={{ flex: 1, minWidth: 220, background: "#1a1a1a", borderRadius: 6, padding: 14 }}>
            <div className="section-subtitle" style={{ marginBottom: 11 }}>
              Live Preview
            </div>
            <div
              className="codearea"
              style={{
                minHeight: "210px",
                maxHeight: "400px",
                background: "#232130",
                fontFamily: "inherit",
                overflowY: "auto"
              }}
              dangerouslySetInnerHTML={{ __html: markdownToHtml(md) }}
            />
          </div>
        </div>
        <div style={{ marginTop: "11px", textAlign: "right" }}>
          <button className="btn btn-success" onClick={() => handleExport("html")}>
            Export HTML
          </button>
          <button
            className="btn btn-ghost"
            style={{ marginLeft: "11px" }}
            onClick={() => handleExport("pdf")}
            title="Experimental"
          >
            Export PDF
          </button>
        </div>
      </div>
      <div className="panel" style={{marginBottom:0}}>
        <div className="panel-header">Upload Screenshots <span className="badge-faint" style={{marginLeft:8}}>Coming Soon</span></div>
        <div>
          <input type="file" accept="image/*" disabled style={{ opacity: 0.5 }} />
          <span style={{marginLeft:12, color:"#babfc7"}}>(Feature coming soon)</span>
        </div>
      </div>
      <div className="description" style={{ marginTop: 14, color: "#babfc7" }}>
        <b>How it works:</b> Write reports, see instant preview, export as HTML/PDF.<br />
        <span className="badge-faint" style={{ marginLeft: 9 }}>Premium UI</span>
      </div>
    </div>
  );
}
