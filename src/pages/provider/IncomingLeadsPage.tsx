import React, { useEffect, useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { MessageSquare, Lock, Car, Calendar, Tag, Unlock, Zap, CreditCard, CheckCircle, AlertCircle, ExternalLink } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import type { Provider, ProviderSubscription, LeadLockedPreview, LeadRequest, LeadReveal } from '../../lib/database.types';
import { useAuth } from '../../contexts/AuthContext';
import { StatusBadge } from '../../components/ui/Badge';
import { Select } from '../../components/ui/Input';
import { EmptyState } from '../../components/ui/EmptyState';
import { CardSkeleton } from '../../components/ui/LoadingSpinner';
import { Button } from '../../components/ui/Button';
import { useNavigate } from 'react-router-dom';
import { createLeadUnlockCheckout } from '../../lib/stripe';

type LockedLead = LeadLockedPreview;

type UnlockedLead = LeadRequest & {
  service_categories: { label: string } | null;
};

type LeadEntry =
  | { type: 'locked'; data: LockedLead }
  | { type: 'unlocked'; data: UnlockedLead };

const STATUS_OPTIONS = [
  { value: 'new', label: 'New' },
  { value: 'viewed', label: 'Viewed' },
  { value: 'contacted', label: 'Contacted' },
  { value: 'closed', label: 'Closed' },
  { value: 'spam', label: 'Spam' },
];

function hasActiveSubscription(sub: ProviderSubscription | null): boolean {
  return sub?.status === 'active' || sub?.status === 'trialing';
}

export function IncomingLeadsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [provider, setProvider] = useState<Provider | null>(null);
  const [subscription, setSubscription] = useState<ProviderSubscription | null>(null);
  const [leads, setLeads] = useState<LeadEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [revealingId, setRevealingId] = useState<string | null>(null);
  const [unlockingId, setUnlockingId] = useState<string | null>(null);
  const [unlockError, setUnlockError] = useState<string | null>(null);

  const loadLeads = useCallback(async (p: Provider, sub: ProviderSubscription | null) => {
    const [previewRes, revealsRes] = await Promise.all([
      supabase
        .from('lead_locked_preview')
        .select('*')
        .eq('provider_id', p.id)
        .order('created_at', { ascending: false }),
      supabase
        .from('lead_reveals')
        .select('lead_request_id')
        .eq('provider_id', p.id),
    ]);

    const previews: LockedLead[] = (previewRes.data ?? []) as LockedLead[];
    const revealedIds = new Set((revealsRes.data ?? []).map((r: Pick<LeadReveal, 'lead_request_id'>) => r.lead_request_id));

    const unlockedIds = previews
      .filter((l) => revealedIds.has(l.id))
      .map((l) => l.id);

    let unlockedFull: UnlockedLead[] = [];
    if (unlockedIds.length > 0) {
      const { data } = await supabase
        .from('lead_requests')
        .select('*, service_categories(label)')
        .in('id', unlockedIds)
        .order('created_at', { ascending: false });
      unlockedFull = (data ?? []) as UnlockedLead[];
    }

    const unlockedMap = new Map(unlockedFull.map((l) => [l.id, l]));

    const entries: LeadEntry[] = previews.map((preview) => {
      const full = unlockedMap.get(preview.id);
      if (full) return { type: 'unlocked', data: full };
      return { type: 'locked', data: preview };
    });

    setLeads(entries);
  }, []);

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      const { data: p } = await supabase
        .from('providers')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();
      if (!p) { setLoading(false); return; }
      setProvider(p as Provider);

      const { data: sub } = await supabase
        .from('provider_subscriptions')
        .select('*')
        .eq('provider_id', p.id)
        .maybeSingle();
      setSubscription(sub as ProviderSubscription | null);

      await loadLeads(p as Provider, sub as ProviderSubscription | null);
      setLoading(false);
    };
    load();
  }, [user, loadLeads]);

  const handleRevealViaSubscription = async (leadId: string) => {
    if (!provider || !subscription) return;
    if (!hasActiveSubscription(subscription)) return;
    setRevealingId(leadId);
    try {
      const { error } = await supabase.rpc('reveal_lead_via_subscription', { p_lead_id: leadId });
      if (error) throw error;
      await loadLeads(provider, subscription);
    } catch {
    } finally {
      setRevealingId(null);
    }
  };

  const handleUnlockPurchase = async (leadId: string) => {
    if (!provider) return;
    setUnlockError(null);
    setUnlockingId(leadId);

    const result = await createLeadUnlockCheckout(leadId);

    if ('error' in result) {
      setUnlockError(result.error);
      setUnlockingId(null);
      return;
    }

    window.location.href = result.url;
  };

  const updateStatus = async (leadId: string, status: string) => {
    await supabase
      .from('lead_requests')
      .update({ status: status as LeadRequest['status'] })
      .eq('id', leadId);
    setLeads((prev) =>
      prev.map((entry) => {
        if (entry.type === 'unlocked' && entry.data.id === leadId) {
          return { ...entry, data: { ...entry.data, status: status as LeadRequest['status'] } };
        }
        return entry;
      })
    );
  };

  const isSubscribed = hasActiveSubscription(subscription);

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-xl font-bold text-zinc-100">Incoming Leads</h2>
        <p className="text-sm text-zinc-500">Service requests from car owners.</p>
      </div>

      {unlockError && (
        <div className="mb-5 bg-red-950/50 border border-red-800 rounded-2xl p-4 flex items-start gap-3">
          <AlertCircle size={16} className="text-red-400 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm font-medium text-red-400">Could not start checkout</p>
            <p className="text-xs text-red-400 mt-0.5">{unlockError}</p>
          </div>
          <button onClick={() => setUnlockError(null)} className="text-red-400 hover:text-red-300 text-xs">Dismiss</button>
        </div>
      )}

      {!isSubscribed && leads.length > 0 && (
        <div className="mb-5 bg-amber-900/50 border border-amber-800 rounded-2xl p-4 flex items-start gap-3">
          <AlertCircle size={18} className="text-amber-300 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="font-semibold text-amber-200 text-sm">Your plan is inactive</p>
            <p className="text-xs text-amber-300 mt-0.5">
              Unlock individual leads for $15 each, or subscribe for unlimited access at $75/month.
            </p>
          </div>
          <Button size="sm" variant="secondary" onClick={() => navigate('/provider/billing')}>
            View Plans
          </Button>
        </div>
      )}

      {loading ? (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => <CardSkeleton key={i} />)}
        </div>
      ) : !provider ? (
        <EmptyState
          icon={<MessageSquare size={24} />}
          title="Set up your profile first"
          description="Complete your provider profile to start receiving leads."
        />
      ) : leads.length === 0 ? (
        <EmptyState
          icon={<MessageSquare size={24} />}
          title="No leads yet"
          description="Once your listing is approved and live, leads will appear here."
        />
      ) : (
        <div className="space-y-4">
          {leads.map((entry, i) =>
            entry.type === 'locked' ? (
              <LockedLeadCard
                key={entry.data.id}
                lead={entry.data}
                index={i}
                isSubscribed={isSubscribed}
                isRevealing={revealingId === entry.data.id}
                isUnlocking={unlockingId === entry.data.id}
                onRevealViaSubscription={() => handleRevealViaSubscription(entry.data.id)}
                onUnlockPurchase={() => handleUnlockPurchase(entry.data.id)}
                onViewPlans={() => navigate('/provider/billing')}
              />
            ) : (
              <UnlockedLeadCard
                key={entry.data.id}
                lead={entry.data}
                index={i}
                onStatusChange={updateStatus}
              />
            )
          )}
        </div>
      )}
    </div>
  );
}

function LockedLeadCard({
  lead,
  index,
  isSubscribed,
  isRevealing,
  isUnlocking,
  onRevealViaSubscription,
  onUnlockPurchase,
  onViewPlans,
}: {
  lead: LockedLead;
  index: number;
  isSubscribed: boolean;
  isRevealing: boolean;
  isUnlocking: boolean;
  onRevealViaSubscription: () => void;
  onUnlockPurchase: () => void;
  onViewPlans: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04 }}
      className="bg-zinc-900 rounded-2xl border border-zinc-800 shadow-sm overflow-hidden"
    >
      <div className="h-1 bg-gradient-to-r from-zinc-700 to-zinc-600" />
      <div className="p-5">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-1.5 bg-zinc-800 text-zinc-400 text-xs font-semibold px-2.5 py-1 rounded-full">
              <Lock size={11} />
              Locked
            </div>
            {lead.service_category_label && (
              <span className="flex items-center gap-1 text-xs bg-blue-900/40 text-blue-400 px-2 py-0.5 rounded-full">
                <Tag size={10} />
                {lead.service_category_label}
              </span>
            )}
            <StatusBadge status={lead.status} />
          </div>
          <p className="text-xs text-zinc-500 shrink-0">
            {new Date(lead.created_at).toLocaleDateString(undefined, {
              month: 'short', day: 'numeric', year: 'numeric',
            })}
          </p>
        </div>

        {lead.service_needed && (
          <div className="relative mb-4">
            <p className="text-sm text-zinc-300 bg-zinc-950 rounded-xl p-3 line-clamp-2 blur-[3px] select-none pointer-events-none">
              {lead.service_needed}
            </p>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="flex items-center gap-1.5 text-xs font-medium bg-zinc-900 border border-zinc-700 shadow-sm px-3 py-1.5 rounded-full text-zinc-400">
                <Lock size={11} /> Unlock to view details
              </span>
            </div>
          </div>
        )}

        <div className="grid sm:grid-cols-2 gap-3 mb-4">
          <div className="flex items-center gap-2 text-sm text-zinc-500">
            <div className="w-7 h-7 rounded-lg bg-zinc-800 flex items-center justify-center shrink-0">
              <Car size={13} className="text-zinc-500" />
            </div>
            <span>
              {[lead.vehicle_year, lead.vehicle_make].filter(Boolean).join(' ') || 'Vehicle on file'}
              {lead.vehicle_make ? ' •••' : ''}
            </span>
          </div>
          {lead.preferred_date && (
            <div className="flex items-center gap-2 text-sm text-zinc-500">
              <div className="w-7 h-7 rounded-lg bg-zinc-800 flex items-center justify-center shrink-0">
                <Calendar size={13} className="text-zinc-500" />
              </div>
              <span>Preferred: {new Date(lead.preferred_date).toLocaleDateString()}</span>
            </div>
          )}
        </div>

        <div className="border-t border-zinc-800 pt-4 flex items-center gap-3 flex-wrap">
          {isSubscribed ? (
            <Button
              size="sm"
              variant="primary"
              onClick={onRevealViaSubscription}
              disabled={isRevealing}
              loading={isRevealing}
            >
              <Unlock size={13} />
              {isRevealing ? 'Revealing...' : 'Reveal Lead — Included in Plan'}
            </Button>
          ) : (
            <>
              <Button
                size="sm"
                variant="primary"
                onClick={onUnlockPurchase}
                disabled={isUnlocking}
                loading={isUnlocking}
              >
                <CreditCard size={13} />
                {isUnlocking ? 'Opening Checkout...' : 'Unlock for $15'}
              </Button>
              <button
                onClick={onViewPlans}
                className="text-xs text-blue-400 hover:underline flex items-center gap-1"
              >
                <Zap size={11} />
                Subscribe — unlimited access
              </button>
            </>
          )}
        </div>
      </div>
    </motion.div>
  );
}

function UnlockedLeadCard({
  lead,
  index,
  onStatusChange,
}: {
  lead: UnlockedLead;
  index: number;
  onStatusChange: (id: string, status: string) => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04 }}
      className="bg-zinc-900 rounded-2xl border border-zinc-800 shadow-sm overflow-hidden"
    >
      <div className="h-1 bg-gradient-to-r from-emerald-400 to-emerald-500" />
      <div className="p-5">
        <div className="flex items-start justify-between gap-4 mb-3">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <div className="flex items-center gap-1.5 bg-emerald-900/50 text-emerald-400 text-xs font-semibold px-2.5 py-1 rounded-full">
                <CheckCircle size={11} />
                Unlocked
              </div>
              <h3 className="font-bold text-zinc-100">{lead.contact_name}</h3>
              <StatusBadge status={lead.status} />
              {lead.service_categories?.label && (
                <span className="text-xs bg-blue-900/40 text-blue-400 px-2 py-0.5 rounded-full">
                  {lead.service_categories.label}
                </span>
              )}
            </div>
            <p className="text-xs text-zinc-500 mt-0.5">
              {new Date(lead.created_at).toLocaleDateString(undefined, {
                month: 'long', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit',
              })}
            </p>
          </div>
          <div className="w-36 shrink-0">
            <Select
              value={lead.status}
              onChange={(e) => onStatusChange(lead.id, e.target.value)}
              options={STATUS_OPTIONS}
            />
          </div>
        </div>

        {lead.service_needed && (
          <p className="text-sm text-zinc-300 mb-4 bg-zinc-950 rounded-xl p-3">{lead.service_needed}</p>
        )}

        <div className="grid sm:grid-cols-2 gap-3">
          <div className="flex flex-col gap-2">
            {lead.contact_phone && (
              <a
                href={`tel:${lead.contact_phone}`}
                className="flex items-center gap-2 text-sm text-zinc-400 hover:text-blue-400 transition-colors"
              >
                <div className="w-7 h-7 rounded-lg bg-zinc-800 flex items-center justify-center shrink-0">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-zinc-500"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.67 12 19.79 19.79 0 0 1 1.65 3.4a2 2 0 0 1 1.99-2.18h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.81a16 16 0 0 0 6.29 6.29l.94-1.02a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z" /></svg>
                </div>
                {lead.contact_phone}
              </a>
            )}
            {lead.contact_email && (
              <a
                href={`mailto:${lead.contact_email}`}
                className="flex items-center gap-2 text-sm text-zinc-400 hover:text-blue-400 transition-colors"
              >
                <div className="w-7 h-7 rounded-lg bg-zinc-800 flex items-center justify-center shrink-0">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-zinc-500"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" /><polyline points="22,6 12,13 2,6" /></svg>
                </div>
                {lead.contact_email}
              </a>
            )}
          </div>
          <div>
            {(lead.vehicle_year || lead.vehicle_make) && (
              <div className="flex items-center gap-2 text-sm text-zinc-400">
                <div className="w-7 h-7 rounded-lg bg-zinc-800 flex items-center justify-center shrink-0">
                  <Car size={13} className="text-zinc-500" />
                </div>
                {[lead.vehicle_year, lead.vehicle_make, lead.vehicle_model].filter(Boolean).join(' ')}
              </div>
            )}
            {lead.preferred_date && (
              <p className="text-xs text-zinc-500 mt-2 ml-9">
                Preferred date: {new Date(lead.preferred_date).toLocaleDateString()}
              </p>
            )}
          </div>
        </div>

        {lead.notes && (
          <p className="text-xs text-zinc-500 mt-3 border-t border-zinc-800 pt-3">
            Notes: {lead.notes}
          </p>
        )}
      </div>
    </motion.div>
  );
}
