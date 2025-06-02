import React from "react";
import "./Sidebar.css";

/**
 * PUBLIC_INTERFACE
 * Sidebar component – persistent navigation rail for core modules.
 * Modern, accessible, keyboard-navigable, with slots for future modules.
 */
const modules = [
  { key: "recon", label: "Recon", icon: "🛰️" },
  { key: "scanner", label: "Scanner", icon: "🛠️" },
  { key: "exploitation", label: "Exploit", icon: "💥" },
  { key: "debugger", label: "JS Debug", icon: "🧬" },
  { key: "wordlist", label: "Wordlist", icon: "📄" },
  { key: "reports", label: "Reports", icon: "📑" },
  { key: "bounty", label: "Bounties", icon: "🏆" },
  { key: "settings", label: "Settings", icon: "⚙️" }
];

export default function Sidebar({ activeModule, onModuleSelect }) {
  return (
    <nav className="sidebar" aria-label="Main navigation">
      <div className="sidebar__logo">
        <span className="sidebar__logo-mark">◎</span> CyberRecon Suite
      </div>
      <ul className="sidebar__nav" role="tablist">
        {modules.map((m) => (
          <li key={m.key}>
            <button
              className={
                "sidebar__nav-btn" +
                (activeModule === m.key ? " sidebar__nav-btn--active" : "")
              }
              aria-current={activeModule === m.key ? "page" : undefined}
              tabIndex={0}
              onClick={() => onModuleSelect(m.key)}
              role="tab"
              aria-selected={activeModule === m.key}
              aria-label={m.label}
            >
              <span className="sidebar__icon">{m.icon}</span>
              <span className="sidebar__label">{m.label}</span>
            </button>
          </li>
        ))}
      </ul>
    </nav>
  );
}
