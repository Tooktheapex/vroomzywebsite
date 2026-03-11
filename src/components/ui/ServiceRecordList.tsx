import React, { useState } from 'react';
import { FileText, Image as ImageIcon, ExternalLink, Loader2, Calendar, Gauge, ChevronDown, ChevronUp, Tag } from 'lucide-react';
import { getServiceRecordSignedUrl } from '../../lib/storage';
import type { VehicleServiceRecord } from '../../lib/database.types';

const RECORD_TYPE_LABELS: Record<string, string> = {
  oil_change: 'Oil Change',
  tire_rotation: 'Tire Rotation / Replacement',
  brake_service: 'Brake Service',
  transmission: 'Transmission',
  engine: 'Engine / Mechanical',
  detailing: 'Detailing',
  body_work: 'Body Work / Paint',
  inspection: 'Inspection / Diagnostic',
  warranty: 'Warranty / Recall',
  other: 'Other',
};

interface ServiceRecordListProps {
  records: VehicleServiceRecord[];
  emptyMessage?: string;
}

export function ServiceRecordList({ records, emptyMessage = 'No service records yet.' }: ServiceRecordListProps) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const [openingUrl, setOpeningUrl] = useState<string | null>(null);

  async function openFile(record: VehicleServiceRecord) {
    setOpeningUrl(record.id);
    const url = await getServiceRecordSignedUrl(record.file_storage_path, 3600);
    setOpeningUrl(null);
    if (url) {
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  }

  if (records.length === 0) {
    return (
      <div className="py-8 text-center text-sm text-zinc-500">{emptyMessage}</div>
    );
  }

  return (
    <div className="space-y-2">
      {records.map((r) => {
        const isPdf = r.file_type === 'application/pdf';
        const isExpanded = expanded === r.id;

        return (
          <div
            key={r.id}
            className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden"
          >
            <button
              type="button"
              onClick={() => setExpanded(isExpanded ? null : r.id)}
              className="w-full flex items-center gap-3 p-3.5 text-left hover:bg-zinc-800 transition-colors"
            >
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${isPdf ? 'bg-red-950/50' : 'bg-blue-900/40'}`}>
                {isPdf
                  ? <FileText size={15} className="text-red-400" />
                  : <ImageIcon size={15} className="text-blue-400" />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-zinc-200 truncate">{r.record_title}</p>
                <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                  {r.service_date && (
                    <span className="flex items-center gap-1 text-xs text-zinc-500">
                      <Calendar size={10} />
                      {new Date(r.service_date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                    </span>
                  )}
                  {r.mileage != null && (
                    <span className="flex items-center gap-1 text-xs text-zinc-500">
                      <Gauge size={10} />
                      {r.mileage.toLocaleString()} mi
                    </span>
                  )}
                  {r.record_type && (
                    <span className="flex items-center gap-1 text-xs text-zinc-500">
                      <Tag size={10} />
                      {RECORD_TYPE_LABELS[r.record_type] ?? r.record_type}
                    </span>
                  )}
                </div>
              </div>
              <div className="shrink-0 flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); openFile(r); }}
                  disabled={openingUrl === r.id}
                  className="inline-flex items-center gap-1 text-xs font-medium text-blue-400 hover:text-blue-300 transition-colors disabled:opacity-50 px-2 py-1 rounded-lg hover:bg-blue-900/40"
                >
                  {openingUrl === r.id
                    ? <Loader2 size={12} className="animate-spin" />
                    : <ExternalLink size={12} />}
                  Open
                </button>
                {isExpanded ? <ChevronUp size={14} className="text-zinc-500" /> : <ChevronDown size={14} className="text-zinc-500" />}
              </div>
            </button>

            {isExpanded && (
              <div className="border-t border-zinc-800 px-4 py-3 bg-zinc-950 space-y-1.5">
                <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                  <div className="flex gap-2">
                    <span className="text-zinc-500 w-20 shrink-0">VIN</span>
                    <span className="text-zinc-300 font-mono">{r.vin}</span>
                  </div>
                  {r.source_type && (
                    <div className="flex gap-2">
                      <span className="text-zinc-500 w-20 shrink-0">Source</span>
                      <span className="text-zinc-300 capitalize">{r.source_type.replace('_', ' ')}</span>
                    </div>
                  )}
                  {r.file_size_bytes != null && (
                    <div className="flex gap-2">
                      <span className="text-zinc-500 w-20 shrink-0">File size</span>
                      <span className="text-zinc-300">{(r.file_size_bytes / 1024 / 1024).toFixed(2)} MB</span>
                    </div>
                  )}
                  <div className="flex gap-2">
                    <span className="text-zinc-500 w-20 shrink-0">Added</span>
                    <span className="text-zinc-300">{new Date(r.created_at).toLocaleDateString()}</span>
                  </div>
                </div>
                {r.notes && (
                  <div className="flex gap-2 pt-1">
                    <span className="text-zinc-500 text-xs w-20 shrink-0">Notes</span>
                    <span className="text-zinc-300 text-xs leading-relaxed">{r.notes}</span>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
