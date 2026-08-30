// src-tauri/src/fingerprint/mod.rs
// Deterministic and Immutable Hardware Fingerprint Generator

use sha2::{Digest, Sha256};
use sysinfo::System;

#[derive(Debug, serde::Serialize, serde::Deserialize)]
pub struct HardwareInfo {
    pub hostname: String,
    pub os_name: String,
    pub os_version: String,
    pub cpu_brand: String,
    pub cpu_core_count: usize,
    pub total_memory_mb: u64,
    pub machine_fingerprint: String,
}

/// Generates a unique, deterministic SHA-256 hardware fingerprint based on system identity
pub fn generate_machine_fingerprint() -> String {
    let mut sys = System::new_all();
    sys.refresh_all();

    let hostname = System::host_name().unwrap_or_else(|| "unknown-host".to_string());
    let os_name = System::name().unwrap_or_else(|| "windows".to_string());
    let os_version = System::os_version().unwrap_or_else(|| "10.0".to_string());
    
    let cpus = sys.cpus();
    let cpu_brand = if !cpus.is_empty() {
        cpus[0].brand().to_string()
    } else {
        "generic-cpu".to_string()
    };
    let cpu_count = cpus.len();
    let total_memory = sys.total_memory() / (1024 * 1024); // MB

    // Feed attributes into SHA-256 hasher
    let mut hasher = Sha256::new();
    hasher.update(hostname.as_bytes());
    hasher.update(b"::");
    hasher.update(os_name.as_bytes());
    hasher.update(b"::");
    hasher.update(os_version.as_bytes());
    hasher.update(b"::");
    hasher.update(cpu_brand.as_bytes());
    hasher.update(b"::");
    hasher.update(cpu_count.to_string().as_bytes());
    hasher.update(b"::");
    hasher.update((total_memory / 1024).to_string().as_bytes()); // rounded to GB for stability

    let result = hasher.finalize();
    hex::encode(result)
}

/// Returns full hardware diagnostics along with fingerprint
pub fn get_hardware_diagnostics() -> HardwareInfo {
    let mut sys = System::new_all();
    sys.refresh_all();

    let hostname = System::host_name().unwrap_or_else(|| "unknown-host".to_string());
    let os_name = System::name().unwrap_or_else(|| "windows".to_string());
    let os_version = System::os_version().unwrap_or_else(|| "10.0".to_string());
    
    let cpus = sys.cpus();
    let cpu_brand = if !cpus.is_empty() {
        cpus[0].brand().to_string()
    } else {
        "generic-cpu".to_string()
    };
    let cpu_core_count = cpus.len();
    let total_memory_mb = sys.total_memory() / (1024 * 1024);
    let machine_fingerprint = generate_machine_fingerprint();

    HardwareInfo {
        hostname,
        os_name,
        os_version,
        cpu_brand,
        cpu_core_count,
        total_memory_mb,
        machine_fingerprint,
    }
}
