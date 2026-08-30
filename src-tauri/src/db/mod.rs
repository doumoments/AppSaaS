// src-tauri/src/db/mod.rs
// Local-First SQLite Database Engine (CoW State, Traces, Saga & Anti-Tamper Clock)

use rusqlite::{params, Connection, Result};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::path::PathBuf;
use std::sync::Mutex;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TraceRecord {
    pub id: String,
    pub agent_id: String,
    pub session_id: String,
    pub action_type: String,
    pub payload: String,
    pub verdict: String,
    pub reason: Option<String>,
    pub latency_ms: i64,
    pub created_at: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CoWSnapshot {
    pub id: String,
    pub session_id: String,
    pub agent_id: String,
    pub step_index: i64,
    pub state_diff: String,
    pub captured_at: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SagaRecord {
    pub id: String,
    pub session_id: String,
    pub agent_id: String,
    pub original_action: String,
    pub compensating_action: String,
    pub target_service: String,
    pub status: String,
    pub details: String,
    pub created_at: i64,
    pub executed_at: Option<i64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LocalSecurityPolicy {
    pub id: String,
    pub name: String,
    pub max_execution_time_sec: i64,
    pub allowed_domains: Vec<String>,
    pub blocked_syscalls: Vec<String>,
    pub auto_rollback_on_error: bool,
    pub updated_at: i64,
}

pub struct DatabaseManager {
    conn: Mutex<Connection>,
}

impl DatabaseManager {
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

        // 3. Local Traces Table (Audit & Telemetry)
        conn.execute(
            "CREATE TABLE IF NOT EXISTS traces (
                id TEXT PRIMARY KEY,
                agent_id TEXT NOT NULL,
                session_id TEXT NOT NULL,
                action_type TEXT NOT NULL,
                payload TEXT NOT NULL,
                verdict TEXT NOT NULL,
                reason TEXT,
                latency_ms INTEGER NOT NULL,
                created_at INTEGER NOT NULL
            );",
            [],
        )?;

        // 4. CoW Snapshots Table (Differential State Reversibility)
        conn.execute(
            "CREATE TABLE IF NOT EXISTS cow_snapshots (
                id TEXT PRIMARY KEY,
                session_id TEXT NOT NULL,
                agent_id TEXT NOT NULL,
                step_index INTEGER NOT NULL,
                state_diff TEXT NOT NULL,
                captured_at INTEGER NOT NULL
            );",
            [],
        )?;

        // 5. Saga Compensations Table
        conn.execute(
            "CREATE TABLE IF NOT EXISTS saga_records (
                id TEXT PRIMARY KEY,
                session_id TEXT NOT NULL,
                agent_id TEXT NOT NULL,
                original_action TEXT NOT NULL,
                compensating_action TEXT NOT NULL,
                target_service TEXT NOT NULL,
                status TEXT NOT NULL,
                details TEXT NOT NULL,
                created_at INTEGER NOT NULL,
                executed_at INTEGER
            );",
            [],
        )?;

        // 6. Local Policy Cache
        conn.execute(
            "CREATE TABLE IF NOT EXISTS local_policies (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                max_execution_time_sec INTEGER NOT NULL,
                allowed_domains TEXT NOT NULL,
                blocked_syscalls TEXT NOT NULL,
                auto_rollback_on_error INTEGER NOT NULL,
                updated_at INTEGER NOT NULL
            );",
            [],
        )?;

        // Seed default policy if none exists
        conn.execute(
            "INSERT OR IGNORE INTO local_policies (
                id, name, max_execution_time_sec, allowed_domains, blocked_syscalls, auto_rollback_on_error, updated_at
            ) VALUES (
                'default', 'Production Guardrail Policy', 30,
                'api.github.com,api.stripe.com,api.openai.com,api.anthropic.com',
                'sys_raw_socket,execve,unlink,rmdir', 1, strftime('%s', 'now')
            );",
            [],
        )?;

        Ok(Self {
            conn: Mutex::new(conn),
        })
    }

    /// Anti-Tamper Clock Verification
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
            let mut hasher = Sha256::new();
            hasher.update(last_ts.to_string().as_bytes());
            hasher.update(b"::anti-tamper-secret-salt-2026");
            let expected_hash = hex::encode(hasher.finalize());

            if hash != expected_hash {
                return Err("Clock anti-tamper record integrity violation detected.".to_string());
            }

            if current_ts < (last_ts - 120) {
                return Err(format!(
                    "System clock manipulation detected! Current: {}, Last Recorded: {}. Please correct your system time.",
                    current_ts, last_ts
                ));
            }
        }

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

    pub fn save_cached_license(&self, token: &str, fingerprint: &str, verified_at: i64) -> std::result::Result<(), String> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;
        conn.execute(
            "INSERT OR REPLACE INTO license_cache (id, token, last_verified_at, machine_fingerprint) VALUES (1, ?1, ?2, ?3)",
            params![token, verified_at, fingerprint],
        )
        .map_err(|e| e.to_string())?;
        Ok(())
    }

    pub fn load_cached_license(&self) -> Option<String> {
        let conn = self.conn.lock().ok()?;
        let mut stmt = conn.prepare("SELECT token FROM license_cache WHERE id = 1").ok()?;
        stmt.query_row([], |row| row.get(0)).ok()
    }

    // --- Trace Management ---
    pub fn insert_trace(&self, trace: &TraceRecord) -> std::result::Result<(), String> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;
        conn.execute(
            "INSERT INTO traces (id, agent_id, session_id, action_type, payload, verdict, reason, latency_ms, created_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
            params![
                trace.id,
                trace.agent_id,
                trace.session_id,
                trace.action_type,
                trace.payload,
                trace.verdict,
                trace.reason,
                trace.latency_ms,
                trace.created_at
            ],
        )
        .map_err(|e| e.to_string())?;
        Ok(())
    }

    pub fn get_recent_traces(&self, limit: usize) -> std::result::Result<Vec<TraceRecord>, String> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;
        let mut stmt = conn
            .prepare("SELECT id, agent_id, session_id, action_type, payload, verdict, reason, latency_ms, created_at FROM traces ORDER BY created_at DESC LIMIT ?1")
            .map_err(|e| e.to_string())?;

        let rows = stmt
            .query_map(params![limit as i64], |row| {
                Ok(TraceRecord {
                    id: row.get(0)?,
                    agent_id: row.get(1)?,
                    session_id: row.get(2)?,
                    action_type: row.get(3)?,
                    payload: row.get(4)?,
                    verdict: row.get(5)?,
                    reason: row.get(6)?,
                    latency_ms: row.get(7)?,
                    created_at: row.get(8)?,
                })
            })
            .map_err(|e| e.to_string())?;

        let mut traces = Vec::new();
        for r in rows {
            if let Ok(t) = r {
                traces.push(t);
            }
        }
        Ok(traces)
    }

    // --- CoW Snapshot Management ---
    pub fn insert_cow_snapshot(&self, snapshot: &CoWSnapshot) -> std::result::Result<(), String> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;
        conn.execute(
            "INSERT INTO cow_snapshots (id, session_id, agent_id, step_index, state_diff, captured_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
            params![
                snapshot.id,
                snapshot.session_id,
                snapshot.agent_id,
                snapshot.step_index,
                snapshot.state_diff,
                snapshot.captured_at
            ],
        )
        .map_err(|e| e.to_string())?;
        Ok(())
    }

    pub fn get_cow_snapshots(&self, session_id: Option<&str>) -> std::result::Result<Vec<CoWSnapshot>, String> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;
        let mut snapshots = Vec::new();

        if let Some(sid) = session_id {
            let mut stmt = conn
                .prepare("SELECT id, session_id, agent_id, step_index, state_diff, captured_at FROM cow_snapshots WHERE session_id = ?1 ORDER BY step_index ASC")
                .map_err(|e| e.to_string())?;
            let rows = stmt
                .query_map(params![sid], |row| {
                    Ok(CoWSnapshot {
                        id: row.get(0)?,
                        session_id: row.get(1)?,
                        agent_id: row.get(2)?,
                        step_index: row.get(3)?,
                        state_diff: row.get(4)?,
                        captured_at: row.get(5)?,
                    })
                })
                .map_err(|e| e.to_string())?;
            for r in rows {
                if let Ok(s) = r {
                    snapshots.push(s);
                }
            }
        } else {
            let mut stmt = conn
                .prepare("SELECT id, session_id, agent_id, step_index, state_diff, captured_at FROM cow_snapshots ORDER BY captured_at DESC LIMIT 50")
                .map_err(|e| e.to_string())?;
            let rows = stmt
                .query_map([], |row| {
                    Ok(CoWSnapshot {
                        id: row.get(0)?,
                        session_id: row.get(1)?,
                        agent_id: row.get(2)?,
                        step_index: row.get(3)?,
                        state_diff: row.get(4)?,
                        captured_at: row.get(5)?,
                    })
                })
                .map_err(|e| e.to_string())?;
            for r in rows {
                if let Ok(s) = r {
                    snapshots.push(s);
                }
            }
        }

        Ok(snapshots)
    }

    // --- Saga Management ---
    pub fn insert_saga_record(&self, record: &SagaRecord) -> std::result::Result<(), String> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;
        conn.execute(
            "INSERT INTO saga_records (id, session_id, agent_id, original_action, compensating_action, target_service, status, details, created_at, executed_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)",
            params![
                record.id,
                record.session_id,
                record.agent_id,
                record.original_action,
                record.compensating_action,
                record.target_service,
                record.status,
                record.details,
                record.created_at,
                record.executed_at
            ],
        )
        .map_err(|e| e.to_string())?;
        Ok(())
    }

    pub fn mark_saga_executed(&self, id: &str, executed_at: i64) -> std::result::Result<(), String> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;
        conn.execute(
            "UPDATE saga_records SET status = 'executed', executed_at = ?2 WHERE id = ?1",
            params![id, executed_at],
        )
        .map_err(|e| e.to_string())?;
        Ok(())
    }

    pub fn get_saga_records(&self, session_id: Option<&str>) -> std::result::Result<Vec<SagaRecord>, String> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;
        let mut records = Vec::new();

        if let Some(sid) = session_id {
            let mut stmt = conn
                .prepare("SELECT id, session_id, agent_id, original_action, compensating_action, target_service, status, details, created_at, executed_at FROM saga_records WHERE session_id = ?1 ORDER BY created_at DESC")
                .map_err(|e| e.to_string())?;
            let rows = stmt
                .query_map(params![sid], |row| {
                    Ok(SagaRecord {
                        id: row.get(0)?,
                        session_id: row.get(1)?,
                        agent_id: row.get(2)?,
                        original_action: row.get(3)?,
                        compensating_action: row.get(4)?,
                        target_service: row.get(5)?,
                        status: row.get(6)?,
                        details: row.get(7)?,
                        created_at: row.get(8)?,
                        executed_at: row.get(9)?,
                    })
                })
                .map_err(|e| e.to_string())?;
            for r in rows {
                if let Ok(s) = r {
                    records.push(s);
                }
            }
        } else {
            let mut stmt = conn
                .prepare("SELECT id, session_id, agent_id, original_action, compensating_action, target_service, status, details, created_at, executed_at FROM saga_records ORDER BY created_at DESC LIMIT 50")
                .map_err(|e| e.to_string())?;
            let rows = stmt
                .query_map([], |row| {
                    Ok(SagaRecord {
                        id: row.get(0)?,
                        session_id: row.get(1)?,
                        agent_id: row.get(2)?,
                        original_action: row.get(3)?,
                        compensating_action: row.get(4)?,
                        target_service: row.get(5)?,
                        status: row.get(6)?,
                        details: row.get(7)?,
                        created_at: row.get(8)?,
                        executed_at: row.get(9)?,
                    })
                })
                .map_err(|e| e.to_string())?;
            for r in rows {
                if let Ok(s) = r {
                    records.push(s);
                }
            }
        }

        Ok(records)
    }

    // --- Policy Management ---
    pub fn get_policy(&self) -> std::result::Result<LocalSecurityPolicy, String> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;
        let mut stmt = conn
            .prepare("SELECT id, name, max_execution_time_sec, allowed_domains, blocked_syscalls, auto_rollback_on_error, updated_at FROM local_policies WHERE id = 'default'")
            .map_err(|e| e.to_string())?;

        stmt.query_row([], |row| {
            let domains_str: String = row.get(3)?;
            let syscalls_str: String = row.get(4)?;
            let auto_rb: i64 = row.get(5)?;
            Ok(LocalSecurityPolicy {
                id: row.get(0)?,
                name: row.get(1)?,
                max_execution_time_sec: row.get(2)?,
                allowed_domains: domains_str.split(',').map(|s| s.trim().to_string()).filter(|s| !s.is_empty()).collect(),
                blocked_syscalls: syscalls_str.split(',').map(|s| s.trim().to_string()).filter(|s| !s.is_empty()).collect(),
                auto_rollback_on_error: auto_rb == 1,
                updated_at: row.get(6)?,
            })
        })
        .map_err(|e| e.to_string())
    }

    pub fn update_policy(&self, policy: &LocalSecurityPolicy) -> std::result::Result<(), String> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;
        let domains_str = policy.allowed_domains.join(",");
        let syscalls_str = policy.blocked_syscalls.join(",");
        let auto_rb = if policy.auto_rollback_on_error { 1 } else { 0 };

        conn.execute(
            "INSERT OR REPLACE INTO local_policies (
                id, name, max_execution_time_sec, allowed_domains, blocked_syscalls, auto_rollback_on_error, updated_at
            ) VALUES ('default', ?1, ?2, ?3, ?4, ?5, ?6)",
            params![
                policy.name,
                policy.max_execution_time_sec,
                domains_str,
                syscalls_str,
                auto_rb,
                policy.updated_at
            ],
        )
        .map_err(|e| e.to_string())?;

        Ok(())
    }
}
