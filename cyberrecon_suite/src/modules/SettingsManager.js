import React, { useState, useEffect } from "react";
import "./SettingsManager.css";

// Utility to read/write settings via Electron IPC or localStorage fallback
const SETTINGS_KEY = "cyberrecon-suite-settings";

// PUBLIC_INTERFACE: load settings (async, prefer Electron IPC in future if available)
export async function loadSettings() {
  // Try electronAPI if extended in future, fallback to localStorage
  try {
    if (window.electronAPI?.getSettings) {
      return await window.electronAPI.getSettings();
    }
    const raw = window.localStorage.getItem(SETTINGS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch (e) {
    return {};
  }
}

// PUBLIC_INTERFACE: save settings (async, prefer Electron IPC in future if available)
export async function saveSettings(settings) {
  try {
    if (window.electronAPI?.saveSettings) {
      return await window.electronAPI.saveSettings(settings);
    }
    window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    return true;
  } catch (e) {
    return false;
  }
}

/**
 * Single plugin settings row UI.
 */
function PluginRow({ plugin, onToggle, onConfigChange }) {
  return (
    <tr>
      <td>
        <label className="plugin-label" htmlFor={`plugin-${plugin.id}`}>
          {plugin.label}
        </label>
      </td>
      <td>
        <input
          type="checkbox"
          id={`plugin-${plugin.id}`}
          checked={plugin.enabled}
          onChange={() => onToggle(plugin.id)}
          aria-label={`Enable or disable ${plugin.label}`}
        />
      </td>
      <td>
        <input
          className="plugin-config-input"
          type="text"
          value={plugin.config || ""}
          onChange={e => onConfigChange(plugin.id, e.target.value)}
          placeholder="(optional config)"
          aria-label={`${plugin.label} config`}
        />
      </td>
    </tr>
  );
}

// PUBLIC_INTERFACE
/**
 * Main Professional Settings Manager UI
 */
export default function SettingsManager() {
  // ---- State
  const [settings, setSettings] = useState({
    apiKeys: { 
      amass: "", nuclei: "",
      hackerone: "", bugcrowd: "", intigriti: "",
    },
    proxy: { enabled: false, host: "", port: "" },
    plugins: [
      // Example plugins to demonstrate manager (can be extended)
      { id: "payloadgen", label: "Payload Generator", enabled: false, config: "" },
      { id: "cvefetcher", label: "CVE Fetcher", enabled: false, config: "" },
    ],
  });
  const [status, setStatus] = useState("");
  const [saving, setSaving] = useState(false);

  // ---- Load settings on mount
  useEffect(() => {
    let mounted = true;
    // Additional merge: ensure apiKeys always has all keys for new fields
    loadSettings().then(loaded => {
      if (loaded && mounted) {
        setSettings(s => ({
          ...s,
          ...loaded,
          apiKeys: { ...s.apiKeys, ...(loaded.apiKeys || {}) } // always merge new keys
        }));
      }
    });
    return () => { mounted = false; };
  }, []);

  // ---- Handlers
  function handleApiKeyChange(engine, value) {
    setSettings(s => ({
      ...s,
      apiKeys: { ...s.apiKeys, [engine]: value }
    }));
  }
  function handleProxyChange(field, value) {
    setSettings(s => ({
      ...s,
      proxy: { ...s.proxy, [field]: value }
    }));
  }
  function handleProxyEnabled(e) {
    setSettings(s => ({
      ...s,
      proxy: { ...s.proxy, enabled: e.target.checked }
    }));
  }
  function handlePluginToggle(pluginId) {
    setSettings(s => ({
      ...s,
      plugins: s.plugins.map(p =>
        p.id === pluginId ? { ...p, enabled: !p.enabled } : p
      ),
    }));
  }
  function handlePluginConfig(pluginId, value) {
    setSettings(s => ({
      ...s,
      plugins: s.plugins.map(p =>
        p.id === pluginId ? { ...p, config: value } : p
      ),
    }));
  }

  async function handleSave(e) {
    e.preventDefault();
    setSaving(true);
    setStatus("Saving...");
    const ok = await saveSettings(settings);
    setStatus(ok ? "Settings saved!" : "Save failed!");
    setSaving(false);
    setTimeout(() => setStatus(""), 1900);
  }

  function handleReset() {
    // Resets to default (user still needs to save)
    setSettings({
      apiKeys: { amass: "", nuclei: "" },
      proxy: { enabled: false, host: "", port: "" },
      plugins: [
        { id: "payloadgen", label: "Payload Generator", enabled: false, config: "" },
        { id: "cvefetcher", label: "CVE Fetcher", enabled: false, config: "" },
      ],
    });
    setStatus("Reset to defaults (save to apply)");
    setTimeout(() => setStatus(""), 1800);
  }

  // ---- UI render
  return (
    <form
      className="settings-panel panel"
      aria-label="CyberRecon Suite Settings Manager"
      onSubmit={handleSave}
      autoComplete="off"
      tabIndex={0}
    >
      <h2 className="section-title" style={{ marginBottom: 0, marginTop: 0 }}>Settings & Plugin Manager</h2>
      <div className="section-hint" style={{ marginBottom: 11 }}>
        Configure core API keys, proxy settings, and optional plugins.
        <br />
        Settings are stored securely and persist offline within this device.
      </div>
      <hr className="divider" aria-hidden="true" />
      <section aria-labelledby="apikeys-settings">
        <h3 id="apikeys-settings" className="section-subtitle">
          API Keys
        </h3>
        <div className="settings-row">
          <label htmlFor="amass-key" className="settings-label">Amass API Key</label>
          <input
            id="amass-key"
            type="text"
            value={settings.apiKeys.amass}
            onChange={e => handleApiKeyChange("amass", e.target.value)}
            autoComplete="off"
            placeholder="(optional)"
            aria-label="Amass API Key"
          />
        </div>
        <div className="settings-row">
          <label htmlFor="nuclei-key" className="settings-label">Nuclei API Key</label>
          <input
            id="nuclei-key"
            type="text"
            value={settings.apiKeys.nuclei}
            onChange={e => handleApiKeyChange("nuclei", e.target.value)}
            autoComplete="off"
            placeholder="(optional)"
            aria-label="Nuclei API Key"
          />
        </div>
      </section>
      <hr className="divider" />
      <section aria-labelledby="proxy-settings">
        <h3 id="proxy-settings" className="section-subtitle">
          Proxy Settings
        </h3>
        <div className="settings-row" style={{ alignItems: "center" }}>
          <input
            id="proxy-enabled"
            type="checkbox"
            checked={!!settings.proxy.enabled}
            onChange={handleProxyEnabled}
            aria-label="Enable internal proxy"
          />
          <label htmlFor="proxy-enabled" className="settings-label">
            Enable Proxy
          </label>
        </div>
        <div className="settings-row">
          <label htmlFor="proxy-host" className="settings-label">Proxy Host</label>
          <input
            id="proxy-host"
            type="text"
            value={settings.proxy.host}
            onChange={e => handleProxyChange("host", e.target.value)}
            autoComplete="off"
            placeholder="127.0.0.1"
            aria-label="Proxy Host"
            disabled={!settings.proxy.enabled}
          />
        </div>
        <div className="settings-row">
          <label htmlFor="proxy-port" className="settings-label">Proxy Port</label>
          <input
            id="proxy-port"
            type="number"
            value={settings.proxy.port}
            onChange={e => handleProxyChange("port", e.target.value)}
            placeholder="8080"
            min="1"
            max="65535"
            aria-label="Proxy Port"
            disabled={!settings.proxy.enabled}
          />
        </div>
      </section>
      <hr className="divider" />
      <section aria-labelledby="plugin-settings">
        <h3 id="plugin-settings" className="section-subtitle">
          Plugins
        </h3>
        <div className="settings-description">
          Enable optional plugins and adjust their configuration. More plugins coming soon.
        </div>
        <table className="settings-table table" aria-label="Plugin management table">
          <thead>
            <tr>
              <th>Plugin</th>
              <th>Enabled</th>
              <th>Config</th>
            </tr>
          </thead>
          <tbody>
            {settings.plugins.map(plugin => (
              <PluginRow
                key={plugin.id}
                plugin={plugin}
                onToggle={handlePluginToggle}
                onConfigChange={handlePluginConfig}
              />
            ))}
          </tbody>
        </table>
      </section>
      <div className="panel-foot" style={{ marginTop: 18, display: "flex", gap: 18, alignItems: "baseline" }}>
        <button
          className="btn btn-success"
          type="submit"
          disabled={saving}
          aria-label="Save settings"
        >
          {saving ? "Saving..." : "Save"}
        </button>
        <button
          className="btn btn-ghost"
          type="button"
          onClick={handleReset}
          disabled={saving}
          aria-label="Reset settings to default"
        >
          Reset
        </button>
        {status && (
          <span
            className="status-msg"
            style={{
              marginLeft: 15,
              color: status.startsWith("Settings saved") ? "#6ffaad" : "#ffc436",
              fontWeight: 640,
              fontSize: "1em"
            }}
            role="status"
            aria-live="polite"
          >
            {status}
          </span>
        )}
      </div>
    </form>
  );
}
