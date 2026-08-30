// src/services/supabase.ts
// Supabase Client with Environment Configuration

import { createClient } from "@supabase/supabase-js";

const supabaseUrl =
  import.meta.env.VITE_SUPABASE_URL ||
  "https://wephfzqyrjdqgrxmwypn.supabase.co";
const supabaseAnonKey =
  import.meta.env.VITE_SUPABASE_ANON_KEY ||
  "sb_publishable_ady5n2IiVZHuNKXSdAEGAw_MkuOCC02";

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
});

/**
 * Invoke the /activate-license Edge Function
 */
export async function activateDeviceLicense(
  machineFingerprint: string,
  deviceName: string
): Promise<{ success: boolean; license_token?: string; error?: string }> {
  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      return { success: false, error: "Usuario no autenticado en Supabase" };
    }

    const response = await fetch(`${supabaseUrl}/functions/v1/activate-license`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({
        machine_fingerprint: machineFingerprint,
        device_name: deviceName,
      }),
    });

    const data = await response.json();
    if (!response.ok) {
      return { success: false, error: data.error || "Error al activar licencia" };
    }

    return { success: true, license_token: data.license_token };
  } catch (err: any) {
    return { success: false, error: err.message || "Error de red" };
  }
}
