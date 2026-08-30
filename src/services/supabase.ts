import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || "https://wephfzqyrjdqgrxmwypn.supabase.co";
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || "sb_publishable_ady5n2IiVZHuNKXSdAEGAw_MkuOCC02";

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
});

export interface RPCActivationResult {
  success: boolean;
  error?: string;
  license_id?: string;
  user_id?: string;
  machine_fingerprint?: string;
  plan?: string;
  expires_at?: number;
  issued_at?: number;
}

export interface RPCVerificationResult {
  valid: boolean;
  reason?: string;
  license_id?: string;
  user_id?: string;
  machine_fingerprint?: string;
  plan?: string;
  expires_at?: number;
  issued_at?: number;
}

export const supabaseRPC = {
  async activateDeviceLicense(
    licenseKey: string,
    machineFingerprint: string,
    deviceName: string
  ): Promise<RPCActivationResult> {
    const { data, error } = await supabase.rpc("activate_device_license", {
      p_license_key: licenseKey,
      p_machine_fingerprint: machineFingerprint,
      p_device_name: deviceName,
    });

    if (error) throw error;
    return data as RPCActivationResult;
  },

  async verifyDeviceLicense(
    licenseKey: string,
    machineFingerprint: string
  ): Promise<RPCVerificationResult> {
    const { data, error } = await supabase.rpc("verify_device_license", {
      p_license_key: licenseKey,
      p_machine_fingerprint: machineFingerprint,
    });

    if (error) throw error;
    return data as RPCVerificationResult;
  },

  async logAgentTrace(
    agentId: string,
    sessionId: string,
    actionType: string,
    payload: any,
    verdict: string,
    reason?: string,
    latencyMs: number = 0
  ) {
    const { data, error } = await supabase.rpc("log_agent_trace", {
      p_agent_id: agentId,
      p_session_id: sessionId,
      p_action_type: actionType,
      p_payload: payload,
      p_verdict: verdict,
      p_reason: reason || null,
      p_latency_ms: latencyMs,
    });

    if (error) console.error("Error logging cloud trace:", error);
    return data;
  },
};
