import React from "react";
import "./TabContainer.css";

/**
 * PUBLIC_INTERFACE
 * TabContainer provides a modern tabbed UI for feature modules.
 * For now only a single main tab is shown per module; extendable for multi-tab.
 */
export default function TabContainer({ moduleKey, children }) {
  // Future: support multiple open tabs per module.
  const tabTitles = {
    recon: "Recon Dashboard",
    scanner: "Vulnerability Scanner",
    exploitation: "Exploitation Toolkit",
    debugger: "JS Debugger",
    wordlist: "Wordlist Generator",
    reports: "Report Generator",
    bounty: "Bug Bounty Aggregator",
    settings: "Settings"
  };

  return (
    <section className="tabcontainer" aria-label="Main content area">
      <div className="tabcontainer__tab-bar">
        <div className="tabcontainer__tab tabcontainer__tab--active" role="tab" aria-selected="true">
          {tabTitles[moduleKey] || "Module"}
        </div>
      </div>
      <div className="tabcontainer__content">
        {children}
      </div>
    </section>
  );
}
