import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { CheckCircle, ArrowRight, RefreshCw } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Button } from '../../components/ui/Button';

export function BillingSuccessPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const leadId = searchParams.get('lead_id');
  const sessionId = searchParams.get('session_id');

  const [checking, setChecking] = useState(true);
  const [accessConfirmed, setAccessConfirmed] = useState(false);
  const [attempts, setAttempts] = useState(0);

  useEffect(() => {
    if (!user || !sessionId) {
      setChecking(false);
      return;
    }

    let cancelled = false;
    const maxAttempts = 8;
    const delayMs = 2000;

    const checkAccess = async (attempt: number): Promise<void> => {
      if (cancelled || attempt >= maxAttempts) {
        if (!cancelled) setChecking(false);
        return;
      }

      setAttempts(attempt + 1);

      if (leadId) {
        const { data: providerRow } = await supabase
          .from('providers')
          .select('id')
          .eq('user_id', user.id)
          .maybeSingle();

        if (providerRow) {
          const { data: reveal } = await supabase
            .from('lead_reveals')
            .select('id')
            .eq('provider_id', providerRow.id)
            .eq('lead_request_id', leadId)
            .maybeSingle();

          if (reveal) {
            if (!cancelled) {
              setAccessConfirmed(true);
              setChecking(false);
            }
            return;
          }
        }
      } else {
        const { data: providerRow } = await supabase
          .from('providers')
          .select('id')
          .eq('user_id', user.id)
          .maybeSingle();

        if (providerRow) {
          const { data: sub } = await supabase
            .from('provider_subscriptions')
            .select('status')
            .eq('provider_id', providerRow.id)
            .maybeSingle();

          if (sub?.status === 'active' || sub?.status === 'trialing') {
            if (!cancelled) {
              setAccessConfirmed(true);
              setChecking(false);
            }
            return;
          }
        }
      }

      await new Promise((r) => setTimeout(r, delayMs));
      return checkAccess(attempt + 1);
    };

    checkAccess(0);
    return () => { cancelled = true; };
  }, [user, sessionId, leadId]);

  return (
    <div className="min-h-[60vh] flex items-center justify-center px-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-zinc-900 rounded-3xl border border-zinc-800 shadow-xl p-10 max-w-md w-full text-center"
      >
        {checking ? (
          <>
            <div className="w-16 h-16 rounded-full bg-blue-900/40 flex items-center justify-center mx-auto mb-6">
              <RefreshCw size={28} className="text-blue-400 animate-spin" />
            </div>
            <h2 className="text-xl font-bold text-zinc-100 mb-2">Confirming payment...</h2>
            <p className="text-sm text-zinc-500 mb-2">
              We're waiting for Stripe to confirm your payment. This usually takes a few seconds.
            </p>
            {attempts > 3 && (
              <p className="text-xs text-zinc-500">Still checking... ({attempts} of 8 attempts)</p>
            )}
          </>
        ) : accessConfirmed ? (
          <>
            <div className="w-16 h-16 rounded-full bg-emerald-900/50 flex items-center justify-center mx-auto mb-6">
              <CheckCircle size={28} className="text-emerald-400" />
            </div>
            <h2 className="text-xl font-bold text-zinc-100 mb-2">Payment confirmed</h2>
            <p className="text-sm text-zinc-500 mb-6">
              {leadId
                ? 'Your lead has been unlocked. You can now view the full contact details.'
                : 'Your subscription is now active. All leads are now available to reveal instantly.'}
            </p>
            <Button
              fullWidth
              onClick={() => navigate(leadId ? '/provider/leads' : '/provider')}
            >
              {leadId ? 'View Lead' : 'Go to Dashboard'} <ArrowRight size={15} />
            </Button>
          </>
        ) : (
          <>
            <div className="w-16 h-16 rounded-full bg-amber-900/50 flex items-center justify-center mx-auto mb-6">
              <RefreshCw size={28} className="text-amber-500" />
            </div>
            <h2 className="text-xl font-bold text-zinc-100 mb-2">Almost there</h2>
            <p className="text-sm text-zinc-500 mb-6">
              Payment was received but access confirmation is taking longer than expected.
              It may take up to a minute. Please check back shortly.
            </p>
            <div className="flex flex-col gap-2">
              <Button fullWidth onClick={() => navigate('/provider/leads')}>
                Go to Incoming Leads <ArrowRight size={15} />
              </Button>
              <Button fullWidth variant="ghost" onClick={() => navigate('/provider/billing')}>
                View Billing
              </Button>
            </div>
          </>
        )}
      </motion.div>
    </div>
  );
}
