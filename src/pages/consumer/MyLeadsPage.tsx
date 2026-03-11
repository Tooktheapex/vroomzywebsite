import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { MessageSquare, ExternalLink } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import type { LeadRequest } from '../../lib/database.types';
import { useAuth } from '../../contexts/AuthContext';
import { StatusBadge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { EmptyState } from '../../components/ui/EmptyState';
import { CardSkeleton } from '../../components/ui/LoadingSpinner';

type LeadWithProvider = LeadRequest & {
  providers: { business_name: string; city: string | null; state: string | null } | null;
  service_categories: { label: string } | null;
};

export function MyLeadsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [leads, setLeads] = useState<LeadWithProvider[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    supabase
      .from('lead_requests')
      .select(`*, providers(business_name, city, state), service_categories(label)`)
      .eq('consumer_user_id', user.id)
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        setLeads((data ?? []) as LeadWithProvider[]);
        setLoading(false);
      });
  }, [user]);

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-xl font-bold text-zinc-100">My Requests</h2>
        <p className="text-sm text-zinc-500">Track all your service requests to providers.</p>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => <CardSkeleton key={i} />)}
        </div>
      ) : leads.length === 0 ? (
        <EmptyState
          icon={<MessageSquare size={24} />}
          title="No requests yet"
          description="Once you contact a service provider, your requests will appear here."
          action={<Button onClick={() => navigate('/browse')}>Find a Provider</Button>}
        />
      ) : (
        <div className="space-y-3">
          {leads.map((lead, i) => (
            <motion.div
              key={lead.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04 }}
              className="bg-zinc-900 rounded-2xl border border-zinc-800 shadow-sm p-5"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <h3 className="font-bold text-zinc-100">{lead.providers?.business_name ?? 'Unknown Provider'}</h3>
                    <StatusBadge status={lead.status} />
                    {lead.service_categories?.label && (
                      <span className="text-xs bg-blue-900/40 text-blue-400 px-2 py-0.5 rounded-full">
                        {lead.service_categories.label}
                      </span>
                    )}
                  </div>
                  {(lead.providers?.city || lead.providers?.state) && (
                    <p className="text-xs text-zinc-500 mb-2">
                      {[lead.providers.city, lead.providers.state].filter(Boolean).join(', ')}
                    </p>
                  )}
                  {lead.service_needed && (
                    <p className="text-sm text-zinc-400 line-clamp-2">{lead.service_needed}</p>
                  )}
                  {lead.vehicle_year && (
                    <p className="text-xs text-zinc-500 mt-1">
                      Vehicle: {[lead.vehicle_year, lead.vehicle_make, lead.vehicle_model].filter(Boolean).join(' ')}
                    </p>
                  )}
                </div>
                <div className="text-right shrink-0">
                  <p className="text-xs text-zinc-500">{new Date(lead.created_at).toLocaleDateString()}</p>
                  {lead.preferred_date && (
                    <p className="text-xs text-zinc-500 mt-1">Preferred: {new Date(lead.preferred_date).toLocaleDateString()}</p>
                  )}
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
