// supabase/functions/stripe-webhook/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    const body = await req.text();
    const signature = req.headers.get("stripe-signature");

    // Parse event payload
    const event = JSON.parse(body);
    console.log(`[Stripe Webhook] Processing event type: ${event.type}`);

    switch (event.type) {
      case "customer.subscription.created":
      case "customer.subscription.updated": {
        const subscription = event.data.object;
        const customerId = subscription.customer;
        const subscriptionId = subscription.id;
        const status = subscription.status;
        const currentPeriodEnd = new Date(subscription.current_period_end * 1000).toISOString();

        // Match user by stripe_customer_id or metadata
        const userId = subscription.metadata?.user_id;

        if (userId) {
          await supabaseAdmin.from("subscriptions").upsert({
            user_id: userId,
            stripe_customer_id: customerId,
            stripe_subscription_id: subscriptionId,
            status,
            current_period_end: currentPeriodEnd,
            plan: subscription.items?.data?.[0]?.price?.lookup_key || "commercial_pro",
            updated_at: new Date().toISOString(),
          }, { onConflict: "stripe_subscription_id" });

          // Update license status
          const licenseStatus = status === "active" || status === "trialing" ? "active" : "suspended";
          await supabaseAdmin
            .from("licenses")
            .update({ status: licenseStatus, updated_at: new Date().toISOString() })
            .eq("user_id", userId);
        }
        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object;
        const subscriptionId = subscription.id;

        const { data: sub } = await supabaseAdmin
          .from("subscriptions")
          .select("user_id")
          .eq("stripe_subscription_id", subscriptionId)
          .single();

        if (sub) {
          await supabaseAdmin
            .from("subscriptions")
            .update({ status: "canceled", updated_at: new Date().toISOString() })
            .eq("stripe_subscription_id", subscriptionId);

          await supabaseAdmin
            .from("licenses")
            .update({ status: "expired", updated_at: new Date().toISOString() })
            .eq("user_id", sub.user_id);
        }
        break;
      }

      default:
        console.log(`[Stripe Webhook] Unhandled event type: ${event.type}`);
    }

    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("[Stripe Webhook Error]:", err);
    return new Response(JSON.stringify({ error: err.message || "Webhook processing error" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }
});
