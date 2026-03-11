import React, { useEffect, useState } from 'react';
import { Outlet, useNavigate, Link } from 'react-router-dom';
import { LayoutDashboard, Store, MessageSquare, CreditCard, Settings, Images, ExternalLink, Building2, FileText } from 'lucide-react';
import { DashboardLayout } from '../../components/layout/AppLayout';
import { DashboardSidebar } from '../../components/layout/DashboardSidebar';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import type { Provider, ProviderSubscription, ProviderApprovalDecision } from '../../lib/database.types';
import { StatusBadge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';

const navItems = [
  { to: '/provider', label: 'Overview', icon: LayoutDashboard, end: true },
  { to: '/provider/onboarding', label: 'Business Profile', icon: Store },
  { to: '/provider/gallery', label: 'Gallery', icon: Images },
  { to: '/provider/leads', label: 'Incoming Leads', icon: MessageSquare },
  { to: '/provider/service-records', label: 'Service Records', icon: FileText },
  { to: '/provider/billing', label: 'Billing', icon: CreditCard },
  { to: '/provider/settings', label: 'Settings', icon: Settings },
];

export function ProviderDashboardLayout() {
  return (
    <DashboardLayout sidebar={<DashboardSidebar items={navItems} title="Provider" />}>
      <Outlet />
    </DashboardLayout>
  );
}

function StatusBanner({ provider, latestDecision }: { provider: Provider; latestDecision: ProviderApprovalDecision | null }) {
  const navigate = useNavigate();

  if (provider.status === 'draft') {
    return (
      <div className="rounded-2xl p-5 bg-amber-900/50 border border-amber-800">
        <p className="font-semibold text-amber-200 mb-1">Your profile is still in draft</p>
        <p className="text-sm text-amber-300 mb-3">Complete your business information and submit for review to appear in the directory.</p>
        <Button size="sm" variant="secondary" onClick={() => navigate('/provider/onboarding')}>Complete Profile</Button>
      </div>
    );
  }

  if (provider.status === 'pending_approval') {
    return (
      <div className="rounded-2xl p-5 bg-blue-900/40 border border-blue-800">
        <p className="font-semibold text-blue-400 mb-1">Your profile is under review</p>
        <p className="text-sm text-blue-400">Your listing has been submitted and is being reviewed by our team. You will be notified when it is approved. It will not be visible to consumers until approved.</p>
      </div>
    );
  }

  if (provider.status === 'approved') {
    return (
      <div className="rounded-2xl p-5 bg-emerald-900/50 border border-emerald-800">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <p className="font-semibold text-emerald-200 mb-1">Your profile is approved and live</p>
            <p className="text-sm text-emerald-400">
              {provider.is_public
                ? 'Your listing is publicly visible in the provider directory.'
                : 'Your account is approved but your listing is currently set to hidden. Contact support to make it public.'}
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Button size="sm" variant="secondary" onClick={() => navigate('/provider/onboarding')}>Edit Profile</Button>
            {provider.is_public && (
              <Link
                to={`/provider/${provider.id}`}
                className="inline-flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 rounded-lg border border-emerald-800 text-emerald-300 bg-emerald-900/50 hover:bg-emerald-900 transition-colors"
              >
                <ExternalLink size={14} /> View Public Profile
              </Link>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (provider.status === 'rejected') {
    const note = latestDecision?.notes ?? provider.rejection_reason;
    return (
      <div className="rounded-2xl p-5 bg-red-950/50 border border-red-800">
        <p className="font-semibold text-red-400 mb-1">Your profile was not approved</p>
        {note && <p className="text-sm text-red-400 mb-3">Reason: {note}</p>}
        {!note && <p className="text-sm text-red-400 mb-3">Please review your profile and resubmit.</p>}
        <Button size="sm" variant="secondary" onClick={() => navigate('/provider/onboarding')}>Edit & Resubmit</Button>
      </div>
    );
  }

  if (provider.status === 'suspended') {
    const note = latestDecision?.notes;
    return (
      <div className="rounded-2xl p-5 bg-zinc-800 border border-zinc-700">
        <p className="font-semibold text-zinc-200 mb-1">Your profile is currently suspended</p>
        {note && <p className="text-sm text-zinc-400 mb-2">Note: {note}</p>}
        {!note && <p className="text-sm text-zinc-400 mb-2">Your listing has been suspended and is not visible to consumers. Please contact support if you believe this is an error.</p>}
      </div>
    );
  }

  return null;
}

export function ProviderOverview() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [provider, setProvider] = useState<Provider | null>(null);
  const [subscription, setSubscription] = useState<ProviderSubscription | null>(null);
  const [leadCount, setLeadCount] = useState(0);
  const [latestDecision, setLatestDecision] = useState<ProviderApprovalDecision | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      const { data: p } = await supabase
        .from('providers')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();
      setProvider(p);
      if (p) {
        const [subRes, leadRes, decisionRes] = await Promise.all([
          supabase.from('provider_subscriptions').select('*').eq('provider_id', p.id).maybeSingle(),
          supabase.from('lead_requests').select('id', { count: 'exact', head: true }).eq('provider_id', p.id),
          supabase
            .from('provider_approval_decisions')
            .select('*')
            .eq('provider_id', p.id)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle(),
        ]);
        setSubscription(subRes.data);
        setLeadCount(leadRes.count ?? 0);
        setLatestDecision(decisionRes.data);
      }
      setLoading(false);
    };
    load();
  }, [user]);

  if (loading) return (
    <div className="h-48 flex items-center justify-center">
      <div className="w-6 h-6 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        {provider?.logo_image_url ? (
          <div className="w-12 h-12 rounded-xl border border-zinc-800 bg-zinc-900 overflow-hidden flex items-center justify-center p-1 shrink-0">
            <img src={provider.logo_image_url} alt="Business logo" className="w-full h-full object-contain" />
          </div>
        ) : provider ? (
          <div className="w-12 h-12 rounded-xl bg-blue-900/40 border border-blue-800 flex items-center justify-center shrink-0">
            <Building2 size={20} className="text-blue-400" />
          </div>
        ) : null}
        <div>
          <h2 className="text-xl font-bold text-zinc-100">
            {provider?.business_name ?? `Welcome, ${profile?.full_name?.split(' ')[0] ?? 'Provider'}`}
          </h2>
          <p className="text-sm text-zinc-500 mt-0.5">Manage your listing, leads, and account.</p>
        </div>
      </div>

      {!provider && (
        <div className="bg-blue-900/40 border border-blue-800 rounded-2xl p-6">
          <h3 className="font-bold text-blue-400 mb-1">Complete your business profile</h3>
          <p className="text-sm text-blue-400 mb-4">Set up your listing to start receiving leads from car owners in your area.</p>
          <Button onClick={() => navigate('/provider/onboarding')} size="sm">Set Up Profile</Button>
        </div>
      )}

      {provider && (
        <>
          <StatusBanner provider={provider} latestDecision={latestDecision} />

          <div className="grid sm:grid-cols-3 gap-4">
            <div className="bg-zinc-900 rounded-2xl border border-zinc-800 shadow-sm p-5">
              <p className="text-xs font-medium text-zinc-500 mb-2">Listing Status</p>
              <StatusBadge status={provider.status} />
            </div>
            <div className="bg-zinc-900 rounded-2xl border border-zinc-800 shadow-sm p-5">
              <p className="text-xs font-medium text-zinc-500 mb-1">Total Leads</p>
              <p className="text-3xl font-bold text-zinc-100 mt-1">{leadCount}</p>
            </div>
            <div className="bg-zinc-900 rounded-2xl border border-zinc-800 shadow-sm p-5">
              <p className="text-xs font-medium text-zinc-500 mb-1">Plan</p>
              <p className="text-base font-semibold text-zinc-200 mt-1">
                {subscription?.billing_mode === 'unlimited' ? 'Unlimited Leads' : 'Pay Per Lead'}
              </p>
              <StatusBadge status={subscription?.status ?? 'inactive'} />
            </div>
          </div>

          {provider.status === 'approved' && (
            <div className="grid sm:grid-cols-2 gap-4">
              <div
                className="bg-zinc-900 rounded-2xl border border-zinc-800 shadow-sm p-5 cursor-pointer hover:border-blue-700 transition-colors"
                onClick={() => navigate('/provider/leads')}
              >
                <p className="text-xs font-medium text-zinc-500 mb-1">Incoming Leads</p>
                {subscription?.status === 'active' || subscription?.status === 'trialing' ? (
                  <p className="text-sm text-zinc-300">View and respond to incoming service requests</p>
                ) : (
                  <p className="text-sm text-zinc-500">Unlock leads individually for $15 or activate a plan</p>
                )}
              </div>
              <div
                className="bg-zinc-900 rounded-2xl border border-zinc-800 shadow-sm p-5 cursor-pointer hover:border-blue-700 transition-colors"
                onClick={() => navigate('/provider/gallery')}
              >
                <p className="text-xs font-medium text-zinc-500 mb-1">Gallery</p>
                <p className="text-sm text-zinc-300">Add portfolio photos to showcase your work</p>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
