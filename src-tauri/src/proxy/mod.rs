// src-tauri/src/proxy/mod.rs
// Local L7 HTTP Proxy Server & Interception Guardrail (127.0.0.1:4040)

use crate::db::{CoWSnapshot, DatabaseManager, TraceRecord};
use crate::firewall::{IntentFirewall, Verdict};
use crate::saga::SagaEngine;
use std::sync::Arc;
use std::time::{SystemTime, UNIX_EPOCH};
use tiny_http::{Header, Response, Server, StatusCode};

pub struct LocalProxyServer {
    db: Arc<DatabaseManager>,
    saga: Arc<SagaEngine>,
    port: u16,
}

impl LocalProxyServer {
    pub fn new(db: Arc<DatabaseManager>, saga: Arc<SagaEngine>, port: u16) -> Self {
        Self { db, saga, port }
    }

    /// Starts the local proxy server on a background OS thread
    pub fn start(self: Arc<Self>) {
        let addr = format!("127.0.0.1:{}", self.port);
        std::thread::spawn(move || {
            let server = match Server::http(&addr) {
                Ok(s) => {
                    println!("[ChronosAgent] Proxy running on http://{}", addr);
                    s
                }
                Err(e) => {
                    eprintln!("[ChronosAgent] Failed to bind proxy server on {}: {}", addr, e);
                    return;
                }
            };

            for mut request in server.incoming_requests() {
                let this = self.clone();
                // Handle each incoming request
                let method = request.method().as_str().to_string();
                let url = request.url().to_string();

                // Extract custom headers
                let mut agent_id = "agent-generic".to_string();
                let mut session_id = "session-main".to_string();
                let mut agent_prompt = None;
                let mut target_url = url.clone();
                let mut saga_compensate = None;
                let mut saga_service = "ExternalAPI".to_string();

                for h in request.headers() {
                    let field = h.field.as_str().as_str().to_lowercase();
                    let val = h.value.as_str().to_string();
                    match field.as_str() {
                        "x-agent-id" => agent_id = val,
                        "x-session-id" => session_id = val,
                        "x-agent-prompt" => agent_prompt = Some(val),
                        "x-target-url" => target_url = val,
                        "x-saga-compensate" => saga_compensate = Some(val),
                        "x-saga-service" => saga_service = val,
                        _ => {}
                    }
                }

                // Internal Health / Status Route
                if url == "/health" || url == "/status" {
                    let json = r#"{"status":"active","guardrail":"Zero-Trust L7","port":4040}"#;
                    let resp = Response::from_string(json).with_header(
                        Header::from_bytes(&b"Content-Type"[..], &b"application/json"[..]).unwrap(),
                    );
                    let _ = request.respond(resp);
                    continue;
                }

                // Read request body
                let mut body_bytes = Vec::new();
                let _ = request.as_reader().read_to_end(&mut body_bytes);
                let body_str = String::from_utf8_lossy(&body_bytes).to_string();

                // Get current active policy
                let policy = this.db.get_policy().unwrap_or_else(|_| crate::db::LocalSecurityPolicy {
                    id: "default".into(),
                    name: "Fallback Policy".into(),
                    max_execution_time_sec: 30,
                    allowed_domains: vec!["api.github.com".into(), "api.stripe.com".into(), "api.openai.com".into()],
                    blocked_syscalls: vec!["sys_raw_socket".into(), "execve".into()],
                    auto_rollback_on_error: true,
                    updated_at: 0,
                });

                // Evaluate via Intent Firewall
                let (verdict, latency_us) = IntentFirewall::evaluate(
                    &method,
                    &target_url,
                    &body_str,
                    agent_prompt.as_deref(),
                    &policy,
                );

                let now_ts = SystemTime::now()
                    .duration_since(UNIX_EPOCH)
                    .unwrap_or_default()
                    .as_secs() as i64;

                match verdict {
                    Verdict::Blocked { reason } => {
                        // Log trace in DB
                        let trace_id = format!("tr-{}", uuid::Uuid::new_v4());
                        let _ = this.db.insert_trace(&TraceRecord {
                            id: trace_id,
                            agent_id: agent_id.clone(),
                            session_id: session_id.clone(),
                            action_type: format!("{} {}", method, target_url),
                            payload: body_str,
                            verdict: "BLOCKED".to_string(),
                            reason: Some(reason.clone()),
                            latency_ms: (latency_us / 1000) as i64,
                            created_at: now_ts,
                        });

                        // Auto-rollback via Saga if configured
                        if policy.auto_rollback_on_error {
                            let _ = tokio::runtime::Handle::current_alt_or_spawn(&this.saga, &session_id);
                        }

                        let err_json = format!(
                            r#"{{"error":"ChronosAgent Guardrail Blocked Action","verdict":"BLOCKED","reason":"{}","latency_ms":{}}}"#,
                            reason.replace('"', "\\\""),
                            (latency_us / 1000) as i64
                        );

                        let resp = Response::from_string(err_json)
                            .with_status_code(StatusCode(403))
                            .with_header(Header::from_bytes(&b"Content-Type"[..], &b"application/json"[..]).unwrap());
                        let _ = request.respond(resp);
                    }
                    Verdict::Allowed => {
                        // Capture CoW snapshot differential before release
                        let snapshot_id = format!("cow-{}", uuid::Uuid::new_v4());
                        let _ = this.db.insert_cow_snapshot(&CoWSnapshot {
                            id: snapshot_id,
                            session_id: session_id.clone(),
                            agent_id: agent_id.clone(),
                            step_index: now_ts,
                            state_diff: format!(
                                r#"{{"action":"{}","url":"{}","body_preview":"{}"}}"#,
                                method,
                                target_url,
                                body_str.chars().take(200).collect::<String>().replace('"', "\\\"")
                            ),
                            captured_at: now_ts,
                        });

                        // Register Saga Compensation if specified
                        if let Some(comp_action) = saga_compensate {
                            let _ = this.saga.register_action(
                                &session_id,
                                &agent_id,
                                &format!("{} {}", method, target_url),
                                &comp_action,
                                &saga_service,
                                &body_str,
                            );
                        }

                        // Log trace in DB
                        let trace_id = format!("tr-{}", uuid::Uuid::new_v4());
                        let _ = this.db.insert_trace(&TraceRecord {
                            id: trace_id,
                            agent_id: agent_id.clone(),
                            session_id: session_id.clone(),
                            action_type: format!("{} {}", method, target_url),
                            payload: body_str,
                            verdict: "ALLOWED".to_string(),
                            reason: None,
                            latency_ms: (latency_us / 1000) as i64,
                            created_at: now_ts,
                        });

                        // Synthetic response or upstream proxy forward
                        let success_json = format!(
                            r#"{{"status":"success","guardrail":"ALLOWED","action":"{}","target":"{}","latency_ms":{}}}"#,
                            method,
                            target_url,
                            (latency_us / 1000) as i64
                        );

                        let resp = Response::from_string(success_json)
                            .with_status_code(StatusCode(200))
                            .with_header(Header::from_bytes(&b"Content-Type"[..], &b"application/json"[..]).unwrap());
                        let _ = request.respond(resp);
                    }
                }
            }
        });
    }
}

trait TokioHandleExt {
    fn current_alt_or_spawn(saga: &Arc<SagaEngine>, session_id: &str);
}

impl TokioHandleExt for tokio::runtime::Handle {
    fn current_alt_or_spawn(saga: &Arc<SagaEngine>, session_id: &str) {
        let saga_clone = saga.clone();
        let sid = session_id.to_string();
        std::thread::spawn(move || {
            let rt = tokio::runtime::Runtime::new().unwrap();
            let _ = rt.block_on(saga_clone.rollback_session(&sid));
        });
    }
}
