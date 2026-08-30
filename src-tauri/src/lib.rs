// src-tauri/src/lib.rs
// ChronosAgent SafeState - Tauri Application Bootstrap & Entrypoint

pub mod commands;
pub mod crypto;
pub mod db;
pub mod fingerprint;
pub mod firewall;
pub mod proxy;
pub mod saga;

use commands::AppState;
use db::DatabaseManager;
use proxy::LocalProxyServer;
use saga::SagaEngine;
use std::path::PathBuf;
use std::sync::Arc;

pub fn run() {
    // 1. Resolve Local SQLite Database Path
    let db_path = std::env::current_dir()
        .unwrap_or_else(|_| PathBuf::from("."))
        .join("chronosagent_local.db");

    println!("[ChronosAgent] Initializing SQLite DB at {:?}", db_path);
    let db_manager = Arc::new(
        DatabaseManager::new(db_path).expect("Failed to initialize ChronosAgent SQLite database"),
    );

    // 2. Initialize Saga Compensation Engine
    let saga_engine = Arc::new(SagaEngine::new(db_manager.clone()));

    // 3. Start Local L7 Proxy Server on 127.0.0.1:4040
    let proxy_server = Arc::new(LocalProxyServer::new(
        db_manager.clone(),
        saga_engine.clone(),
        4040,
    ));
    proxy_server.start();

    // 4. Setup Tauri App State & Handlers
    let app_state = AppState {
        db: db_manager,
        saga: saga_engine,
    };

    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .manage(app_state)
        .invoke_handler(tauri::generate_handler![
            commands::get_machine_fingerprint,
            commands::verify_local_license,
            commands::save_cached_license,
            commands::load_cached_license,
            commands::get_recent_traces,
            commands::get_cow_snapshots,
            commands::get_saga_compensations,
            commands::trigger_saga_rollback,
            commands::get_security_policy,
            commands::update_security_policy,
            commands::simulate_agent_action,
        ])
        .run(tauri::generate_context!())
        .expect("error while running ChronosAgent Tauri application");
}
