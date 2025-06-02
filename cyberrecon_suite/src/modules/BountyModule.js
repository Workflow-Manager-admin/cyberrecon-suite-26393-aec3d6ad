/**
 * PUBLIC_INTERFACE
 * Bug Bounty Aggregator module: Pull programs, search/filter, and quick actions.
 */
import React, { useState } from "react";

const DEMO_PROGRAMS = [
  {
    platform: "HackerOne",
    name: "Acme Corp",
    url: "https://hackerone.com/acme",
    bounties: true,
    domains: ["acme.com", "api.acme.com"],
  },
  {
    platform: "Bugcrowd",
    name: "BugsiTech",
    url: "https://bugcrowd.com/bugsitech",
    bounties: false,
    domains: ["*.bugsitech.io"],
  },
  {
    platform: "Intigriti",
    name: "Finsec",
    url: "https://intigriti.com/programs/finsec",
    bounties: true,
    domains: ["finsec.com"],
  },
];

export default function BountyModule() {
  const [search, setSearch] = useState("");
  const programs = DEMO_PROGRAMS.filter(
    (p) =>
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.domains.some((d) => d.includes(search.toLowerCase()))
  );
  return (
    <div>
      <div className="panel" style={{marginBottom:"30px"}}>
        <div className="panel-header" style={{display:"flex",alignItems:"center",gap:9}}>
          Bug Bounty Aggregator <span className="badge">Alpha</span><span className="badge-faint">Premium</span>
        </div>
        <div className="description">
          Pull programs from HackerOne, Bugcrowd, Intigriti. Filter by bounty/platform. Quickly add domains to recon.
        </div>
        <div style={{ marginTop: 13, marginBottom: 15 }}>
          <input
            style={{
              background: "#222427",
              border: "1.5px solid var(--color-accent)",
              borderRadius: "4px",
              color: "#ff9800",
              minWidth: "220px",
              fontSize: "1em",
              padding: "7px 13px",
            }}
            type="text"
            value={search}
            placeholder="Filter by name or domain..."
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Filter bounty programs"
          />
        </div>
        <table className="table" style={{ background: "#24272f", marginBottom: 0 }}>
          <thead>
            <tr>
              <th>Platform</th>
              <th>Program</th>
              <th>Domains</th>
              <th>Bounties</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {programs.length === 0 && (
              <tr>
                <td colSpan={5} style={{ textAlign: "center", color: "#babfc7" }}>
                  (No matching bug bounty programs found)
                </td>
              </tr>
            )}
            {programs.map((p, idx) => (
              <tr key={p.name + idx}>
                <td>
                  <span
                    className="badge-faint"
                    style={{
                      background:
                        p.platform === "HackerOne"
                          ? "#ffc436"
                          : p.platform === "Bugcrowd"
                          ? "#34ceb7"
                          : "#e87a41",
                      color: "#23272e",
                      fontWeight: 600,
                    }}
                  >
                    {p.platform}
                  </span>
                </td>
                <td>
                  <a
                    href={p.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ color: "#ff9800", textDecoration: "underline" }}
                  >
                    {p.name}
                  </a>
                </td>
                <td style={{ fontFamily: "monospace", fontSize: "0.99em" }}>
                  {p.domains.join(", ")}
                </td>
                <td>
                  {p.bounties ? (
                    <span style={{ color: "#4be38d", fontWeight: 600 }}>Yes</span>
                  ) : (
                    <span style={{ color: "#babfc7" }}>No</span>
                  )}
                </td>
                <td>
                  <button
                    className="btn btn-success"
                    style={{ fontSize: "0.97em" }}
                    onClick={() => window.alert(`Added: ${p.domains.join(", ")} to Recon`)}
                  >
                    + Recon
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="description" style={{ marginTop: "18px", color: "#babfc7" }}>
        <b>Tip:</b> Click <span className="badge btn-success" style={{ fontWeight: 500 }}>+ Recon</span> to add target domains.
        <span className="badge-faint" style={{ marginLeft: 13 }}>Premium UI</span>
        <span className="badge-faint" style={{ marginLeft: 13 }}>Feature Roadmap</span>
      </div>
    </div>
  );
}
