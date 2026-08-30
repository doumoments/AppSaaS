// src-tauri/src/fingerprint/mod.rs
// Deterministic and Immutable Hardware Fingerprint Generator

use sha2::{Digest, Sha256};
use sysinfo::System;

pub struct HardwareFingerprint;

impl HardwareFingerprint {
    /// Generates a deterministic SHA-256 fingerprint from immutable hardware identifiers
    pub fn get() -> String {
        let mut sys = System::new_all();
        sys.refresh_all();

        let mut hasher = Sha256::new();

        // 1. Hostname / System Name
        if let Some(host_name) = System::host_name() {
            hasher.update(host_name.as_bytes());
        } else {
            hasher.update(b"default-chronos-host");
        }

        // 2. OS Version and Long Name
        if let Some(os_name) = System::long_os_version() {
            hasher.update(os_name.as_bytes());
        }

        // 3. CPU Physical IDs and Vendor Info
        let cpus = sys.cpus();
        if !cpus.is_empty() {
            let cpu_brand = cpus[0].brand();
            let cpu_vendor = cpus[0].vendor_id();
            hasher.update(cpu_brand.as_bytes());
            hasher.update(cpu_vendor.as_bytes());
            hasher.update(&(cpus.len() as u32).to_le_bytes());
        } else {
            hasher.update(b"generic-cpu-architecture");
        }

        // 4. Total Memory rounded to nearest 512MB to avoid dynamic jitter
        let total_mem = sys.total_memory();
        let rounded_mem = (total_mem / (512 * 1024 * 1024)) * (512 * 1024 * 1024);
        hasher.update(&rounded_mem.to_le_bytes());

        // 5. Append static domain separator salt
        hasher.update(b"::chronosagent-safestate-hwid-v1");

        hex::encode(hasher.finalize())
    }
}
