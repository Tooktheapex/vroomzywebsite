import React, { useEffect, useState } from 'react';
import { CreditCard, Zap, CheckCircle, DollarSign, AlertCircle, RefreshCw, ExternalLink } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import type { Provider, ProviderSubscription } from '../../lib/database.types';
import { useAuth } from '../../contexts/AuthContext';
import { StatusBadge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { createSubscriptionCheckout } from '../../lib/stripe';

function hasActiveSubscription(sub: ProviderSubscription | null): boolean {
  return sub?.status === 'active' || sub?.status === 'trialing';
}

export function BillingPage() {
  const { user } = useAuth();
  const [provider, setProvider] = useState<Provider | null>(null);
  const [subscription, setSubscription] = useState<ProviderSubscription | null>(null);
  const [loading, setLoading] = useState(true);
  const [checkoutLoading, setCheckoutLoading] = useState<string | null>(null);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      const { data: p } = await supabase.from('providers').select('*').eq('user_id', user.id).maybeSingle();
      setProvider(p);
      if (p) {
        const { data: s } = await supabase.from('provider_subscriptions').select('*').eq('provider_id', p.id).maybeSingle();
        setSubscription(s);
      }
      setLoading(false);
    };
    load();
  }, [user]);

  const handleSubscribe = async (plan: 'unlimited') => {
    setCheckoutError(null);
    setCheckoutLoading(plan);
    const result = await createSubscriptionCheckout(plan);
    if ('error' in result) {
      setCheckoutError(result.error);
      setCheckoutLoading(null);
      return;
    }
    window.location.href = result.url;
  };

  if (loading) return (
    <div className="h-32 flex items-center justify-center">
      <div className="w-5 h-5 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  const isSubscribed = hasActiveSubscription(subscription);
  const isPerLead = !isSubscribed;

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-xl font-bold text-zinc-100">Billing & Plan</h2>
        <p className="text-sm text-zinc-500">Manage your subscription and lead pricing.</p>
      </div>

      {checkoutError && (
        <div className="mb-5 bg-red-950/50 border border-red-800 rounded-2xl p-4 flex items-start gap-3">
          <AlertCircle size={16} className="text-red-400 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm font-medium text-red-400">Checkout error</p>
            <p className="text-xs text-red-400 mt-0.5">{checkoutError}</p>
          </div>
          <button onClick={() => setCheckoutError(null)} className="text-red-400 hover:text-red-300 text-xs">Dismiss</button>
        </div>
      )}

      {/* Current Plan */}
      <div className="bg-zinc-900 rounded-2xl border border-zinc-800 shadow-sm p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-zinc-100">Current Plan</h3>
          <div className="flex items-center gap-2">
            <StatusBadge status={subscription?.status ?? 'inactive'} />
            {subscription?.cancel_at_period_end && (
              <span className="text-xs bg-amber-900/50 text-amber-300 font-medium px-2 py-0.5 rounded-full">
                Cancels at period end
              </span>
            )}
          </div>
        </div>

        <p className="text-2xl font-bold text-zinc-100 mb-1">
          {isSubscribed
            ? 'Unlimited Leads'
            : subscription?.billing_mode === 'unlimited' && subscription?.status === 'past_due'
              ? 'Unlimited Leads — Payment Past Due'
              : 'Pay Per Lead'}
        </p>
        <p className="text-sm text-zinc-500">
          {isSubscribed
            ? '$75/month — Receive unlimited lead requests at no additional cost per lead.'
            : '$15 per lead — Only pay when a consumer submits a request to your listing.'}
        </p>
        {subscription?.current_period_end && (
          <p className="text-xs text-zinc-500 mt-2">
            {subscription.cancel_at_period_end ? 'Access ends' : 'Renews'}:{' '}
            {new Date(subscription.current_period_end).toLocaleDateString(undefined, {
              month: 'long', day: 'numeric', year: 'numeric',
            })}
          </p>
        )}
      </div>

      {/* Plan Options */}
      <div className="grid sm:grid-cols-2 gap-4 mb-6">
        {[
          {
            name: 'Pay Per Lead',
            price: '$15/lead',
            icon: <DollarSign className="w-6 h-6 text-blue-400" />,
            features: [
              'Only pay for leads you unlock',
              'No monthly commitment',
              'Full contact info after payment',
              'Best for new or part-time businesses',
            ],
            mode: 'per_lead' as const,
            recommended: false,
            action: null,
          },
          {
            name: 'Unlimited Leads',
            price: '$75/month',
            icon: <Zap className="w-6 h-6 text-amber-500" />,
            features: [
              'Unlimited leads every month',
              'Reveal leads with one click',
              'Predictable monthly cost',
              'Best for established shops',
            ],
            mode: 'unlimited' as const,
            recommended: true,
            action: () => handleSubscribe('unlimited'),
          },
        ].map((plan) => {
          const isCurrent =
            plan.mode === 'per_lead'
              ? isPerLead && !subscription?.stripe_subscription_id
              : isSubscribed && subscription?.billing_mode === 'unlimited';

          return (
            <div
              key={plan.mode}
              className={`relative bg-zinc-900 rounded-2xl border-2 shadow-sm p-6 ${
                plan.recommended ? 'border-blue-500' : 'border-zinc-800'
              }`}
            >
              {plan.recommended && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-blue-600 text-white text-xs font-semibold px-3 py-1 rounded-full">
                  Recommended
                </div>
              )}
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-xl bg-zinc-800 flex items-center justify-center">{plan.icon}</div>
                <div>
                  <h4 className="font-bold text-zinc-100">{plan.name}</h4>
                  <p className="text-lg font-extrabold text-blue-400">{plan.price}</p>
                </div>
              </div>
              <ul className="space-y-2 mb-5">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-center gap-2 text-sm text-zinc-400">
                    <CheckCircle size={13} className="text-emerald-500 shrink-0" /> {f}
                  </li>
                ))}
              </ul>

              {plan.action ? (
                <Button
                  fullWidth
                  variant={plan.recommended ? 'primary' : 'outline'}
                  size="sm"
                  onClick={plan.action}
                  disabled={isCurrent || checkoutLoading !== null}
                  loading={checkoutLoading === plan.mode}
                >
                  {isCurrent ? (
                    <span className="flex items-center gap-1.5"><CheckCircle size={13} /> Current Plan</span>
                  ) : (
                    <span className="flex items-center gap-1.5">
                      <ExternalLink size={13} /> Subscribe — $75/month
                    </span>
                  )}
                </Button>
              ) : (
                <Button
                  fullWidth
                  variant="outline"
                  size="sm"
                  disabled
                >
                  {isCurrent ? (
                    <span className="flex items-center gap-1.5"><CheckCircle size={13} /> Current Plan</span>
                  ) : 'Default (no checkout required)'}
                </Button>
              )}
            </div>
          );
        })}
      </div>

      {/* Security note */}
      <div className="bg-zinc-950 border border-zinc-800 rounded-2xl p-5 flex items-start gap-3">
        <CreditCard size={18} className="text-zinc-500 shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-medium text-zinc-300 mb-1">Secure payment processing</p>
          <p className="text-xs text-zinc-500 leading-relaxed">
            All payments are processed by Stripe. Your card details never touch our servers.
            Subscription status and lead access are updated automatically via webhook after
            Stripe confirms payment — not before.
          </p>
        </div>
        <button
          className="shrink-0 text-zinc-500 hover:text-zinc-300 transition-colors"
          title="Refresh subscription status"
          onClick={async () => {
            setLoading(true);
            const { data: p } = await supabase.from('providers').select('*').eq('user_id', user!.id).maybeSingle();
            if (p) {
              const { data: s } = await supabase.from('provider_subscriptions').select('*').eq('provider_id', p.id).maybeSingle();
              setSubscription(s);
            }
            setLoading(false);
          }}
        >
          <RefreshCw size={15} />
        </button>
      </div>
    </div>
  );
}
