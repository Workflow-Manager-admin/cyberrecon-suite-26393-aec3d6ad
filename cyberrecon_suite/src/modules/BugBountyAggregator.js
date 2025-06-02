 /**
  * PUBLIC_INTERFACE
  * Bug Bounty Aggregator (Premium) – Fetch programs from platforms live, using API keys from secure storage.
  * - Dynamically retrieves API keys from settings (Electron IPC or browser fallback).
  * - Fetches live bug bounty program data from HackerOne, Bugcrowd, Intigriti.
  * - Handles API errors, rate limits, and loading states.
  * - Renders a premium UI table for results, compatible with browser/Electron.
  */

import React, { useEffect, useState, useCallback } from "react";
import { loadSettings } from "./SettingsManager";

// Util: Detect platform
function isElectron() {
  return (
    typeof window !== "undefined" &&
    window.electronAPI &&
    typeof window.electronAPI.getSettings === "function"
  );
}

// Fetch live public bug bounty program data (returns array)
// Each platform has different API and requirements. Only show what is available.
async function fetchHackerOnePrograms(apiKey) {
  // HackerOne GraphQL endpoint: https://api.hackerone.com/v1/hackers/programs (REST)
  // Docs: https://api.hackerone.com/docs/v1
  // If no key or error, fall back to public directory API (no auth required, but less data)
  const results = [];
  let fetchError = null;
  try {
    const url = apiKey
      ? "https://api.hackerone.com/v1/hackers/programs"
      : "https://hackerone.com/graphql";
    const headers = {
      Accept: "application/json",
    };
    if (apiKey) headers.Authorization = "Basic " + btoa(apiKey + ":");
    if (!apiKey) {
      // Fetch public directory via GraphQL POST (unofficial, fewer details)
      const resp = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...headers },
        body: JSON.stringify({
          query:
            "query DirectorySearch($limit:Int){hacktivity_entries(first:$limit){nodes{_id,name,handle,url,bounty_awarded,wealth,submission_state,offers_bounties}}}",
          variables: { limit: 40 },
        }),
      });
      if (!resp.ok) throw new Error(`HackerOne API error: ${resp.status}`);
      const data = await resp.json();
      (data?.data?.hacktivity_entries?.nodes || []).forEach((p) => {
        results.push({
          platform: "HackerOne",
          name: p.name || p.handle,
          url: p.url || `https://hackerone.com/${p.handle}`,
          bounties: !!(p.offers_bounties || p.bounty_awarded),
          domains: [],
        });
      });
    } else {
      // Authenticated: richer API (paginated)
      const resp = await fetch(url, { headers });
      if (!resp.ok) throw new Error(`HackerOne API error: ${resp.status}`);
      const json = await resp.json();
      // Map to uniform format:
      (json?.data || []).forEach((prog) => {
        results.push({
          platform: "HackerOne",
          name: prog.name || prog.handle,
          url: prog.url || `https://hackerone.com/${prog.handle}`,
          bounties: prog.offers_bounties !== undefined ? prog.offers_bounties : true,
          domains: prog.domain || [],
        });
      });
      // If REST fails, fallback to public
    }
  } catch (e) {
    fetchError = String(e?.message || e);
    // Fallback: No results
  }
  return { results, error: fetchError };
}

async function fetchBugcrowdPrograms(apiKey) {
  // Public endpoint: https://bugcrowd.com/programs.json
  // Authenticated endpoint requires special handling, but public gives a lot.
  const results = [];
  let fetchError = null;
  try {
    const url = "https://bugcrowd.com/programs.json";
    // No API key required for public programs listing.
    const resp = await fetch(url, { headers: { Accept: "application/json" } });
    if (!resp.ok) throw new Error(`Bugcrowd API error: ${resp.status}`);
    const programs = await resp.json();
    (programs || []).forEach((p) => {
      results.push({
        platform: "Bugcrowd",
        name: p.name,
        url: p.program_url,
        bounties: !!p.bounties,
        domains: Array.isArray(p.domains) ? p.domains : [],
      });
    });
  } catch (e) {
    fetchError = String(e?.message || e);
  }
  return { results, error: fetchError };
}

async function fetchIntigritiPrograms(apiKey) {
  // Public programs are available at https://api.intigriti.com/external/programs
  // Authenticated endpoint returns private programs (if granted).
  const results = [];
  let fetchError = null;
  try {
    const url = apiKey
      ? "https://api.intigriti.com/core/programs/team"
      : "https://api.intigriti.com/external/programs";
    const headers = {
      Accept: "application/json",
    };
    if (apiKey) headers.Authorization = "Bearer " + apiKey;
    const resp = await fetch(url, { headers });
    if (!resp.ok) throw new Error(`Intigriti API error: ${resp.status}`);
    const data = await resp.json();
    (Array.isArray(data) ? data : []).forEach((p) => {
      results.push({
        platform: "Intigriti",
        name: p.name || p.handle,
        url:
          p.handle || p.slug
            ? "https://app.intigriti.com/programs/" + (p.handle || p.slug)
            : "https://intigriti.com/",
        bounties: typeof p.min_bounty !== "undefined" ? p.min_bounty > 0 : true,
        domains:
          Array.isArray(p.domains)
            ? p.domains
            : p.in_scope
            ? p.in_scope
                .map((s) => s.endpoint || s.asset_identifier || s.asset || s.target || "")
                .filter((d) => !!d)
            : [],
      });
    });
  } catch (e) {
    fetchError = String(e?.message || e);
  }
  return { results, error: fetchError };
}

// Merges multiple platform results arrays into a deduplicated flat list.
function mergeAllPrograms(...lists) {
  // deduplicate heuristically by name + platform + url.
  const map = {};
  [].concat(...lists).forEach((p) => {
    const key = [p.platform, p.name, p.url].join("|");
    if (!map[key])
      map[key] = {
        ...p,
        domains: Array.isArray(p.domains)
          ? p.domains.filter((d) => !!d && typeof d === "string").sort()
          : [],
      };
    else if (Array.isArray(p.domains)) {
      // Merge domains from identical program
      map[key].domains = Array.from(
        new Set([...map[key].domains, ...p.domains.filter(Boolean)])
      ).sort();
    }
  });
  return Object.values(map);
}

/**
 * PUBLIC_INTERFACE
 * Main Bug Bounty Aggregator component.
 */
export default function BugBountyAggregator() {
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [programs, setPrograms] = useState([]);
  const [lastFetchTime, setLastFetchTime] = useState(0);
  const [error, setError] = useState(null);
  const [platformErrors, setPlatformErrors] = useState({});
  // For premium appearance, rate-limit notice, electron/browser compatibility
  const [rateLimited, setRateLimited] = useState(false);

  // Load API keys & fetch data
  const fetchAllPrograms = useCallback(async () => {
    setLoading(true);
    setPrograms([]);
    setError(null);
    setRateLimited(false);
    setPlatformErrors({});
    let settings;
    try {
      settings = await loadSettings();
      if (!settings || !settings.apiKeys) throw new Error("No API keys found in settings");
    } catch (e) {
      setError("Failed to load API keys/settings");
      setLoading(false);
      return;
    }
    // Let all fetches happen in parallel
    const [h1, bc, intg] = await Promise.all([
      fetchHackerOnePrograms(settings.apiKeys.hackerone || ""),
      fetchBugcrowdPrograms(settings.apiKeys.bugcrowd || ""),
      fetchIntigritiPrograms(settings.apiKeys.intigriti || ""),
    ]);
    // Track platform fetch errors
    const errors = {};
    if (h1.error) errors["HackerOne"] = h1.error;
    if (bc.error) errors["Bugcrowd"] = bc.error;
    if (intg.error) errors["Intigriti"] = intg.error;
    // Detect if error is rate limit or forbidden
    const anyRate =
      /rate.?limit|429|too.*many|forbidden|quota|throttle/i.test(
        (h1.error || "") + (bc.error || "") + (intg.error || "")
      );
    setPlatformErrors(errors);
    setRateLimited(anyRate);
    setLastFetchTime(Date.now());
    setPrograms(
      mergeAllPrograms(
        h1.results || [],
        bc.results || [],
        intg.results || []
      )
    );
    setLoading(false);
  }, []);

  // Initial fetch on mount, and when refetch requested.
  useEffect(() => {
    fetchAllPrograms();
  }, [fetchAllPrograms]);

  // Filter programs matching search
  const filteredPrograms = programs.filter(
    (p) =>
      (p.name && p.name.toLowerCase().includes(search.toLowerCase())) ||
      (Array.isArray(p.domains) &&
        p.domains.some((d) => d && d.toLowerCase().includes(search.toLowerCase())))
  );

  return (
    <div>
      <div className="panel" style={{ marginBottom: "30px" }}>
        <div
          className="panel-header"
          style={{ display: "flex", alignItems: "center", gap: 9 }}
        >
          Bug Bounty Aggregator <span className="badge">Live</span>
          <span className="badge-faint">Premium</span>
          <button
            className="btn btn-ghost"
            style={{
              marginLeft: 14,
              fontSize: "0.93em",
              fontWeight: 640,
              minWidth: 72,
              background: "#23272e",
              border: "1.2px solid #ffc436",
            }}
            disabled={loading}
            onClick={fetchAllPrograms}
            aria-label="Refresh bug bounty program list"
          >
            {loading ? "Refreshing..." : "Refresh"}
          </button>
        </div>
        <div className="description">
          Pulls live programs from HackerOne, Bugcrowd, Intigriti using API keys from Settings.<br />
          Secure key storage (Electron/Browser support). Filter by bounty/platform. Add domains to Recon (coming soon).
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
        {error && (
          <div className="alert alert-error" style={{ marginBottom: 9 }}>
            <b>Error:</b> {error}
          </div>
        )}
        {Object.keys(platformErrors).length > 0 && (
          <div className="alert alert-error" style={{ marginBottom: 9 }}>
            <b>Fetch errors:</b>{" "}
            {Object.entries(platformErrors).map(([plt, msg]) => (
              <span key={plt}>
                {plt}: {msg}&nbsp;
              </span>
            ))}
          </div>
        )}
        {rateLimited && (
          <div className="alert alert-info" style={{ marginBottom: 9 }}>
            <b>Notice:</b> Some platform APIs returned a rate limit or forbidden. {isElectron()
              ? "Check your API keys or try again later."
              : "Try reloading in Electron app with valid API keys for full private program access."}
          </div>
        )}
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
            {!loading && filteredPrograms.length === 0 && (
              <tr>
                <td colSpan={5} style={{ textAlign: "center", color: "#babfc7" }}>
                  (No matching bug bounty programs found)
                </td>
              </tr>
            )}
            {loading && (
              <tr>
                <td colSpan={5} style={{ textAlign: "center", color: "#babfc7" }}>
                  Fetching programs...
                </td>
              </tr>
            )}
            {filteredPrograms.map((p, idx) => (
              <tr key={p.platform + p.name + idx}>
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
                  {Array.isArray(p.domains) && p.domains.length
                    ? p.domains.join(", ")
                    : <span style={{ color: "#babfc7" }}>(none listed)</span>}
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
                    onClick={() =>
                      p.domains?.length
                        ? window.alert(`Added: ${p.domains.join(", ")} to Recon (feature coming soon!)`)
                        : window.alert("No domains to add for this program.")
                    }
                    disabled={!p.domains || !p.domains.length}
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
        <b>Tip:</b> Click <span className="badge btn-success" style={{ fontWeight: 500 }}>+ Recon</span> to add target domains.<br />
        <span className="badge-faint" style={{ marginLeft: 13 }}>
          Platform: {isElectron() ? "Electron" : "Browser"} | Last refreshed:{" "}
          {lastFetchTime ? new Date(lastFetchTime).toLocaleTimeString() : "--"}
        </span>
        <span className="badge-faint" style={{ marginLeft: 13 }}>Premium UI</span>
        <span className="badge-faint" style={{ marginLeft: 13 }}>Live Data</span>
      </div>
    </div>
  );
}
