import React, { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, X, Eye, MapPin, Phone, Globe, Smartphone, Store, Clock, Image as ImageIcon, ChevronDown, ChevronUp, AlertTriangle, Building2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import type { Provider, ServiceCategory, ProviderApprovalDecision, ProviderGalleryImage } from '../../lib/database.types';
import { useAuth } from '../../contexts/AuthContext';
import { StatusBadge, Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { TextArea } from '../../components/ui/Input';
import { EmptyState } from '../../components/ui/EmptyState';
import { CardSkeleton } from '../../components/ui/LoadingSpinner';
import { Select } from '../../components/ui/Input';

type ProviderWithServices = Provider & {
  provider_services: { service_categories: ServiceCategory }[];
};

type DecisionWithReviewer = ProviderApprovalDecision & {
  profiles?: { full_name: string | null } | null;
};

const STATUS_FILTER_OPTIONS = [
  { value: '', label: 'All Statuses' },
  { value: 'pending_approval', label: 'Pending Review' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'draft', label: 'Draft' },
  { value: 'suspended', label: 'Suspended' },
];

const DECISION_LABEL: Record<string, string> = {
  approved: 'Approved',
  rejected: 'Rejected',
  suspended: 'Suspended',
  resubmitted: 'Resubmitted',
  status_note: 'Note',
};

const DECISION_COLOR: Record<string, string> = {
  approved: 'text-emerald-300 bg-emerald-900/50 border-emerald-800',
  rejected: 'text-red-400 bg-red-950/50 border-red-800',
  suspended: 'text-amber-300 bg-amber-900/50 border-amber-800',
  resubmitted: 'text-blue-400 bg-blue-900/40 border-blue-800',
  status_note: 'text-zinc-300 bg-zinc-800 border-zinc-700',
};

async function logDecision(
  providerId: string,
  decision: ProviderApprovalDecision['decision'],
  previousStatus: string,
  newStatus: string,
  notes: string | null,
  reviewedBy: string
) {
  await supabase.from('provider_approval_decisions').insert({
    provider_id: providerId,
    decision,
    previous_status: previousStatus,
    new_status: newStatus,
    notes: notes || null,
    reviewed_by: reviewedBy,
  });
}

export function PendingProvidersPage() {
  const { user } = useAuth();
  const [providers, setProviders] = useState<ProviderWithServices[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('pending_approval');
  const [selectedProvider, setSelectedProvider] = useState<ProviderWithServices | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [suspendReason, setSuspendReason] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [actionMode, setActionMode] = useState<'approve' | 'reject' | 'suspend' | null>(null);
  const [decisionHistory, setDecisionHistory] = useState<DecisionWithReviewer[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [galleryImages, setGalleryImages] = useState<ProviderGalleryImage[]>([]);
  const [showHistory, setShowHistory] = useState(false);

  const fetchProviders = useCallback(async () => {
    setLoading(true);
    let query = supabase
      .from('providers')
      .select(`*, provider_services(service_categories(*))`)
      .order('created_at', { ascending: false });
    if (statusFilter) query = query.eq('status', statusFilter);
    const { data } = await query;
    setProviders((data ?? []) as ProviderWithServices[]);
    setLoading(false);
  }, [statusFilter]);

  useEffect(() => { fetchProviders(); }, [fetchProviders]);

  const openReview = async (p: ProviderWithServices) => {
    setSelectedProvider(p);
    setRejectionReason('');
    setSuspendReason('');
    setActionMode(null);
    setShowHistory(false);
    setGalleryImages([]);

    setHistoryLoading(true);
    const [historyRes, galleryRes] = await Promise.all([
      supabase
        .from('provider_approval_decisions')
        .select('*, profiles(full_name)')
        .eq('provider_id', p.id)
        .order('created_at', { ascending: false }),
      supabase
        .from('provider_gallery_images')
        .select('*')
        .eq('provider_id', p.id)
        .eq('is_active', true)
        .order('sort_order'),
    ]);
    setDecisionHistory((historyRes.data ?? []) as DecisionWithReviewer[]);
    setGalleryImages(galleryRes.data ?? []);
    setHistoryLoading(false);
  };

  const handleApprove = async () => {
    if (!user || !selectedProvider) return;
    setActionLoading(true);
    const prev = selectedProvider.status;
    await supabase.from('providers').update({
      status: 'approved',
      is_public: true,
      approved_at: new Date().toISOString(),
      approved_by: user.id,
      rejection_reason: null,
    }).eq('id', selectedProvider.id);
    await logDecision(selectedProvider.id, 'approved', prev, 'approved', null, user.id);
    setActionLoading(false);
    setSelectedProvider(null);
    fetchProviders();
  };

  const handleReject = async () => {
    if (!user || !selectedProvider) return;
    if (!rejectionReason.trim()) return;
    setActionLoading(true);
    const prev = selectedProvider.status;
    await supabase.from('providers').update({
      status: 'rejected',
      is_public: false,
      rejection_reason: rejectionReason,
    }).eq('id', selectedProvider.id);
    await logDecision(selectedProvider.id, 'rejected', prev, 'rejected', rejectionReason, user.id);
    setActionLoading(false);
    setRejectionReason('');
    setSelectedProvider(null);
    fetchProviders();
  };

  const handleSuspend = async () => {
    if (!user || !selectedProvider) return;
    setActionLoading(true);
    const prev = selectedProvider.status;
    await supabase.from('providers').update({
      status: 'suspended',
      is_public: false,
    }).eq('id', selectedProvider.id);
    await logDecision(selectedProvider.id, 'suspended', prev, 'suspended', suspendReason || null, user.id);
    setActionLoading(false);
    setSuspendReason('');
    setSelectedProvider(null);
    fetchProviders();
  };

  const handleMoveToReview = async () => {
    if (!user || !selectedProvider) return;
    setActionLoading(true);
    const prev = selectedProvider.status;
    await supabase.from('providers').update({ status: 'pending_approval' }).eq('id', selectedProvider.id);
    await logDecision(selectedProvider.id, 'resubmitted', prev, 'pending_approval', 'Moved to pending review by admin', user.id);
    setActionLoading(false);
    setSelectedProvider(null);
    fetchProviders();
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold text-zinc-100">Provider Management</h2>
          <p className="text-sm text-zinc-500">Review and approve provider listings.</p>
        </div>
        <div className="w-48">
          <Select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            options={STATUS_FILTER_OPTIONS}
          />
        </div>
      </div>

      {loading ? (
        <div className="space-y-3">{[0, 1, 2].map((i) => <CardSkeleton key={i} />)}</div>
      ) : providers.length === 0 ? (
        <EmptyState icon={<Store size={24} />} title="No providers found" description="No providers match the selected filter." />
      ) : (
        <div className="space-y-3">
          {providers.map((p, i) => {
            const services = p.provider_services?.map((ps) => ps.service_categories).filter(Boolean) ?? [];
            return (
              <motion.div
                key={p.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.03 }}
                className="bg-zinc-900 rounded-2xl border border-zinc-800 shadow-sm p-5"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-4 flex-1 min-w-0">
                    <div className="shrink-0 relative">
                      {p.logo_image_url ? (
                        <div className="w-14 h-14 rounded-xl border border-zinc-800 bg-zinc-900 overflow-hidden flex items-center justify-center p-1">
                          <img src={p.logo_image_url} alt={`${p.business_name} logo`} className="w-full h-full object-contain" />
                        </div>
                      ) : p.profile_image_url ? (
                        <img src={p.profile_image_url} alt={p.business_name} className="w-14 h-14 rounded-xl object-cover border border-zinc-800" />
                      ) : (
                        <div className="w-14 h-14 rounded-xl bg-zinc-800 flex items-center justify-center border border-zinc-800">
                          <Store size={20} className="text-zinc-500" />
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <h3 className="font-bold text-zinc-100">{p.business_name}</h3>
                        <StatusBadge status={p.status} />
                        {p.is_public && <Badge variant="success">Public</Badge>}
                      </div>
                      <div className="flex items-center gap-3 text-xs text-zinc-500 mb-2">
                        {(p.city || p.state) && (
                          <span className="flex items-center gap-1"><MapPin size={11} />{[p.city, p.state].filter(Boolean).join(', ')}</span>
                        )}
                        {p.phone && <span className="flex items-center gap-1"><Phone size={11} />{p.phone}</span>}
                        {p.website && <span className="flex items-center gap-1"><Globe size={11} />Website</span>}
                        {p.mobile_service
                          ? <span className="flex items-center gap-1 text-emerald-400"><Smartphone size={11} />Mobile</span>
                          : <span className="flex items-center gap-1"><Store size={11} />Shop</span>}
                      </div>
                      <div className="flex flex-wrap gap-1.5 mb-1.5">
                        {services.slice(0, 5).map((cat) => <Badge key={cat.id} variant="neutral">{cat.label}</Badge>)}
                        {services.length > 5 && <Badge variant="neutral">+{services.length - 5}</Badge>}
                      </div>
                      <p className="text-xs text-zinc-500">Submitted: {new Date(p.created_at).toLocaleDateString()}</p>
                    </div>
                  </div>
                  <div className="flex flex-col gap-2 shrink-0">
                    <Button size="sm" variant="ghost" onClick={() => openReview(p)}>
                      <Eye size={13} /> Review
                    </Button>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Review Detail Modal */}
      <AnimatePresence>
        {selectedProvider && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0.95, y: 16 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 16 }}
              className="bg-zinc-900 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[92vh] overflow-y-auto"
            >
              {/* Header */}
              <div className="flex items-center justify-between p-6 border-b border-zinc-900 sticky top-0 bg-zinc-900 z-10">
                <div className="flex items-center gap-3">
                  {selectedProvider.logo_image_url ? (
                    <div className="w-10 h-10 rounded-xl border border-zinc-800 bg-zinc-900 overflow-hidden flex items-center justify-center p-0.5 shrink-0">
                      <img src={selectedProvider.logo_image_url} alt={`${selectedProvider.business_name} logo`} className="w-full h-full object-contain" />
                    </div>
                  ) : selectedProvider.profile_image_url ? (
                    <img src={selectedProvider.profile_image_url} alt={selectedProvider.business_name} className="w-10 h-10 rounded-xl object-cover border border-zinc-800 shrink-0" />
                  ) : (
                    <div className="w-10 h-10 rounded-xl bg-zinc-800 flex items-center justify-center shrink-0">
                      <Building2 size={16} className="text-zinc-500" />
                    </div>
                  )}
                  <div>
                    <h2 className="font-bold text-zinc-100 text-sm">{selectedProvider.business_name}</h2>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <StatusBadge status={selectedProvider.status} />
                      {selectedProvider.is_public && <Badge variant="success">Public</Badge>}
                    </div>
                  </div>
                </div>
                <button onClick={() => setSelectedProvider(null)} className="p-1.5 rounded-lg hover:bg-zinc-800 transition-colors">
                  <X size={16} className="text-zinc-500" />
                </button>
              </div>

              <div className="p-6 space-y-6">
                {/* Business Details */}
                <div>
                  <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-3">Business Details</h3>
                  <div className="space-y-2">
                    {[
                      { label: 'Business', value: selectedProvider.business_name },
                      { label: 'Contact', value: selectedProvider.contact_name },
                      { label: 'Email', value: selectedProvider.email },
                      { label: 'Phone', value: selectedProvider.phone },
                      { label: 'Website', value: selectedProvider.website },
                      { label: 'Instagram', value: selectedProvider.instagram ? `@${selectedProvider.instagram.replace('@', '')}` : null },
                      { label: 'Location', value: [selectedProvider.street_address, selectedProvider.city, selectedProvider.state, selectedProvider.zip_code].filter(Boolean).join(', ') || null },
                      { label: 'Mobile Service', value: selectedProvider.mobile_service ? `Yes (${selectedProvider.service_radius_miles} mi radius)` : 'No' },
                    ].map((row) => row.value ? (
                      <div key={row.label} className="flex gap-3">
                        <span className="text-xs text-zinc-500 w-20 shrink-0 pt-0.5">{row.label}</span>
                        <span className="text-sm text-zinc-200">{row.value}</span>
                      </div>
                    ) : null)}
                  </div>
                  {selectedProvider.description && (
                    <div className="flex gap-3 mt-2">
                      <span className="text-xs text-zinc-500 w-20 shrink-0 pt-0.5">Description</span>
                      <span className="text-sm text-zinc-300 leading-relaxed">{selectedProvider.description}</span>
                    </div>
                  )}
                </div>

                {/* Services */}
                <div>
                  <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-3">Services</h3>
                  <div className="flex flex-wrap gap-1.5">
                    {selectedProvider.provider_services?.map((ps) => (
                      <Badge key={ps.service_categories?.id} variant="neutral">{ps.service_categories?.label}</Badge>
                    ))}
                    {(!selectedProvider.provider_services || selectedProvider.provider_services.length === 0) && (
                      <span className="text-sm text-zinc-500">No services selected</span>
                    )}
                  </div>
                </div>

                {/* Logo Preview */}
                {selectedProvider.logo_image_url && (
                  <div>
                    <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                      <Building2 size={13} /> Business Logo
                    </h3>
                    <div className="w-24 h-24 rounded-xl border border-zinc-800 bg-zinc-950 overflow-hidden flex items-center justify-center p-2">
                      <img src={selectedProvider.logo_image_url} alt="Logo" className="w-full h-full object-contain" />
                    </div>
                  </div>
                )}

                {/* Gallery Preview */}
                {galleryImages.length > 0 && (
                  <div>
                    <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                      <ImageIcon size={13} /> Gallery ({galleryImages.length} images)
                    </h3>
                    <div className="grid grid-cols-4 gap-2">
                      {galleryImages.slice(0, 8).map((img) => (
                        <img key={img.id} src={img.image_url} alt={img.caption ?? ''} className="w-full h-20 object-cover rounded-xl border border-zinc-800" />
                      ))}
                    </div>
                  </div>
                )}

                {/* Rejection note if present */}
                {selectedProvider.rejection_reason && (
                  <div className="flex gap-2 p-3 bg-red-950/50 border border-red-800 rounded-xl">
                    <AlertTriangle size={14} className="text-red-400 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-xs font-medium text-red-400 mb-0.5">Previous rejection reason</p>
                      <p className="text-xs text-red-400">{selectedProvider.rejection_reason}</p>
                    </div>
                  </div>
                )}

                {/* Approval History */}
                <div>
                  <button
                    onClick={() => setShowHistory((v) => !v)}
                    className="flex items-center gap-1.5 text-xs font-semibold text-zinc-500 uppercase tracking-wider hover:text-zinc-300 transition-colors"
                  >
                    <Clock size={13} /> Approval History ({decisionHistory.length})
                    {showHistory ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                  </button>
                  {showHistory && (
                    <div className="mt-3 space-y-2">
                      {historyLoading ? (
                        <div className="text-xs text-zinc-500 py-2">Loading history...</div>
                      ) : decisionHistory.length === 0 ? (
                        <div className="text-xs text-zinc-500 py-2">No decision history yet.</div>
                      ) : (
                        decisionHistory.map((d) => (
                          <div key={d.id} className={`flex gap-3 p-2.5 rounded-lg border text-xs ${DECISION_COLOR[d.decision] ?? 'text-zinc-300 bg-zinc-800 border-zinc-700'}`}>
                            <div className="shrink-0 font-semibold w-16">{DECISION_LABEL[d.decision]}</div>
                            <div className="flex-1 min-w-0">
                              {d.notes && <p className="mb-0.5">{d.notes}</p>}
                              <p className="opacity-60">{new Date(d.created_at).toLocaleString()} {d.profiles?.full_name ? `· ${d.profiles.full_name}` : ''}</p>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>

                {/* Admin Actions */}
                <div className="pt-4 border-t border-zinc-900">
                  <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-4">Admin Actions</h3>

                  {/* Approve inline */}
                  {(selectedProvider.status === 'pending_approval' || selectedProvider.status === 'rejected' || selectedProvider.status === 'suspended') && actionMode !== 'reject' && actionMode !== 'suspend' && (
                    <div className="mb-3">
                      <Button
                        variant="primary"
                        fullWidth
                        loading={actionLoading && actionMode === 'approve'}
                        onClick={() => { setActionMode('approve'); handleApprove(); }}
                      >
                        <Check size={14} /> Approve & Make Public
                      </Button>
                    </div>
                  )}

                  {/* Reject form */}
                  {(selectedProvider.status === 'pending_approval' || selectedProvider.status === 'approved') && actionMode !== 'approve' && actionMode !== 'suspend' && (
                    <div className="mb-3">
                      {actionMode === 'reject' ? (
                        <div className="space-y-3 p-4 bg-red-950/50 border border-red-800 rounded-xl">
                          <TextArea
                            label="Rejection reason (required)"
                            placeholder="Explain why this listing is not approved..."
                            value={rejectionReason}
                            onChange={(e) => setRejectionReason(e.target.value)}
                            rows={3}
                          />
                          <div className="flex gap-2">
                            <Button size="sm" variant="ghost" onClick={() => setActionMode(null)}>Cancel</Button>
                            <Button
                              size="sm"
                              variant="danger"
                              fullWidth
                              loading={actionLoading}
                              onClick={handleReject}
                              disabled={!rejectionReason.trim()}
                            >
                              <X size={13} /> Confirm Reject
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <Button variant="ghost" fullWidth onClick={() => setActionMode('reject')} className="border border-red-800 text-red-400 hover:bg-red-950/50">
                          <X size={14} /> Reject Listing
                        </Button>
                      )}
                    </div>
                  )}

                  {/* Suspend form */}
                  {selectedProvider.status === 'approved' && actionMode !== 'approve' && actionMode !== 'reject' && (
                    <div className="mb-3">
                      {actionMode === 'suspend' ? (
                        <div className="space-y-3 p-4 bg-amber-900/50 border border-amber-800 rounded-xl">
                          <TextArea
                            label="Suspension reason (optional)"
                            placeholder="Reason for suspension..."
                            value={suspendReason}
                            onChange={(e) => setSuspendReason(e.target.value)}
                            rows={2}
                          />
                          <div className="flex gap-2">
                            <Button size="sm" variant="ghost" onClick={() => setActionMode(null)}>Cancel</Button>
                            <Button
                              size="sm"
                              variant="danger"
                              fullWidth
                              loading={actionLoading}
                              onClick={handleSuspend}
                            >
                              Confirm Suspend
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <Button variant="ghost" fullWidth onClick={() => setActionMode('suspend')} className="border border-amber-800 text-amber-300 hover:bg-amber-900/50">
                          Suspend Listing
                        </Button>
                      )}
                    </div>
                  )}

                  {/* Move to review */}
                  {(selectedProvider.status === 'rejected' || selectedProvider.status === 'suspended' || selectedProvider.status === 'draft') && (
                    <Button
                      variant="ghost"
                      fullWidth
                      loading={actionLoading}
                      onClick={handleMoveToReview}
                      className="border border-blue-800 text-blue-400 hover:bg-blue-900/40"
                    >
                      Move to Pending Review
                    </Button>
                  )}
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
