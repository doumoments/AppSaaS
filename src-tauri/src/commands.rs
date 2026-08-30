// src-tauri/src/commands.rs
// Tauri IPC Command Handlers

use crate::crypto::{CryptoEngine, VerificationResult};
use crate::db::{CoWSnapshot, DatabaseManager, LocalSecurityPolicy, SagaRecord, TraceRecord};
use crate::fingerprint::HardwareFingerprint;
use crate::firewall::{IntentFirewall, Verdict};
use crate::saga::{CompensationResult, SagaEngine};
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::State;

pub struct AppState {
    pub db: Arc<DatabaseManager>,
    pub saga: Arc<SagaEngine>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SimulationResult {
    pub verdict: String,
    pub reason: Option<String>,
    pub latency_ms: i64,
    pub trace_id: String,
    pub snapshot_id: Option<String>,
    pub saga_id: Option<String>,
}

#[tauri::command]
pub fn get_machine_fingerprint() -> Result<String, String> {
    Ok(HardwareFingerprint::get())
}

#[tauri::command]
pub fn verify_local_license(
    token: String,
    state: State<'_, AppState>,
) -> Result<VerificationResult, String> {
    let current_hwid = HardwareFingerprint::get();
    let now_ts = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_err(|e| e.to_string())?
        .as_secs() as i64;

    // Verify Anti-Tamper Clock
    state.db.verify_and_update_clock(now_ts)?;

    CryptoEngine::verify_license_token(&token, &current_hwid)
}

#[tauri::command]
pub fn save_cached_license(
    token: String,
    state: State<'_, AppState>,
) -> Result<(), String> {
    let current_hwid = HardwareFingerprint::get();
    let now_ts = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_err(|e| e.to_string())?
        .as_secs() as i64;

    state.db.save_cached_license(&token, &current_hwid, now_ts)
}

#[tauri::command]
pub fn load_cached_license(state: State<'_, AppState>) -> Result<Option<String>, String> {
    Ok(state.db.load_cached_license())
}

#[tauri::command]
pub fn get_recent_traces(
    limit: Option<usize>,
    state: State<'_, AppState>,
) -> Result<Vec<TraceRecord>, String> {
    state.db.get_recent_traces(limit.unwrap_or(50))
}

#[tauri::command]
pub fn get_cow_snapshots(
    session_id: Option<String>,
    state: State<'_, AppState>,
) -> Result<Vec<CoWSnapshot>, String> {
    state.db.get_cow_snapshots(session_id.as_deref())
}

#[tauri::command]
pub fn get_saga_compensations(
    session_id: Option<String>,
    state: State<'_, AppState>,
) -> Result<Vec<SagaRecord>, String> {
    state.db.get_saga_records(session_id.as_deref())
}

#[tauri::command]
pub async fn trigger_saga_rollback(
    session_id: String,
    state: State<'_, AppState>,
) -> Result<CompensationResult, String> {
    state.saga.rollback_session(&session_id).await
}

#[tauri::command]
pub fn get_security_policy(state: State<'_, AppState>) -> Result<LocalSecurityPolicy, String> {
    state.db.get_policy()
}

#[tauri::command]
pub fn update_security_policy(
    policy: LocalSecurityPolicy,
    state: State<'_, AppState>,
) -> Result<(), String> {
    state.db.update_policy(&policy)
}

#[tauri::command]
pub fn simulate_agent_action(
    agent_id: String,
    session_id: String,
    method: String,
    target_url: String,
    prompt: String,
    payload: String,
    saga_compensate: Option<String>,
    state: State<'_, AppState>,
) -> Result<SimulationResult, String> {
    let policy = state.db.get_policy()?;
    let (verdict, latency_us) = IntentFirewall::evaluate(
        &method,
        &target_url,
        &payload,
        Some(&prompt),
        &policy,
    );

    let now_ts = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs() as i64;

    let trace_id = format!("tr-{}", uuid::Uuid::new_v4());
    let latency_ms = (latency_us / 1000) as i64;

    match verdict {
        Verdict::Blocked { reason } => {
            state.db.insert_trace(&TraceRecord {
                id: trace_id.clone(),
                agent_id: agent_id.clone(),
                session_id: session_id.clone(),
                action_type: format!("{} {}", method, target_url),
                payload: payload.clone(),
                verdict: "BLOCKED".to_string(),
                reason: Some(reason.clone()),
                latency_ms,
                created_at: now_ts,
            })?;

            if policy.auto_rollback_on_error {
                let saga_clone = state.saga.clone();
                let sid = session_id.clone();
                std::thread::spawn(move || {
                    let rt = tokio::runtime::Runtime::new().unwrap();
                    let _ = rt.block_on(saga_clone.rollback_session(&sid));
                });
            }

            Ok(SimulationResult {
                verdict: "BLOCKED".to_string(),
                reason: Some(reason),
                latency_ms,
                trace_id,
                snapshot_id: None,
                saga_id: None,
            })
        }
        Verdict::Allowed => {
            let snapshot_id = format!("cow-{}", uuid::Uuid::new_v4());
            state.db.insert_cow_snapshot(&CoWSnapshot {
                id: snapshot_id.clone(),
                session_id: session_id.clone(),
                agent_id: agent_id.clone(),
                step_index: now_ts,
                state_diff: format!(
                    r#"{{"action":"{}","url":"{}","payload":"{}"}}"#,
                    method, target_url, payload.replace('"', "\\\"")
                ),
                captured_at: now_ts,
            })?;

            let mut saga_id = None;
            if let Some(comp_action) = saga_compensate {
                let sid = state.saga.register_action(
                    &session_id,
                    &agent_id,
                    &format!("{} {}", method, target_url),
                    &comp_action,
                    "SimulatedAPI",
                    &payload,
                )?;
                saga_id = Some(sid);
            }

            state.db.insert_trace(&TraceRecord {
                id: trace_id.clone(),
                agent_id,
                session_id,
                action_type: format!("{} {}", method, target_url),
                payload,
                verdict: "ALLOWED".to_string(),
                reason: None,
                latency_ms,
                created_at: now_ts,
            })?;

            Ok(SimulationResult {
                verdict: "ALLOWED".to_string(),
                reason: None,
                latency_ms,
                trace_id,
                snapshot_id: Some(snapshot_id),
                saga_id,
            })
        }
    }
}
