// supabase/functions/verify-license/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { signLicensePayload, LicensePayload } from "../_shared/crypto.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const privateKeyHex = Deno.env.get("LICENSE_PRIVATE_KEY_HEX") ?? "a703af26b525b55db9fe7431c6d663f7032b6b4810581f264319b4d1a52736e8";

    const { license_id, machine_fingerprint } = await req.json();
    if (!license_id || !machine_fingerprint) {
      return new Response(JSON.stringify({ error: "Missing license_id or machine_fingerprint" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // 1. Fetch license
    const { data: license, error: licErr } = await supabaseAdmin
      .from("licenses")
      .select("*, user_id, status")
      .eq("id", license_id)
      .single();

    if (licErr || !license || license.status !== "active") {
      return new Response(JSON.stringify({ valid: false, error: "License not found or inactive" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 2. Fetch device activation
    const { data: activation, error: actErr } = await supabaseAdmin
      .from("device_activations")
      .select("*")
      .eq("license_id", license_id)
      .eq("machine_fingerprint", machine_fingerprint)
      .single();

    if (actErr || !activation) {
      return new Response(JSON.stringify({ valid: false, error: "Device not registered for this license" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 3. Update last_seen_at
    const now = new Date();
    await supabaseAdmin
      .from("device_activations")
      .update({ last_seen_at: now.toISOString() })
      .eq("id", activation.id);

    // 4. Check subscription status
    const { data: subs } = await supabaseAdmin
      .from("subscriptions")
      .select("*")
      .eq("user_id", license.user_id)
      .eq("status", "active")
      .limit(1);

    const plan = subs && subs.length > 0 ? subs[0].plan : "commercial_pro";
    const issuedAt = Math.floor(Date.now() / 1000);
    const expiresAt = issuedAt + 30 * 24 * 60 * 60; // 30-day renewed token

    // 5. Generate fresh signed token
    const payload: LicensePayload = {
      user_id: license.user_id,
      license_id: license.id,
      machine_fingerprint,
      plan,
      status: "active",
      issued_at: issuedAt,
      expires_at: expiresAt,
      grace_days: 14,
    };

    const renewedToken = await signLicensePayload(payload, privateKeyHex);

    return new Response(
      JSON.stringify({
        valid: true,
        renewed_token: renewedToken,
        payload,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message || "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
