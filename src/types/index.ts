// src/types/index.ts

export type LicenseStateEnum =
  | "ACTIVE"
  | "OFFLINE_GRACE_PERIOD"
  | "EXPIRED"
  | "READ_ONLY"
  | "TAMPERED_CLOCK"
  | "UNACTIVATED";

export interface LicensePayload {
  user_id: string;
  license_id: string;
  machine_fingerprint: string;
  plan: string;
  status: string;
  issued_at: number;
  expires_at: number;
  grace_days: number;
}

export interface VerificationResult {
  is_valid: boolean;
  state:
    | "Active"
    | { OfflineGracePeriod: { days_left: number } }
    | "Expired"
    | "FingerprintMismatch"
    | "InvalidSignature"
    | "TamperedClock";
  payload: LicensePayload | null;
  message: string;
}

export interface HardwareInfo {
  hostname: string;
  os_name: string;
  os_version: string;
  cpu_brand: string;
  cpu_core_count: number;
  total_memory_mb: number;
  machine_fingerprint: string;
}

export interface LocalDocument {
  id: string;
  title: string;
  content: string;
  category: string;
  created_at: number;
  updated_at: number;
}

export interface UserProfile {
  id: string;
  email: string;
  full_name?: string;
}
