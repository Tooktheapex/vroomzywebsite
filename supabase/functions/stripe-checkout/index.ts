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
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const stripeSecretKey = Deno.env.get("STRIPE_SECRET_KEY")!;

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const serviceClient = createClient(supabaseUrl, supabaseServiceKey);

    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: provider } = await serviceClient
      .from("providers")
      .select("id, business_name, email, status")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!provider) {
      return new Response(JSON.stringify({ error: "Provider not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { type, lead_id, plan, success_url, cancel_url } = body;

    if (!type || !success_url || !cancel_url) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const stripe = new Stripe(stripeSecretKey, { apiVersion: "2024-06-20" });

    const { data: existingSub } = await serviceClient
      .from("provider_subscriptions")
      .select("stripe_customer_id")
      .eq("provider_id", provider.id)
      .maybeSingle();

    let customerId: string | undefined = existingSub?.stripe_customer_id ?? undefined;

    if (!customerId) {
      const customer = await stripe.customers.create({
        email: provider.email ?? user.email,
        name: provider.business_name,
        metadata: { provider_id: provider.id, user_id: user.id },
      });
      customerId = customer.id;
    }

    let session: Stripe.Checkout.Session;

    if (type === "lead_unlock") {
      if (!lead_id) {
        return new Response(JSON.stringify({ error: "Missing lead_id" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: existingPayment } = await serviceClient
        .from("lead_unlock_payments")
        .select("id, status")
        .eq("provider_id", provider.id)
        .eq("lead_request_id", lead_id)
        .maybeSingle();

      if (existingPayment?.status === "succeeded") {
        return new Response(JSON.stringify({ error: "Lead already unlocked" }), {
          status: 409,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      let paymentRowId: string;

      if (existingPayment) {
        paymentRowId = existingPayment.id;
      } else {
        const { data: newPayment, error: insertErr } = await serviceClient
          .from("lead_unlock_payments")
          .insert({
            provider_id: provider.id,
            lead_request_id: lead_id,
            amount_cents: 1500,
            status: "pending",
          })
          .select("id")
          .single();

        if (insertErr || !newPayment) {
          return new Response(JSON.stringify({ error: "Could not create payment record" }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        paymentRowId = newPayment.id;
      }

      session = await stripe.checkout.sessions.create({
        mode: "payment",
        customer: customerId,
        line_items: [
          {
            price_data: {
              currency: "usd",
              unit_amount: 1500,
              product_data: {
                name: "Lead Unlock",
                description: "One-time access to full lead contact information",
              },
            },
            quantity: 1,
          },
        ],
        metadata: {
          type: "lead_unlock",
          provider_id: provider.id,
          lead_request_id: lead_id,
          payment_row_id: paymentRowId,
        },
        success_url: `${success_url}?session_id={CHECKOUT_SESSION_ID}&lead_id=${lead_id}`,
        cancel_url,
      });

      await serviceClient
        .from("lead_unlock_payments")
        .update({ stripe_session_id: session.id })
        .eq("id", paymentRowId);

    } else if (type === "subscription") {
      if (!plan || !["per_lead", "unlimited"].includes(plan)) {
        return new Response(JSON.stringify({ error: "Invalid plan" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const monthlyPriceId = Deno.env.get("STRIPE_UNLIMITED_PRICE_ID");

      if (plan === "unlimited" && !monthlyPriceId) {
        return new Response(JSON.stringify({ error: "Subscription price not configured" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (plan === "unlimited") {
        session = await stripe.checkout.sessions.create({
          mode: "subscription",
          customer: customerId,
          line_items: [{ price: monthlyPriceId!, quantity: 1 }],
          metadata: {
            type: "subscription",
            provider_id: provider.id,
            billing_mode: "unlimited",
          },
          subscription_data: {
            metadata: { provider_id: provider.id, billing_mode: "unlimited" },
          },
          success_url: `${success_url}?session_id={CHECKOUT_SESSION_ID}`,
          cancel_url,
        });
      } else {
        return new Response(JSON.stringify({ error: "Pay-per-lead does not require checkout" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      await serviceClient
        .from("provider_subscriptions")
        .upsert(
          {
            provider_id: provider.id,
            stripe_customer_id: customerId,
            billing_mode: plan,
            status: "inactive",
            stripe_session_id: session.id,
          },
          { onConflict: "provider_id" }
        );

    } else {
      return new Response(JSON.stringify({ error: "Invalid type" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ url: session.url, session_id: session.id }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err) {
    console.error("stripe-checkout error:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
