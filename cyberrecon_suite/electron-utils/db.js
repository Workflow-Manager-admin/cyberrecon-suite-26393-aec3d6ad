const path = require('path');
const fs = require('fs');
let sqlite3;
let low;

// PUBLIC_INTERFACE
/**
 * Database abstraction for persistent recon/scan sessions.
 * - Uses SQLite if available, otherwise falls back to lowdb (JSON-based).
 */
class CyberReconDB {
  constructor() {
    this.dbType = null;
    this.sqlite = null;
    this.lowdb = null;
    this.loaded = false;

    // Storage paths
    this.dataDir = path.join(
      process.env.APPDATA ||
        (process.platform === 'darwin'
          ? path.join(process.env.HOME, 'Library', 'Application Support')
          : path.join(process.env.HOME || '', '.config')),
      'CyberReconSuite'
    );
    this.sqlitePath = path.join(this.dataDir, 'cyberrecon.db');
    this.lowdbPath = path.join(this.dataDir, 'cyberrecon.json');
  }

  // PUBLIC_INTERFACE
  /**
   * Attempt to initialize persistent storage.
   * Determines backend and performs schema migration/setup.
   */
  async initialize() {
    // Ensure directory
    if (!fs.existsSync(this.dataDir)) fs.mkdirSync(this.dataDir, { recursive: true });

    // Try SQLite first
    try {
      sqlite3 = require('sqlite3').verbose();
      this.sqlite = new sqlite3.Database(this.sqlitePath);
      this.dbType = 'sqlite';

      // Create sessions table
      await this._run(`
        CREATE TABLE IF NOT EXISTS sessions (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          type TEXT NOT NULL,
          label TEXT,
          started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          data TEXT NOT NULL
        )
      `);
      this.loaded = true;
    } catch (err) {
      // Fallback: Use lowdb (JSON file store)
      try {
        low = require('lowdb');
        const FileSync = require('lowdb/adapters/FileSync');
        this.lowdb = low(new FileSync(this.lowdbPath));
        this.lowdb.defaults({ sessions: [] }).write();
        this.dbType = 'lowdb';
        this.loaded = true;
      } catch (e) {
        this.dbType = null;
        this.loaded = false;
        throw new Error('Neither sqlite3 nor lowdb is available on this platform.');
      }
    }
  }

  // PUBLIC_INTERFACE
  /**
   * Insert a new session/scan result.
   * @param {Object} session  {type: "recon"|"scan", label: string, data: Object}
   * @returns {Promise<number>} Inserted session ID (sqlite) or generated ID (lowdb)
   */
  async insertSession(session) {
    if (!this.loaded) throw new Error('DB not initialized');
    const { type, label = '', data } = session;
    const dataStr = JSON.stringify(data || {});
    if (this.dbType === 'sqlite') {
      return new Promise((resolve, reject) => {
        this.sqlite.run(
          'INSERT INTO sessions (type, label, data) VALUES (?, ?, ?)',
          [type, label, dataStr],
          function (err) {
            if (err) return reject(err);
            resolve(this.lastID);
          }
        );
      });
    } else if (this.dbType === 'lowdb') {
      const id = Date.now();
      this.lowdb.get('sessions')
        .push({
          id,
          type,
          label,
          started_at: new Date().toISOString(),
          data: data
        })
        .write();
      return id;
    }
    throw new Error('No available DB backend');
  }

  // PUBLIC_INTERFACE
  /**
   * Fetch sessions, optionally filtering by type ("recon", "scan", etc).
   * @param {Object} [opts]
   * @param {string} [opts.type]  Optional filter by session type
   * @param {number} [opts.limit] Optional result limit (default 100)
   * @returns {Promise<Array>} Array of sessions (id, type, label, started_at, data)
   */
  async getSessions(opts = {}) {
    if (!this.loaded) throw new Error('DB not initialized');
    const { type, limit = 100 } = opts;
    if (this.dbType === 'sqlite') {
      const sql =
        'SELECT id, type, label, started_at, data FROM sessions'
        + (type ? ' WHERE type = ?' : '')
        + ' ORDER BY started_at DESC LIMIT ?';
      const params = type ? [type, limit] : [limit];
      return new Promise((resolve, reject) => {
        this.sqlite.all(sql, params, (err, rows) => {
          if (err) return reject(err);
          resolve(rows.map((row) => ({
            id: row.id,
            type: row.type,
            label: row.label,
            started_at: row.started_at,
            data: (typeof row.data === 'string' && row.data[0] === '{')
              ? JSON.parse(row.data)
              : row.data
          })));
        });
      });
    } else if (this.dbType === 'lowdb') {
      let q = this.lowdb.get('sessions');
      if (type) q = q.filter({ type });
      return q
        .sortBy('started_at')
        .reverse()
        .take(limit)
        .value();
    }
    throw new Error('No available DB backend');
  }

  // PRIVATE
  _run(sql) {
    return new Promise((resolve, reject) => {
      this.sqlite.run(sql, (err) => (err ? reject(err) : resolve()));
    });
  }
}

module.exports = new CyberReconDB();
