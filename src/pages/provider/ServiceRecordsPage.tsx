import React, { useEffect, useState } from 'react';
import { Plus, FileText, Car } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import type { Provider, VehicleServiceRecord } from '../../lib/database.types';
import { useAuth } from '../../contexts/AuthContext';
import { Button } from '../../components/ui/Button';
import { EmptyState } from '../../components/ui/EmptyState';
import { CardSkeleton } from '../../components/ui/LoadingSpinner';
import { ServiceRecordUploadModal } from '../../components/ui/ServiceRecordUploadModal';
import { ServiceRecordList } from '../../components/ui/ServiceRecordList';

export function ServiceRecordsPage() {
  const { user } = useAuth();
  const [provider, setProvider] = useState<Provider | null>(null);
  const [records, setRecords] = useState<VehicleServiceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);

  const fetchRecords = async () => {
    if (!user) return;

    const { data: p } = await supabase
      .from('providers')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle();

    setProvider(p ?? null);

    if (!p) { setLoading(false); return; }

    const { data: recs } = await supabase
      .from('vehicle_service_records')
      .select('*')
      .eq('provider_id', p.id)
      .order('service_date', { ascending: false });

    setRecords(recs ?? []);
    setLoading(false);
  };

  useEffect(() => { fetchRecords(); }, [user]);

  const isApproved = provider?.status === 'approved';

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold text-zinc-100">Service Records</h2>
          <p className="text-sm text-zinc-500">Upload service records for vehicles you've worked on.</p>
        </div>
        {isApproved && (
          <Button size="sm" onClick={() => setShowModal(true)}>
            <Plus size={15} /> Upload Record
          </Button>
        )}
      </div>

      {!isApproved && provider && (
        <div className="mb-5 p-4 bg-amber-900/50 border border-amber-800 rounded-2xl text-sm text-amber-300">
          Your provider account must be approved before you can upload service records.
        </div>
      )}

      {loading ? (
        <div className="space-y-3">{[0, 1].map((i) => <CardSkeleton key={i} />)}</div>
      ) : records.length === 0 ? (
        <EmptyState
          icon={<FileText size={24} />}
          title="No service records yet"
          description={
            isApproved
              ? "Upload PDFs or photos of service documents for vehicles you've worked on. Records are linked by VIN."
              : "Once your account is approved, you can start uploading service records."
          }
          action={isApproved ? (
            <Button size="sm" onClick={() => setShowModal(true)}>
              <Plus size={15} /> Upload First Record
            </Button>
          ) : undefined}
        />
      ) : (
        <div className="bg-zinc-900 rounded-2xl border border-zinc-800 shadow-sm">
          <div className="p-5 border-b border-zinc-800 flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm text-zinc-400">
              <Car size={15} className="text-zinc-500" />
              {records.length} record{records.length !== 1 ? 's' : ''} uploaded
            </div>
          </div>
          <div className="p-5">
            <ServiceRecordList records={records} emptyMessage="No records yet." />
          </div>
        </div>
      )}

      {showModal && provider && (
        <ServiceRecordUploadModal
          provider={provider}
          sourceType="provider_upload"
          onClose={() => setShowModal(false)}
          onSuccess={() => {
            setShowModal(false);
            fetchRecords();
          }}
        />
      )}
    </div>
  );
}
