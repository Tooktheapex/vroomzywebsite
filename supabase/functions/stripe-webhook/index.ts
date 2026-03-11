import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import Stripe from "npm:stripe@14";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const stripeSecretKey = Deno.env.get("STRIPE_SECRET_KEY")!;
    const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET")!;
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const stripe = new Stripe(stripeSecretKey, { apiVersion: "2024-06-20" });
    const serviceClient = createClient(supabaseUrl, supabaseServiceKey);

    const body = await req.text();
    const signature = req.headers.get("stripe-signature");

    if (!signature) {
      return new Response(JSON.stringify({ error: "Missing stripe-signature" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let event: Stripe.Event;
    try {
      event = await stripe.webhooks.constructEventAsync(body, signature, webhookSecret);
    } catch (err) {
      console.error("Webhook signature verification failed:", err);
      return new Response(JSON.stringify({ error: "Invalid signature" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    switch (event.type) {

      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const meta = session.metadata ?? {};

        if (meta.type === "lead_unlock") {
          const providerId = meta.provider_id;
          const leadRequestId = meta.lead_request_id;
          const paymentRowId = meta.payment_row_id;

          if (!providerId || !leadRequestId || !paymentRowId) break;

          if (session.payment_status !== "paid") break;

          const { error } = await serviceClient.rpc("create_lead_reveal_after_payment", {
            p_provider_id: providerId,
            p_lead_request_id: leadRequestId,
            p_payment_id: paymentRowId,
          });

          if (error) {
            console.error("create_lead_reveal_after_payment error:", error);
            return new Response(JSON.stringify({ error: "DB error" }), {
              status: 500,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
          }
        }

        if (meta.type === "subscription") {
          const subscription = await stripe.subscriptions.retrieve(
            session.subscription as string
          );
          const providerId = meta.provider_id ?? subscription.metadata?.provider_id;
          const billingMode = meta.billing_mode ?? subscription.metadata?.billing_mode ?? "unlimited";

          if (!providerId) break;

          await serviceClient.rpc("sync_provider_subscription", {
            p_provider_id: providerId,
            p_stripe_customer_id: session.customer as string,
            p_stripe_subscription_id: subscription.id,
            p_billing_mode: billingMode,
            p_status: subscription.status,
            p_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
            p_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
            p_cancel_at_period_end: subscription.cancel_at_period_end,
          });
        }
        break;
      }

      case "checkout.session.expired": {
        const session = event.data.object as Stripe.Checkout.Session;
        const meta = session.metadata ?? {};

        if (meta.type === "lead_unlock" && meta.payment_row_id) {
          await serviceClient
            .from("lead_unlock_payments")
            .update({ status: "failed" })
            .eq("id", meta.payment_row_id)
            .eq("status", "pending");
        }
        break;
      }

      case "payment_intent.payment_failed": {
        const pi = event.data.object as Stripe.PaymentIntent;
        await serviceClient
          .from("lead_unlock_payments")
          .update({ status: "failed" })
          .eq("stripe_session_id", pi.id)
          .eq("status", "pending");
        break;
      }

      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        const providerId = subscription.metadata?.provider_id;
        const billingMode = subscription.metadata?.billing_mode ?? "unlimited";

        if (!providerId) break;

        const status = event.type === "customer.subscription.deleted"
          ? "canceled"
          : subscription.status;

        await serviceClient.rpc("sync_provider_subscription", {
          p_provider_id: providerId,
          p_stripe_customer_id: subscription.customer as string,
          p_stripe_subscription_id: subscription.id,
          p_billing_mode: billingMode,
          p_status: status,
          p_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
          p_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
          p_cancel_at_period_end: subscription.cancel_at_period_end,
        });
        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        if (!invoice.subscription) break;

        const subscription = await stripe.subscriptions.retrieve(
          invoice.subscription as string
        );
        const providerId = subscription.metadata?.provider_id;
        if (!providerId) break;

        await serviceClient
          .from("provider_subscriptions")
          .update({ status: "past_due", updated_at: new Date().toISOString() })
          .eq("stripe_subscription_id", subscription.id);
        break;
      }

      default:
        break;
    }

    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err) {
    console.error("stripe-webhook error:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
