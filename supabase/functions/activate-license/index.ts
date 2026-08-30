// supabase/functions/activate-license/index.ts
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

    // 1. Authenticate user from Authorization Header
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing Authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token);

    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized: Invalid JWT token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 2. Parse request body
    const { machine_fingerprint, device_name } = await req.json();
    if (!machine_fingerprint || !device_name) {
      return new Response(JSON.stringify({ error: "Missing machine_fingerprint or device_name" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 3. Fetch user's license
    const { data: licenses, error: licError } = await supabaseAdmin
      .from("licenses")
      .select("*")
      .eq("user_id", user.id)
      .eq("status", "active")
      .order("created_at", { ascending: false })
      .limit(1);

    if (licError || !licenses || licenses.length === 0) {
      return new Response(JSON.stringify({ error: "No active license found for user" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const license = licenses[0];

    // 4. Check device activations limit
    const { data: activations, error: actError } = await supabaseAdmin
      .from("device_activations")
      .select("*")
      .eq("license_id", license.id);

    if (actError) {
      return new Response(JSON.stringify({ error: "Error checking device activations" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const existingDevice = activations?.find(
      (a: any) => a.machine_fingerprint === machine_fingerprint
    );

    if (!existingDevice && (activations?.length ?? 0) >= license.max_devices) {
      return new Response(
        JSON.stringify({
          error: `Maximum device limit (${license.max_devices}) reached for this license. Deactivate another device first.`,
        }),
        {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // 5. Register or update device activation
    const now = new Date();
    if (existingDevice) {
      await supabaseAdmin
        .from("device_activations")
        .update({ last_seen_at: now.toISOString(), device_name })
        .eq("id", existingDevice.id);
    } else {
      await supabaseAdmin.from("device_activations").insert({
        license_id: license.id,
        user_id: user.id,
        machine_fingerprint,
        device_name,
        activated_at: now.toISOString(),
        last_seen_at: now.toISOString(),
      });
    }

    // 6. Check subscription for plan details
    const { data: subs } = await supabaseAdmin
      .from("subscriptions")
      .select("*")
      .eq("user_id", user.id)
      .eq("status", "active")
      .limit(1);

    const plan = subs && subs.length > 0 ? subs[0].plan : "commercial_pro";
    const issuedAt = Math.floor(Date.now() / 1000);
    const expiresAt = issuedAt + 30 * 24 * 60 * 60; // 30 days valid token

    // 7. Construct and sign cryptographic Ed25519 payload
    const payload: LicensePayload = {
      user_id: user.id,
      license_id: license.id,
      machine_fingerprint,
      plan,
      status: "active",
      issued_at: issuedAt,
      expires_at: expiresAt,
      grace_days: 14,
    };

    const signedToken = await signLicensePayload(payload, privateKeyHex);

    return new Response(
      JSON.stringify({
        success: true,
        license_token: signedToken,
        payload,
        max_devices: license.max_devices,
        active_devices: (activations?.length ?? 0) + (existingDevice ? 0 : 1),
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
