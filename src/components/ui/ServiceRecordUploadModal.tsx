import React, { useRef, useState } from 'react';
import { X, Upload, FileText, Image as ImageIcon, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { uploadServiceRecordFile } from '../../lib/storage';
import { useAuth } from '../../contexts/AuthContext';
import type { Vehicle, Provider } from '../../lib/database.types';
import { Input, TextArea, Select } from './Input';
import { Button } from './Button';

const RECORD_TYPES = [
  { value: 'oil_change', label: 'Oil Change' },
  { value: 'tire_rotation', label: 'Tire Rotation / Replacement' },
  { value: 'brake_service', label: 'Brake Service' },
  { value: 'transmission', label: 'Transmission' },
  { value: 'engine', label: 'Engine / Mechanical' },
  { value: 'detailing', label: 'Detailing' },
  { value: 'body_work', label: 'Body Work / Paint' },
  { value: 'inspection', label: 'Inspection / Diagnostic' },
  { value: 'warranty', label: 'Warranty / Recall' },
  { value: 'other', label: 'Other' },
];

interface ServiceRecordUploadModalProps {
  vehicle?: Vehicle | null;
  provider?: Provider | null;
  sourceType: 'owner_upload' | 'provider_upload';
  onClose: () => void;
  onSuccess: () => void;
  prefilledVin?: string;
}

export function ServiceRecordUploadModal({
  vehicle,
  provider,
  sourceType,
  onClose,
  onSuccess,
  prefilledVin = '',
}: ServiceRecordUploadModalProps) {
  const { user } = useAuth();
  const inputRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState({
    record_title: '',
    record_type: '',
    service_date: '',
    mileage: '',
    notes: '',
    vin: vehicle?.vin ?? prefilledVin,
  });

  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;

    const allowed = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];
    if (!allowed.includes(f.type)) {
      setError('Unsupported file type. Use PDF, JPG, PNG, or WebP.');
      return;
    }
    if (f.size > 20 * 1024 * 1024) {
      setError('File must be under 20 MB.');
      return;
    }

    setFile(f);
    setError(null);
    e.target.value = '';
  }

  function formatVin(raw: string) {
    return raw.toUpperCase().trim();
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!user || !file) return;

    const vin = formatVin(form.vin);
    if (!vin) {
      setError('VIN is required.');
      return;
    }
    if (!form.record_title.trim()) {
      setError('Record title is required.');
      return;
    }

    setUploading(true);
    setError(null);
    setProgress(5);

    const tempId = crypto.randomUUID();

    const uploadResult = await uploadServiceRecordFile(user.id, tempId, file, setProgress);
    if (uploadResult.error) {
      setError(uploadResult.error);
      setUploading(false);
      return;
    }

    setProgress(90);

    const { error: dbErr } = await supabase.from('vehicle_service_records').insert({
      vehicle_id: vehicle?.id ?? null,
      vin,
      uploaded_by_user_id: user.id,
      provider_id: provider?.id ?? null,
      record_title: form.record_title.trim(),
      record_type: form.record_type || null,
      service_date: form.service_date || null,
      mileage: form.mileage ? parseInt(form.mileage, 10) : null,
      notes: form.notes.trim() || null,
      file_url: uploadResult.url,
      file_storage_path: uploadResult.path,
      file_type: file.type,
      file_size_bytes: file.size,
      source_type: sourceType,
      visibility: 'private_owner',
    });

    if (dbErr) {
      setError(dbErr.message);
      setUploading(false);
      return;
    }

    setProgress(100);
    setSuccess(true);
    setTimeout(() => {
      onSuccess();
      onClose();
    }, 1200);
  }

  const fileIcon = file?.type === 'application/pdf'
    ? <FileText size={14} className="text-red-400" />
    : <ImageIcon size={14} className="text-blue-400" />;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-zinc-900 rounded-2xl shadow-2xl w-full max-w-lg max-h-[92vh] overflow-y-auto border border-zinc-800">
        <div className="flex items-center justify-between p-6 border-b border-zinc-800 sticky top-0 bg-zinc-900 z-10">
          <h2 className="font-bold text-zinc-100">Upload Service Record</h2>
          <button onClick={onClose} disabled={uploading} className="p-1.5 rounded-lg hover:bg-zinc-800 transition-colors disabled:opacity-40">
            <X size={16} className="text-zinc-500" />
          </button>
        </div>

        {success ? (
          <div className="p-8 flex flex-col items-center gap-3 text-center">
            <div className="w-14 h-14 rounded-2xl bg-emerald-900/50 flex items-center justify-center">
              <CheckCircle2 size={28} className="text-emerald-400" />
            </div>
            <h3 className="font-bold text-zinc-100">Record uploaded</h3>
            <p className="text-sm text-zinc-500">Your service record has been saved successfully.</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            {error && (
              <div className="flex items-start gap-2 p-3 bg-red-950/50 border border-red-800 rounded-xl text-sm text-red-400">
                <AlertCircle size={14} className="shrink-0 mt-0.5 text-red-400" />
                {error}
              </div>
            )}

            {/* VIN */}
            <div>
              <Input
                label="Vehicle VIN"
                value={form.vin}
                onChange={(e) => setForm({ ...form, vin: e.target.value.toUpperCase().trim() })}
                placeholder="e.g. 1HGCM82633A004352"
                required
                disabled={!!vehicle?.vin}
                hint={vehicle?.vin ? `Auto-linked to ${vehicle.year} ${vehicle.make} ${vehicle.model}` : 'Used to link this record to the vehicle across ownership'}
              />
            </div>

            {/* Title */}
            <Input
              label="Record title"
              value={form.record_title}
              onChange={(e) => setForm({ ...form, record_title: e.target.value })}
              placeholder="e.g. Full synthetic oil change"
              required
            />

            {/* Type + Date row */}
            <div className="grid grid-cols-2 gap-3">
              <Select
                label="Record type"
                value={form.record_type}
                onChange={(e) => setForm({ ...form, record_type: e.target.value })}
                options={RECORD_TYPES}
                placeholder="Select type"
              />
              <Input
                label="Service date"
                type="date"
                value={form.service_date}
                onChange={(e) => setForm({ ...form, service_date: e.target.value })}
              />
            </div>

            {/* Mileage */}
            <Input
              label="Mileage at service"
              type="number"
              value={form.mileage}
              onChange={(e) => setForm({ ...form, mileage: e.target.value })}
              placeholder="e.g. 45000"
            />

            {/* Notes */}
            <TextArea
              label="Notes (optional)"
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              placeholder="Any additional details about this service…"
              rows={2}
            />

            {/* File Upload */}
            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-1.5">
                Document <span className="text-red-400">*</span>
              </label>
              {file ? (
                <div className="flex items-center gap-2 p-3 bg-zinc-950 border border-zinc-800 rounded-xl">
                  {fileIcon}
                  <span className="text-sm text-zinc-300 flex-1 truncate">{file.name}</span>
                  <span className="text-xs text-zinc-500">{(file.size / 1024 / 1024).toFixed(1)} MB</span>
                  <button
                    type="button"
                    onClick={() => setFile(null)}
                    disabled={uploading}
                    className="text-zinc-500 hover:text-red-400 transition-colors disabled:opacity-40"
                  >
                    <X size={14} />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => inputRef.current?.click()}
                  className="w-full flex flex-col items-center gap-2 p-5 border-2 border-dashed border-zinc-700 hover:border-blue-500 rounded-xl text-zinc-500 hover:text-blue-400 transition-colors"
                >
                  <Upload size={20} />
                  <span className="text-sm font-medium">Click to select file</span>
                  <span className="text-xs text-zinc-500">PDF, JPG, PNG, WebP &mdash; max 20 MB</span>
                </button>
              )}
              <input
                ref={inputRef}
                type="file"
                accept="application/pdf,image/jpeg,image/png,image/webp"
                onChange={handleFileSelect}
                className="hidden"
              />
            </div>

            {uploading && (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs text-zinc-500">
                  <span>Uploading…</span>
                  <span>{progress}%</span>
                </div>
                <div className="w-full bg-zinc-800 rounded-full h-1.5 overflow-hidden">
                  <div
                    className="h-full bg-blue-500 rounded-full transition-all duration-300"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>
            )}

            <div className="flex gap-2 pt-1">
              <Button type="button" variant="ghost" onClick={onClose} disabled={uploading}>
                Cancel
              </Button>
              <Button
                type="submit"
                fullWidth
                disabled={!file || uploading}
                loading={uploading}
              >
                {uploading ? (
                  <span className="flex items-center gap-1.5"><Loader2 size={14} className="animate-spin" /> Saving…</span>
                ) : 'Save Record'}
              </Button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
