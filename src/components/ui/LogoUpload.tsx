import React, { useRef, useState } from 'react';
import { Upload, X, Building2, Loader2 } from 'lucide-react';
import { uploadProviderLogo, deleteStorageFile, MAX_LOGO_SIZE } from '../../lib/storage';
import { supabase } from '../../lib/supabase';

interface LogoUploadProps {
  providerId: string;
  currentLogoUrl: string | null;
  currentLogoPath: string | null;
  onLogoChange: (url: string | null, path: string | null) => void;
}

export function LogoUpload({ providerId, currentLogoUrl, currentLogoPath, onLogoChange }: LogoUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);

  const displayUrl = preview ?? currentLogoUrl;

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(file.type)) {
      setError('Unsupported format. Use JPG, PNG, WebP, or GIF.');
      return;
    }
    if (file.size > MAX_LOGO_SIZE) {
      setError('Logo must be under 2 MB.');
      return;
    }

    setError(null);
    setPendingFile(file);
    const reader = new FileReader();
    reader.onload = (ev) => setPreview(ev.target?.result as string);
    reader.readAsDataURL(file);
    e.target.value = '';
  }

  async function handleSave() {
    if (!pendingFile) return;
    setUploading(true);
    setError(null);
    setProgress(0);

    if (currentLogoPath) {
      await deleteStorageFile('provider-logos', currentLogoPath);
    }

    const result = await uploadProviderLogo(providerId, pendingFile, setProgress);
    if (result.error) {
      setError(result.error);
      setUploading(false);
      return;
    }

    const { error: dbErr } = await supabase
      .from('providers')
      .update({ logo_image_url: result.url, logo_storage_path: result.path })
      .eq('id', providerId);

    if (dbErr) {
      setError('Uploaded but failed to save URL. Try again.');
      setUploading(false);
      return;
    }

    onLogoChange(result.url, result.path);
    setPreview(null);
    setPendingFile(null);
    setUploading(false);
    setProgress(0);
  }

  function handleCancel() {
    setPreview(null);
    setPendingFile(null);
    setError(null);
  }

  async function handleRemove() {
    if (!currentLogoPath && !currentLogoUrl) return;
    setRemoving(true);
    setError(null);

    if (currentLogoPath) {
      await deleteStorageFile('provider-logos', currentLogoPath);
    }

    const { error: dbErr } = await supabase
      .from('providers')
      .update({ logo_image_url: null, logo_storage_path: null })
      .eq('id', providerId);

    if (dbErr) {
      setError('Failed to remove logo.');
      setRemoving(false);
      return;
    }

    onLogoChange(null, null);
    setRemoving(false);
  }

  return (
    <div className="space-y-3">
      <div className="flex items-start gap-4">
        <div className="relative shrink-0">
          <div className="w-20 h-20 rounded-2xl border-2 border-zinc-700 bg-zinc-800 overflow-hidden flex items-center justify-center">
            {displayUrl ? (
              <img src={displayUrl} alt="Business logo" className="w-full h-full object-contain p-1" />
            ) : (
              <Building2 className="w-8 h-8 text-zinc-600" />
            )}
          </div>
          {displayUrl && !pendingFile && (
            <button
              type="button"
              onClick={handleRemove}
              disabled={removing}
              className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 hover:bg-red-600 text-white rounded-full flex items-center justify-center transition-colors disabled:opacity-50"
              title="Remove logo"
            >
              {removing ? <Loader2 size={10} className="animate-spin" /> : <X size={10} />}
            </button>
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            {!pendingFile ? (
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg transition-colors"
              >
                <Upload size={13} />
                {currentLogoUrl ? 'Replace Logo' : 'Upload Logo'}
              </button>
            ) : (
              <>
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={uploading}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-60"
                >
                  {uploading ? <Loader2 size={13} className="animate-spin" /> : null}
                  {uploading ? `Saving… ${progress}%` : 'Save Logo'}
                </button>
                <button
                  type="button"
                  onClick={handleCancel}
                  disabled={uploading}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
              </>
            )}
          </div>
          <p className="text-xs text-zinc-500 mt-1.5">
            JPG, PNG, or WebP &mdash; max 2 MB. Square or landscape format recommended.
          </p>
          {error && <p className="text-xs text-red-400 mt-1">{error}</p>}
          {uploading && (
            <div className="mt-2 w-full max-w-xs bg-zinc-700 rounded-full h-1.5 overflow-hidden">
              <div
                className="h-full bg-blue-500 rounded-full transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
          )}
        </div>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        onChange={handleFileSelect}
        className="hidden"
      />
    </div>
  );
}
