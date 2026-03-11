import { supabase } from './supabase';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

async function callCheckout(body: Record<string, unknown>): Promise<{ url: string } | { error: string }> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return { error: 'Not authenticated' };

  const res = await fetch(`${SUPABASE_URL}/functions/v1/stripe-checkout`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.access_token}`,
      Apikey: ANON_KEY,
    },
    body: JSON.stringify(body),
  });

  const json = await res.json();
  if (!res.ok || json.error) return { error: json.error ?? 'Checkout failed' };
  return { url: json.url };
}

export function createLeadUnlockCheckout(leadId: string): Promise<{ url: string } | { error: string }> {
  const base = window.location.origin;
  return callCheckout({
    type: 'lead_unlock',
    lead_id: leadId,
    success_url: `${base}/provider/billing/success`,
    cancel_url: `${base}/provider/leads`,
  });
}

export function createSubscriptionCheckout(plan: 'unlimited'): Promise<{ url: string } | { error: string }> {
  const base = window.location.origin;
  return callCheckout({
    type: 'subscription',
    plan,
    success_url: `${base}/provider/billing/success`,
    cancel_url: `${base}/provider/billing`,
  });
}
