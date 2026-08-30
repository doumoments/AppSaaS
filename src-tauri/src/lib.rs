// src-tauri/src/lib.rs
// Tauri v2 Command Handlers and Application State

pub mod crypto;
pub mod db;
pub mod fingerprint;

use chrono::Utc;
use crypto::{verify_license_token, VerificationResult};
use db::{DatabaseManager, LocalDocument};
use fingerprint::{generate_machine_fingerprint, get_hardware_diagnostics, HardwareInfo};
use std::path::PathBuf;
use std::sync::Arc;
use tauri::{AppHandle, Manager, State};

pub struct AppState {
    pub db: Arc<DatabaseManager>,
}

#[tauri::command]
pub fn get_machine_fingerprint_cmd() -> String {
    generate_machine_fingerprint()
}

#[tauri::command]
pub fn get_hardware_diagnostics_cmd() -> HardwareInfo {
    get_hardware_diagnostics()
}

#[tauri::command]
pub fn verify_local_license_cmd(
    token: Option<String>,
    state: State<'_, AppState>,
) -> Result<VerificationResult, String> {
    let now_ts = Utc::now().timestamp();

    // 1. Check Anti-Tamper Clock
    if let Err(e) = state.db.verify_and_update_clock(now_ts) {
        return Ok(VerificationResult {
            is_valid: false,
            state: crypto::LicenseState::TamperedClock,
            payload: None,
            message: e,
        });
    }

    // 2. Obtain token to verify (provided or loaded from SQLite cache)
    let token_to_verify = match token {
        Some(t) if !t.trim().is_empty() => t,
        _ => match state.db.load_cached_license() {
            Some(cached) => cached,
            None => {
                return Ok(VerificationResult {
                    is_valid: false,
                    state: crypto::LicenseState::Expired,
                    payload: None,
                    message: "No license token found. Device activation required.".to_string(),
                });
            }
        },
    };

    // 3. Perform cryptographic Ed25519 & Hardware verification
    let fingerprint = generate_machine_fingerprint();
    let result = verify_license_token(&token_to_verify, &fingerprint, now_ts);

    // 4. Update cache if valid
    if result.is_valid {
        let _ = state
            .db
            .save_cached_license(&token_to_verify, &fingerprint, now_ts);
    }

    Ok(result)
}

#[tauri::command]
pub fn save_license_cache_cmd(
    token: String,
    state: State<'_, AppState>,
) -> Result<(), String> {
    let now_ts = Utc::now().timestamp();
    let fingerprint = generate_machine_fingerprint();
    state.db.save_cached_license(&token, &fingerprint, now_ts)
}

#[tauri::command]
pub fn list_local_documents_cmd(
    state: State<'_, AppState>,
) -> Result<Vec<LocalDocument>, String> {
    state.db.list_documents()
}

#[tauri::command]
pub fn save_local_document_cmd(
    doc: LocalDocument,
    state: State<'_, AppState>,
) -> Result<(), String> {
    state.db.save_document(doc)
}

#[tauri::command]
pub fn delete_local_document_cmd(
    id: String,
    state: State<'_, AppState>,
) -> Result<(), String> {
    state.db.delete_document(&id)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_sql::Builder::new().build())
        .setup(|app| {
            let app_dir = app
                .path()
                .app_data_dir()
                .unwrap_or_else(|_| PathBuf::from("."));
            std::fs::create_dir_all(&app_dir).unwrap_or_default();
            let db_path = app_dir.join("appsaas_local.db");

            let db = DatabaseManager::new(db_path)
                .expect("Failed to initialize embedded SQLite database");

            app.manage(AppState { db: Arc::new(db) });
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            get_machine_fingerprint_cmd,
            get_hardware_diagnostics_cmd,
            verify_local_license_cmd,
            save_license_cache_cmd,
            list_local_documents_cmd,
            save_local_document_cmd,
            delete_local_document_cmd
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
