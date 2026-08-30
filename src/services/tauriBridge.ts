// src/services/tauriBridge.ts
// Robust IPC Bridge between React UI and Rust Core (with browser mock fallback)

import { invoke } from "@tauri-apps/api/core";
import { HardwareInfo, LocalDocument, VerificationResult } from "../types";

// Check if running inside Tauri runtime
export const isTauri = (): boolean => {
  return typeof window !== "undefined" && Boolean((window as any).__TAURI_INTERNALS__);
};

export async function getMachineFingerprint(): Promise<string> {
  if (isTauri()) {
    return await invoke<string>("get_machine_fingerprint_cmd");
  }
  // Browser dev fallback
  return "dev_hw_fingerprint_" + Math.abs(navigator.userAgent.split("").reduce((a, b) => ((a << 5) - a) + b.charCodeAt(0), 0)).toString(16);
}

export async function getHardwareDiagnostics(): Promise<HardwareInfo> {
  if (isTauri()) {
    return await invoke<HardwareInfo>("get_hardware_diagnostics_cmd");
  }
  return {
    hostname: "DESKTOP-CLIENT",
    os_name: "Windows (Dev Browser)",
    os_version: "10.0.19045",
    cpu_brand: "AMD Ryzen / Intel Core (Virtual)",
    cpu_core_count: 8,
    total_memory_mb: 16384,
    machine_fingerprint: await getMachineFingerprint(),
  };
}

export async function verifyLocalLicense(token?: string): Promise<VerificationResult> {
  if (isTauri()) {
    return await invoke<VerificationResult>("verify_local_license_cmd", { token });
  }

  // Browser dev simulation
  const cached = localStorage.getItem("appsaas_license_token");
  const tokenToVerify = token || cached;

  if (!tokenToVerify) {
    return {
      is_valid: false,
      state: "Expired",
      payload: null,
      message: "No license token found in cache. Activation required.",
    };
  }

  try {
    const raw = JSON.parse(decodeURIComponent(escape(atob(tokenToVerify))));
    return {
      is_valid: true,
      state: "Active",
      payload: raw.payload,
      message: "License token is active and valid (Dev Simulation).",
    };
  } catch (e) {
    return {
      is_valid: false,
      state: "InvalidSignature",
      payload: null,
      message: "Invalid token format.",
    };
  }
}

export async function saveLicenseCache(token: string): Promise<void> {
  if (isTauri()) {
    await invoke("save_license_cache_cmd", { token });
  } else {
    localStorage.setItem("appsaas_license_token", token);
  }
}

export async function listLocalDocuments(): Promise<LocalDocument[]> {
  if (isTauri()) {
    return await invoke<LocalDocument[]>("list_local_documents_cmd");
  }
  const raw = localStorage.getItem("appsaas_local_docs");
  return raw ? JSON.parse(raw) : [];
}

export async function saveLocalDocument(doc: LocalDocument): Promise<void> {
  if (isTauri()) {
    await invoke("save_local_document_cmd", { doc });
  } else {
    const docs = await listLocalDocuments();
    const existingIdx = docs.findIndex((d) => d.id === doc.id);
    if (existingIdx >= 0) {
      docs[existingIdx] = doc;
    } else {
      docs.unshift(doc);
    }
    localStorage.setItem("appsaas_local_docs", JSON.stringify(docs));
  }
}

export async function deleteLocalDocument(id: string): Promise<void> {
  if (isTauri()) {
    await invoke("delete_local_document_cmd", { id });
  } else {
    const docs = await listLocalDocuments();
    const filtered = docs.filter((d) => d.id !== id);
    localStorage.setItem("appsaas_local_docs", JSON.stringify(filtered));
  }
}
