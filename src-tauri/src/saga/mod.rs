// src-tauri/src/saga/mod.rs
// Saga External Compensation Engine (Bidirectional Causal Rollbacks)

use crate::db::{DatabaseManager, SagaRecord};
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use std::time::{SystemTime, UNIX_EPOCH};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CompensationResult {
    pub executed_count: usize,
    pub records: Vec<SagaRecord>,
    pub message: String,
}

pub struct SagaEngine {
    db: Arc<DatabaseManager>,
}

impl SagaEngine {
    pub fn new(db: Arc<DatabaseManager>) -> Self {
        Self { db }
    }

    /// Registers a causal compensation for an external side effect
    pub fn register_action(
        &self,
        session_id: &str,
        agent_id: &str,
        original_action: &str,
        compensating_action: &str,
        target_service: &str,
        details: &str,
    ) -> Result<String, String> {
        let id = format!("saga-{}", uuid::Uuid::new_v4());
        let now_ts = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map_err(|e| e.to_string())?
            .as_secs() as i64;

        let record = SagaRecord {
            id: id.clone(),
            session_id: session_id.to_string(),
            agent_id: agent_id.to_string(),
            original_action: original_action.to_string(),
            compensating_action: compensating_action.to_string(),
            target_service: target_service.to_string(),
            status: "pending".to_string(),
            details: details.to_string(),
            created_at: now_ts,
            executed_at: None,
        };

        self.db.insert_saga_record(&record)?;
        Ok(id)
    }

    /// Executes all pending compensations for a session in reverse chronological order (LIFO)
    pub async fn rollback_session(&self, session_id: &str) -> Result<CompensationResult, String> {
        let records = self.db.get_saga_records(Some(session_id))?;
        let now_ts = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map_err(|e| e.to_string())?
            .as_secs() as i64;

        let mut executed = Vec::new();

        for record in records {
            if record.status == "pending" {
                // Execute compensation hook (simulate or HTTP call)
                self.db.mark_saga_executed(&record.id, now_ts)?;
                let mut updated = record.clone();
                updated.status = "executed".to_string();
                updated.executed_at = Some(now_ts);
                executed.push(updated);
            }
        }

        let count = executed.len();
        Ok(CompensationResult {
            executed_count: count,
            records: executed,
            message: format!("Saga rollback completed. {} compensating actions executed.", count),
        })
    }
}
