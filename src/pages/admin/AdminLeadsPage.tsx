import React, { useEffect, useState } from 'react';
import { MessageSquare } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import type { LeadRequest } from '../../lib/database.types';
import { StatusBadge } from '../../components/ui/Badge';
import { EmptyState } from '../../components/ui/EmptyState';
import { CardSkeleton } from '../../components/ui/LoadingSpinner';

type LeadWithDetails = LeadRequest & {
  providers: { business_name: string } | null;
  service_categories: { label: string } | null;
};

export function AdminLeadsPage() {
  const [leads, setLeads] = useState<LeadWithDetails[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase
      .from('lead_requests')
      .select(`*, providers(business_name), service_categories(label)`)
      .order('created_at', { ascending: false })
      .limit(100)
      .then(({ data }) => {
        setLeads((data ?? []) as LeadWithDetails[]);
        setLoading(false);
      });
  }, []);

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-xl font-bold text-zinc-100">Lead Activity</h2>
        <p className="text-sm text-zinc-500">All lead requests across the platform.</p>
      </div>

      {loading ? (
        <div className="space-y-3">{[0,1,2].map((i) => <CardSkeleton key={i} />)}</div>
      ) : leads.length === 0 ? (
        <EmptyState icon={<MessageSquare size={24} />} title="No leads yet" description="Lead activity will appear here as consumers submit requests." />
      ) : (
        <div className="bg-zinc-900 rounded-2xl border border-zinc-800 shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-zinc-800 border-b border-zinc-800">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-semibold text-zinc-300">Consumer</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-zinc-300">Provider</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-zinc-300">Service</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-zinc-300">Status</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-zinc-300">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800">
              {leads.map((lead) => (
                <tr key={lead.id} className="hover:bg-zinc-800 transition-colors">
                  <td className="px-4 py-3">
                    <p className="font-medium text-zinc-200">{lead.contact_name}</p>
                    {lead.contact_email && <p className="text-xs text-zinc-500">{lead.contact_email}</p>}
                  </td>
                  <td className="px-4 py-3 text-zinc-300">{lead.providers?.business_name ?? '—'}</td>
                  <td className="px-4 py-3 text-zinc-400">{lead.service_categories?.label ?? '—'}</td>
                  <td className="px-4 py-3"><StatusBadge status={lead.status} /></td>
                  <td className="px-4 py-3 text-xs text-zinc-500">{new Date(lead.created_at).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
