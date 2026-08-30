// src-tauri/src/db/mod.rs
// Local SQLite Embedded Engine with Anti-Tamper Clock Verification

use rusqlite::{params, Connection, Result};
use sha2::{Digest, Sha256};
use std::path::PathBuf;
use std::sync::Mutex;

pub struct DatabaseManager {
    conn: Mutex<Connection>,
}

#[derive(Debug, serde::Serialize, serde::Deserialize)]
pub struct LocalDocument {
    pub id: String,
    pub title: String,
    pub content: String,
    pub category: String,
    pub created_at: i64,
    pub updated_at: i64,
}

impl DatabaseManager {
    /// Initialize database connection and create necessary schemas
    pub fn new(db_path: PathBuf) -> Result<Self> {
        let conn = Connection::open(db_path)?;

        // 1. License Cache Table
        conn.execute(
            "CREATE TABLE IF NOT EXISTS license_cache (
                id INTEGER PRIMARY KEY,
                token TEXT NOT NULL,
                last_verified_at INTEGER NOT NULL,
                machine_fingerprint TEXT NOT NULL
            );",
            [],
        )?;

        // 2. Anti-Tamper Clock Records Table
        conn.execute(
            "CREATE TABLE IF NOT EXISTS clock_records (
                id INTEGER PRIMARY KEY,
                last_timestamp INTEGER NOT NULL,
                integrity_hash TEXT NOT NULL
            );",
            [],
        )?;

        // 3. Local-First Documents Table (Instant sub-20ms local storage)
        conn.execute(
            "CREATE TABLE IF NOT EXISTS documents (
                id TEXT PRIMARY KEY,
                title TEXT NOT NULL,
                content TEXT NOT NULL,
                category TEXT NOT NULL DEFAULT 'general',
                created_at INTEGER NOT NULL,
                updated_at INTEGER NOT NULL
            );",
            [],
        )?;

        Ok(Self {
            conn: Mutex::new(conn),
        })
    }

    /// Anti-Tamper Clock Verification
    /// Compares system clock against persisted monotonically increasing timestamp
    pub fn verify_and_update_clock(&self, current_ts: i64) -> std::result::Result<(), String> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;

        let mut stmt = conn
            .prepare("SELECT last_timestamp, integrity_hash FROM clock_records WHERE id = 1")
            .map_err(|e| e.to_string())?;

        let row_opt = stmt
            .query_row([], |row| {
                let ts: i64 = row.get(0)?;
                let hash: String = row.get(1)?;
                Ok((ts, hash))
            })
            .ok();

        if let Some((last_ts, hash)) = row_opt {
            // Verify integrity hash
            let mut hasher = Sha256::new();
            hasher.update(last_ts.to_string().as_bytes());
            hasher.update(b"::anti-tamper-secret-salt-2026");
            let expected_hash = hex::encode(hasher.finalize());

            if hash != expected_hash {
                return Err("Clock anti-tamper record integrity violation detected.".to_string());
            }

            // Check for backward clock adjustment
            // Allow up to 120 seconds of jitter for NTP sync adjustments
            if current_ts < (last_ts - 120) {
                return Err(format!(
                    "System clock manipulation detected! Current: {}, Last Recorded: {}. Please correct your system time.",
                    current_ts, last_ts
                ));
            }
        }

        // Compute new hash and update clock record
        let mut hasher = Sha256::new();
        hasher.update(current_ts.to_string().as_bytes());
        hasher.update(b"::anti-tamper-secret-salt-2026");
        let new_hash = hex::encode(hasher.finalize());

        conn.execute(
            "INSERT OR REPLACE INTO clock_records (id, last_timestamp, integrity_hash) VALUES (1, ?1, ?2)",
            params![current_ts, new_hash],
        )
        .map_err(|e| e.to_string())?;

        Ok(())
    }

    /// Save license token to local SQLite cache
    pub fn save_cached_license(&self, token: &str, fingerprint: &str, verified_at: i64) -> std::result::Result<(), String> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;
        conn.execute(
            "INSERT OR REPLACE INTO license_cache (id, token, last_verified_at, machine_fingerprint) VALUES (1, ?1, ?2, ?3)",
            params![token, verified_at, fingerprint],
        )
        .map_err(|e| e.to_string())?;
        Ok(())
    }

    /// Load cached license token from SQLite
    pub fn load_cached_license(&self) -> Option<String> {
        let conn = self.conn.lock().ok()?;
        let mut stmt = conn.prepare("SELECT token FROM license_cache WHERE id = 1").ok()?;
        stmt.query_row([], |row| row.get(0)).ok()
    }

    /// Local-First Document CRUD operations
    pub fn list_documents(&self) -> std::result::Result<Vec<LocalDocument>, String> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;
        let mut stmt = conn
            .prepare("SELECT id, title, content, category, created_at, updated_at FROM documents ORDER BY updated_at DESC")
            .map_err(|e| e.to_string())?;

        let rows = stmt
            .query_map([], |row| {
                Ok(LocalDocument {
                    id: row.get(0)?,
                    title: row.get(1)?,
                    content: row.get(2)?,
                    category: row.get(3)?,
                    created_at: row.get(4)?,
                    updated_at: row.get(5)?,
                })
            })
            .map_err(|e| e.to_string())?;

        let mut docs = Vec::new();
        for row in rows {
            if let Ok(doc) = row {
                docs.push(doc);
            }
        }
        Ok(docs)
    }

    pub fn save_document(&self, doc: LocalDocument) -> std::result::Result<(), String> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;
        conn.execute(
            "INSERT OR REPLACE INTO documents (id, title, content, category, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
            params![doc.id, doc.title, doc.content, doc.category, doc.created_at, doc.updated_at],
        )
        .map_err(|e| e.to_string())?;
        Ok(())
    }

    pub fn delete_document(&self, id: &str) -> std::result::Result<(), String> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;
        conn.execute("DELETE FROM documents WHERE id = ?1", params![id])
            .map_err(|e| e.to_string())?;
        Ok(())
    }
}
