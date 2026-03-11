import React, { useEffect, useState, useCallback } from 'react';
import { FileText, Search, Trash2, ExternalLink, Loader2, AlertCircle } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { getServiceRecordSignedUrl, deleteStorageFile } from '../../lib/storage';
import type { VehicleServiceRecord } from '../../lib/database.types';
import { EmptyState } from '../../components/ui/EmptyState';
import { CardSkeleton } from '../../components/ui/LoadingSpinner';
import { Input } from '../../components/ui/Input';

type RecordWithUploader = VehicleServiceRecord & {
  profiles: { full_name: string | null; email: string | null } | null;
};

export function AdminServiceRecordsPage() {
  const [records, setRecords] = useState<RecordWithUploader[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [openingId, setOpeningId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchRecords = useCallback(async () => {
    setLoading(true);
    let query = supabase
      .from('vehicle_service_records')
      .select('*, profiles!uploaded_by_user_id(full_name, email)')
      .order('created_at', { ascending: false })
      .limit(200);

    if (search.trim()) {
      query = query.or(`vin.ilike.%${search.trim()}%,record_title.ilike.%${search.trim()}%`);
    }

    const { data, error: err } = await query;
    if (err) {
      setError(err.message);
    } else {
      setRecords((data ?? []) as RecordWithUploader[]);
    }
    setLoading(false);
  }, [search]);

  useEffect(() => {
    const t = setTimeout(() => fetchRecords(), 300);
    return () => clearTimeout(t);
  }, [fetchRecords]);

  async function openFile(record: VehicleServiceRecord) {
    setOpeningId(record.id);
    const url = await getServiceRecordSignedUrl(record.file_storage_path, 3600);
    setOpeningId(null);
    if (url) {
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  }

  async function handleDelete(record: VehicleServiceRecord) {
    if (!confirm(`Delete "${record.record_title}"? This cannot be undone.`)) return;
    setDeletingId(record.id);

    await deleteStorageFile('service-records', record.file_storage_path);
    const { error: err } = await supabase.from('vehicle_service_records').delete().eq('id', record.id);

    if (err) {
      setError(err.message);
    } else {
      setRecords((prev) => prev.filter((r) => r.id !== record.id));
    }
    setDeletingId(null);
  }

  const SOURCE_LABELS: Record<string, string> = {
    owner_upload: 'Owner',
    provider_upload: 'Provider',
    admin_upload: 'Admin',
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold text-zinc-100">Service Records</h2>
          <p className="text-sm text-zinc-500">Review and moderate uploaded service history documents.</p>
        </div>
      </div>

      {error && (
        <div className="mb-5 flex items-start gap-2 p-3 bg-red-950/50 border border-red-800 rounded-xl text-sm text-red-400">
          <AlertCircle size={14} className="shrink-0 mt-0.5 text-red-400" />
          {error}
          <button className="ml-auto text-red-400 hover:text-red-400" onClick={() => setError(null)}>Dismiss</button>
        </div>
      )}

      <div className="mb-4 relative">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 pointer-events-none" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by VIN or title…"
          className="pl-9"
        />
      </div>

      {loading ? (
        <div className="space-y-3">{[0, 1, 2].map((i) => <CardSkeleton key={i} />)}</div>
      ) : records.length === 0 ? (
        <EmptyState
          icon={<FileText size={24} />}
          title="No service records found"
          description={search ? 'No records match your search.' : 'No service records have been uploaded yet.'}
        />
      ) : (
        <div className="bg-zinc-900 rounded-2xl border border-zinc-800 shadow-sm divide-y divide-zinc-800">
          {records.map((r) => (
            <div key={r.id} className="flex items-start gap-4 p-4 hover:bg-zinc-800 transition-colors">
              <div className="w-8 h-8 rounded-lg bg-zinc-800 flex items-center justify-center shrink-0 mt-0.5">
                <FileText size={14} className="text-zinc-500" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div>
                    <p className="text-sm font-semibold text-zinc-200">{r.record_title}</p>
                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                      <span className="text-xs text-zinc-500 font-mono">{r.vin}</span>
                      {r.service_date && (
                        <span className="text-xs text-zinc-500">
                          {new Date(r.service_date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                        </span>
                      )}
                      <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${
                        r.source_type === 'owner_upload'
                          ? 'bg-blue-900/40 text-blue-400'
                          : r.source_type === 'provider_upload'
                            ? 'bg-emerald-900/50 text-emerald-400'
                            : 'bg-zinc-800 text-zinc-400'
                      }`}>
                        {SOURCE_LABELS[r.source_type] ?? r.source_type}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => openFile(r)}
                      disabled={openingId === r.id}
                      className="inline-flex items-center gap-1 text-xs font-medium text-blue-400 hover:text-blue-300 transition-colors disabled:opacity-50 px-2 py-1 rounded-lg hover:bg-blue-900/40"
                    >
                      {openingId === r.id
                        ? <Loader2 size={12} className="animate-spin" />
                        : <ExternalLink size={12} />}
                      Open
                    </button>
                    <button
                      onClick={() => handleDelete(r)}
                      disabled={deletingId === r.id}
                      className="inline-flex items-center gap-1 text-xs font-medium text-red-400 hover:text-red-400 transition-colors disabled:opacity-50 px-2 py-1 rounded-lg hover:bg-red-950/50"
                    >
                      {deletingId === r.id
                        ? <Loader2 size={12} className="animate-spin" />
                        : <Trash2 size={12} />}
                      Delete
                    </button>
                  </div>
                </div>
                <div className="mt-1 text-xs text-zinc-500">
                  Uploaded by {r.profiles?.full_name ?? r.profiles?.email ?? 'Unknown'} &middot;{' '}
                  {new Date(r.created_at).toLocaleDateString()}
                  {r.file_size_bytes != null && ` · ${(r.file_size_bytes / 1024 / 1024).toFixed(1)} MB`}
                </div>
                {r.notes && <p className="mt-1 text-xs text-zinc-500 italic line-clamp-1">{r.notes}</p>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
