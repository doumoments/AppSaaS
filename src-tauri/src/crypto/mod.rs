// src-tauri/src/crypto/mod.rs
// Asymmetric Ed25519 Cryptographic Verification & License Policy Engine

use base64::engine::general_purpose::STANDARD as BASE64;
use base64::Engine;
use chrono::Utc;
use ed25519_dalek::{Signature, Verifier, VerifyingKey};
use serde::{Deserialize, Serialize};

/// Embedded Public Key for signature validation (Public only, mathematically secure)
pub const EMBEDDED_PUBLIC_KEY_HEX: &str =
    "909465fb30e096f87bc3ecba52288495c0ef7613a8210045ff15d9ca9b7e56b6";

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct LicensePayload {
    pub user_id: String,
    pub license_id: String,
    pub machine_fingerprint: String,
    pub plan: String,
    pub status: String,
    pub issued_at: i64,
    pub expires_at: i64,
    pub grace_days: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SignedLicenseToken {
    pub payload: LicensePayload,
    pub signature: String, // Base64 encoded 64-byte Ed25519 signature
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum LicenseState {
    Active,
    OfflineGracePeriod { days_left: i64 },
    Expired,
    FingerprintMismatch,
    InvalidSignature,
    TamperedClock,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VerificationResult {
    pub is_valid: bool,
    pub state: LicenseState,
    pub payload: Option<LicensePayload>,
    pub message: String,
}

/// Verifies a base64 encoded license token against the embedded Ed25519 public key
pub fn verify_license_token(
    token_str: &str,
    current_fingerprint: &str,
    current_time_sec: i64,
) -> VerificationResult {
    // 1. Decode outer base64 JSON string
    let token_bytes = match BASE64.decode(token_str.trim()) {
        Ok(b) => b,
        Err(e) => {
            return VerificationResult {
                is_valid: false,
                state: LicenseState::InvalidSignature,
                payload: None,
                message: format!("Token Base64 decoding failed: {}", e),
            }
        }
    };

    let token_json = match String::from_utf8(token_bytes) {
        Ok(s) => s,
        Err(e) => {
            return VerificationResult {
                is_valid: false,
                state: LicenseState::InvalidSignature,
                payload: None,
                message: format!("Token UTF-8 decoding failed: {}", e),
            }
        }
    };

    // 2. Deserialize SignedLicenseToken envelope
    let signed_token: SignedLicenseToken = match serde_json::from_str(&token_json) {
        Ok(st) => st,
        Err(e) => {
            return VerificationResult {
                is_valid: false,
                state: LicenseState::InvalidSignature,
                payload: None,
                message: format!("Token JSON schema invalid: {}", e),
            }
        }
    };

    // 3. Reconstruct canonical payload JSON bytes
    let payload_canonical_json = match serde_json::to_string(&signed_token.payload) {
        Ok(s) => s,
        Err(e) => {
            return VerificationResult {
                is_valid: false,
                state: LicenseState::InvalidSignature,
                payload: None,
                message: format!("Payload canonical serialization failed: {}", e),
            }
        }
    };

    // 4. Verify Ed25519 Cryptographic Signature
    let pubkey_bytes = match hex::decode(EMBEDDED_PUBLIC_KEY_HEX) {
        Ok(b) => b,
        Err(e) => {
            return VerificationResult {
                is_valid: false,
                state: LicenseState::InvalidSignature,
                payload: None,
                message: format!("Public key hex decode error: {}", e),
            }
        }
    };

    let pubkey_array: [u8; 32] = match pubkey_bytes.try_into() {
        Ok(arr) => arr,
        Err(_) => {
            return VerificationResult {
                is_valid: false,
                state: LicenseState::InvalidSignature,
                payload: None,
                message: "Public key byte length is not 32 bytes".to_string(),
            }
        }
    };

    let verifying_key = match VerifyingKey::from_bytes(&pubkey_array) {
        Ok(vk) => vk,
        Err(e) => {
            return VerificationResult {
                is_valid: false,
                state: LicenseState::InvalidSignature,
                payload: None,
                message: format!("Invalid Ed25519 verifying key: {}", e),
            }
        }
    };

    let sig_bytes = match BASE64.decode(&signed_token.signature) {
        Ok(b) => b,
        Err(e) => {
            return VerificationResult {
                is_valid: false,
                state: LicenseState::InvalidSignature,
                payload: None,
                message: format!("Signature Base64 decode error: {}", e),
            }
        }
    };

    let sig_array: [u8; 64] = match sig_bytes.try_into() {
        Ok(arr) => arr,
        Err(_) => {
            return VerificationResult {
                is_valid: false,
                state: LicenseState::InvalidSignature,
                payload: None,
                message: "Signature byte length is not 64 bytes".to_string(),
            }
        }
    };

    let signature = Signature::from_bytes(&sig_array);

    if let Err(e) = verifying_key.verify(payload_canonical_json.as_bytes(), &signature) {
        return VerificationResult {
            is_valid: false,
            state: LicenseState::InvalidSignature,
            payload: None,
            message: format!("Cryptographic signature verification failed: {}", e),
        };
    }

    // 5. Verify Machine Fingerprint
    if signed_token.payload.machine_fingerprint != current_fingerprint {
        return VerificationResult {
            is_valid: false,
            state: LicenseState::FingerprintMismatch,
            payload: Some(signed_token.payload),
            message: "License token belongs to a different machine hardware ID".to_string(),
        };
    }

    // 6. Check Expiration & Offline Grace Period Logic
    let expires_at = signed_token.payload.expires_at;
    let grace_seconds = signed_token.payload.grace_days * 86400;
    let hard_cutoff = expires_at + grace_seconds;

    if current_time_sec <= expires_at {
        VerificationResult {
            is_valid: true,
            state: LicenseState::Active,
            payload: Some(signed_token.payload),
            message: "License is active and valid.".to_string(),
        }
    } else if current_time_sec <= hard_cutoff {
        let remaining_grace_sec = hard_cutoff - current_time_sec;
        let days_left = (remaining_grace_sec / 86400).max(1);
        VerificationResult {
            is_valid: true,
            state: LicenseState::OfflineGracePeriod { days_left },
            payload: Some(signed_token.payload),
            message: format!(
                "License expired. Operating in Offline Grace Period ({} days remaining).",
                days_left
            ),
        }
    } else {
        VerificationResult {
            is_valid: false,
            state: LicenseState::Expired,
            payload: Some(signed_token.payload),
            message: "License has fully expired and grace period elapsed.".to_string(),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_invalid_base64_token() {
        let res = verify_license_token("invalid_base64!", "some_fingerprint", 1700000000);
        assert!(!res.is_valid);
        assert_eq!(res.state, LicenseState::InvalidSignature);
    }

    #[test]
    fn test_tampered_json_token() {
        let fake_b64 = BASE64.encode(b"not json");
        let res = verify_license_token(&fake_b64, "some_fingerprint", 1700000000);
        assert!(!res.is_valid);
        assert_eq!(res.state, LicenseState::InvalidSignature);
    }
}

