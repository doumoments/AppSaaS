// src-tauri/src/crypto/mod.rs
// Asymmetric Cryptographic License Verification (Ed25519) & Anti-Tamper Clock Module

use ed25519_dalek::{Signature, VerifyingKey, Verifier};
use serde::{Deserialize, Serialize};
use std::time::{SystemTime, UNIX_EPOCH};

pub const EMBEDDED_PUBLIC_KEY_HEX: &str =
    "909465fb30e096f87bc3ecba52288495c0ef7613a8210045ff15d9ca9b7e56b6";

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LicensePayload {
    pub license_id: String,
    pub user_id: String,
    pub machine_fingerprint: String,
    pub plan: String,
    pub expires_at: i64,
    pub issued_at: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VerificationResult {
    pub is_valid: bool,
    pub payload: Option<LicensePayload>,
    pub error: Option<String>,
    pub days_remaining: i64,
}

pub struct CryptoEngine;

impl CryptoEngine {
    /// Verifies an Ed25519 signed license token against the embedded Public Key
    /// Token format: `<base64_payload>.<signature_hex>`
    pub fn verify_license_token(
        token: &str,
        current_fingerprint: &str,
    ) -> Result<VerificationResult, String> {
        let parts: Vec<&str> = token.trim().split('.').collect();
        if parts.len() != 2 {
            return Ok(VerificationResult {
                is_valid: false,
                payload: None,
                error: Some("Invalid token structure. Expected <payload_base64>.<sig_hex>".into()),
                days_remaining: 0,
            });
        }

        let payload_b64 = parts[0];
        let sig_hex = parts[1];

        // 1. Decode Payload
        let payload_bytes = match base64_decode(payload_b64) {
            Ok(bytes) => bytes,
            Err(e) => {
                return Ok(VerificationResult {
                    is_valid: false,
                    payload: None,
                    error: Some(format!("Failed to decode payload Base64: {}", e)),
                    days_remaining: 0,
                })
            }
        };

        let payload: LicensePayload = match serde_json::from_slice(&payload_bytes) {
            Ok(p) => p,
            Err(e) => {
                return Ok(VerificationResult {
                    is_valid: false,
                    payload: None,
                    error: Some(format!("Invalid JSON payload in token: {}", e)),
                    days_remaining: 0,
                })
            }
        };

        // 2. Decode Signature
        let sig_bytes = match hex::decode(sig_hex) {
            Ok(b) => b,
            Err(e) => {
                return Ok(VerificationResult {
                    is_valid: false,
                    payload: Some(payload),
                    error: Some(format!("Invalid signature hex format: {}", e)),
                    days_remaining: 0,
                })
            }
        };

        let signature = match Signature::from_slice(&sig_bytes) {
            Ok(sig) => sig,
            Err(e) => {
                return Ok(VerificationResult {
                    is_valid: false,
                    payload: Some(payload),
                    error: Some(format!("Invalid signature bytes length: {}", e)),
                    days_remaining: 0,
                })
            }
        };

        // 3. Decode Embedded Public Key
        let pub_key_bytes = match hex::decode(EMBEDDED_PUBLIC_KEY_HEX) {
            Ok(b) => b,
            Err(e) => return Err(format!("Corrupt embedded public key hex: {}", e)),
        };

        let verifying_key = match VerifyingKey::from_bytes(
            pub_key_bytes.as_slice().try_into().map_err(|_| "Invalid public key slice length")?,
        ) {
            Ok(vk) => vk,
            Err(e) => return Err(format!("Failed to parse Ed25519 verifying key: {}", e)),
        };

        // 4. Cryptographic Signature Verification
        if let Err(e) = verifying_key.verify(&payload_bytes, &signature) {
            return Ok(VerificationResult {
                is_valid: false,
                payload: Some(payload),
                error: Some(format!("Cryptographic signature verification failed: {}", e)),
                days_remaining: 0,
            });
        }

        // 5. Hardware Fingerprint Validation
        if payload.machine_fingerprint != current_fingerprint {
            return Ok(VerificationResult {
                is_valid: false,
                payload: Some(payload),
                error: Some(format!(
                    "Hardware mismatch! Bound to: {}, Current: {}",
                    payload.machine_fingerprint, current_fingerprint
                )),
                days_remaining: 0,
            });
        }

        // 6. Expiration Validation
        let now_ts = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map_err(|e| e.to_string())?
            .as_secs() as i64;

        if payload.expires_at <= now_ts {
            return Ok(VerificationResult {
                is_valid: false,
                payload: Some(payload),
                error: Some("License expired".into()),
                days_remaining: 0,
            });
        }

        let seconds_left = payload.expires_at - now_ts;
        let days_remaining = seconds_left / 86400;

        Ok(VerificationResult {
            is_valid: true,
            payload: Some(payload),
            error: None,
            days_remaining: days_remaining.max(1),
        })
    }
}

/// Lightweight Base64 standard decoder
fn base64_decode(input: &str) -> Result<Vec<u8>, String> {
    const TABLE: &[u8; 64] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    let mut clean = input.replace('=', "");
    clean.retain(|c| !c.is_whitespace());

    let mut output = Vec::new();
    let mut buf = 0u32;
    let mut bits = 0;

    for byte in clean.bytes() {
        let val = TABLE
            .iter()
            .position(|&x| x == byte)
            .ok_or_else(|| format!("Invalid Base64 character: {}", byte as char))? as u32;

        buf = (buf << 6) | val;
        bits += 6;

        if bits >= 8 {
            bits -= 8;
            output.push((buf >> bits) as u8);
            buf &= (1 << bits) - 1;
        }
    }

    Ok(output)
}
