// src-tauri/src/firewall/mod.rs
// Semantic Intent Firewall (<15ms evaluation latency)

use crate::db::LocalSecurityPolicy;
use serde::{Deserialize, Serialize};
use std::time::Instant;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum Verdict {
    Allowed,
    Blocked { reason: String },
}

pub struct IntentFirewall;

impl IntentFirewall {
    /// Evaluates an intercepted action against the active security policy and semantic intent
    pub fn evaluate(
        method: &str,
        target_url: &str,
        payload_body: &str,
        agent_prompt: Option<&str>,
        policy: &LocalSecurityPolicy,
    ) -> (Verdict, u128) {
        let start = Instant::now();

        // 1. Domain allowlist check
        let domain_allowed = if let Ok(parsed_url) = reqwest::Url::parse(target_url) {
            if let Some(host) = parsed_url.host_str() {
                policy.allowed_domains.iter().any(|d| host == d || host.ends_with(&format!(".{}", d)))
            } else {
                false
            }
        } else {
            // Check substring in target_url
            policy.allowed_domains.iter().any(|d| target_url.contains(d))
        };

        if !domain_allowed && !policy.allowed_domains.is_empty() {
            let latency_us = start.elapsed().as_micros();
            return (
                Verdict::Blocked {
                    reason: format!("Target domain not in allowed domains list: {}", target_url),
                },
                latency_us,
            );
        }

        // 2. Destructive Command / Syscall Inspection
        let lowercase_body = payload_body.to_lowercase();
        let lowercase_url = target_url.to_lowercase();

        for blocked in &policy.blocked_syscalls {
            let blocked_lower = blocked.to_lowercase();
            if lowercase_body.contains(&blocked_lower) || lowercase_url.contains(&blocked_lower) {
                let latency_us = start.elapsed().as_micros();
                return (
                    Verdict::Blocked {
                        reason: format!("Blocked dangerous pattern/syscall detected: '{}'", blocked),
                    },
                    latency_us,
                );
            }
        }

        // 3. Destructive SQL / Shell Guardrails
        let destructive_patterns = [
            "rm -rf",
            "drop table",
            "truncate table",
            "delete from users",
            "shutdown",
            ":(){ :|:& };:",
            "format c:",
        ];

        for pattern in &destructive_patterns {
            if lowercase_body.contains(pattern) || lowercase_url.contains(pattern) {
                // If the user's prompt explicitly did NOT ask for destructive operations, block it
                let is_explicitly_requested = agent_prompt
                    .map(|p| p.to_lowercase().contains(pattern))
                    .unwrap_or(false);

                if !is_explicitly_requested {
                    let latency_us = start.elapsed().as_micros();
                    return (
                        Verdict::Blocked {
                            reason: format!("Destructive operation '{}' blocked: mismatch with benign agent prompt", pattern),
                        },
                        latency_us,
                    );
                }
            }
        }

        // 4. HTTP Method constraints
        if method == "DELETE" && !policy.allowed_domains.iter().any(|d| target_url.contains(d)) {
            let latency_us = start.elapsed().as_micros();
            return (
                Verdict::Blocked {
                    reason: "Unrestricted HTTP DELETE prohibited by Zero-Trust policy".into(),
                },
                latency_us,
            );
        }

        let latency_us = start.elapsed().as_micros();
        (Verdict::Allowed, latency_us)
    }
}
