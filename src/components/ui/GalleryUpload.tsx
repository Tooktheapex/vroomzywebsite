import React, { useRef, useState, useCallback } from 'react';
import { Upload, X, Loader, AlertCircle } from 'lucide-react';
import { uploadProviderGalleryImage, MAX_GALLERY_SIZE, validateImageFile } from '../../lib/storage';

export interface PendingGalleryImage {
  id: string;
  file: File;
  previewUrl: string;
  caption: string;
  uploading: boolean;
  progress: number;
  error: string | null;
  uploadedUrl: string | null;
}

interface GalleryUploadProps {
  providerId: string;
  onImagesReady: (images: { url: string; caption: string }[]) => void;
  onCancel: () => void;
}

export function GalleryUpload({ providerId, onImagesReady, onCancel }: GalleryUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [pending, setPending] = useState<PendingGalleryImage[]>([]);
  const [globalError, setGlobalError] = useState<string | null>(null);
  const [uploadingAll, setUploadingAll] = useState(false);

  const addFiles = useCallback((files: File[]) => {
    setGlobalError(null);
    const valid: PendingGalleryImage[] = [];
    const errors: string[] = [];

    for (const file of files) {
      const err = validateImageFile(file, MAX_GALLERY_SIZE);
      if (err) { errors.push(err); continue; }
      valid.push({
        id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        file,
        previewUrl: URL.createObjectURL(file),
        caption: '',
        uploading: false,
        progress: 0,
        error: null,
        uploadedUrl: null,
      });
    }

    if (errors.length > 0) setGlobalError(errors.join(' '));
    setPending((prev) => [...prev, ...valid]);
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (files.length > 0) addFiles(files);
    e.target.value = '';
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const files = Array.from(e.dataTransfer.files).filter((f) => f.type.startsWith('image/'));
    if (files.length > 0) addFiles(files);
  };

  const removeItem = (id: string) => {
    setPending((prev) => {
      const item = prev.find((i) => i.id === id);
      if (item) URL.revokeObjectURL(item.previewUrl);
      return prev.filter((i) => i.id !== id);
    });
  };

  const updateCaption = (id: string, caption: string) => {
    setPending((prev) => prev.map((i) => i.id === id ? { ...i, caption } : i));
  };

  const handleUploadAll = async () => {
    const toUpload = pending.filter((i) => !i.uploadedUrl && !i.uploading);
    if (toUpload.length === 0) return;
    setUploadingAll(true);

    const updated = [...pending];

    for (const item of toUpload) {
      const idx = updated.findIndex((i) => i.id === item.id);
      updated[idx] = { ...updated[idx], uploading: true, error: null };
      setPending([...updated]);

      const result = await uploadProviderGalleryImage(
        providerId,
        item.file,
        (pct) => {
          updated[idx] = { ...updated[idx], progress: pct };
          setPending([...updated]);
        }
      );

      if (result.error) {
        updated[idx] = { ...updated[idx], uploading: false, error: result.error };
      } else {
        updated[idx] = { ...updated[idx], uploading: false, progress: 100, uploadedUrl: result.url, error: null };
      }
      setPending([...updated]);
    }

    setUploadingAll(false);

    const allDone = updated.filter((i) => i.uploadedUrl);
    if (allDone.length > 0) {
      onImagesReady(allDone.map((i) => ({ url: i.uploadedUrl!, caption: i.caption })));
      pending.forEach((i) => URL.revokeObjectURL(i.previewUrl));
      setPending([]);
    }
  };

  const readyCount = pending.filter((i) => i.uploadedUrl).length;
  const failedCount = pending.filter((i) => i.error).length;
  const pendingCount = pending.filter((i) => !i.uploadedUrl && !i.uploading).length;

  return (
    <div className="space-y-4">
      {/* Drop zone */}
      <div
        className={`rounded-2xl border-2 border-dashed p-8 text-center transition-all cursor-pointer ${
          dragging ? 'border-blue-400 bg-blue-900/40' : 'border-zinc-700 hover:border-zinc-600 bg-zinc-950'
        }`}
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
      >
        <Upload size={24} className="mx-auto text-zinc-500 mb-3" />
        <p className="text-sm font-medium text-zinc-300 mb-1">
          Drop images here or click to select
        </p>
        <p className="text-xs text-zinc-500">JPG, PNG, or WebP — max 8 MB each — multiple files supported</p>
      </div>

      {globalError && (
        <div className="flex gap-2 px-3 py-2 bg-red-950/50 border border-red-800 rounded-lg">
          <AlertCircle size={13} className="text-red-400 shrink-0 mt-0.5" />
          <p className="text-xs text-red-400">{globalError}</p>
        </div>
      )}

      {/* Pending images list */}
      {pending.length > 0 && (
        <div className="space-y-2">
          {pending.map((item) => (
            <div
              key={item.id}
              className={`flex gap-3 p-3 rounded-xl border ${item.error ? 'border-red-800 bg-red-950/50' : item.uploadedUrl ? 'border-emerald-800 bg-emerald-900/50' : 'border-zinc-800 bg-zinc-900'}`}
            >
              {/* Thumbnail */}
              <div className="relative w-14 h-14 rounded-lg overflow-hidden shrink-0 border border-zinc-700 bg-zinc-800">
                <img src={item.previewUrl} alt="" className="w-full h-full object-cover" />
                {item.uploading && (
                  <div className="absolute inset-0 bg-zinc-900/60 flex items-center justify-center">
                    <Loader size={14} className="text-blue-400 animate-spin" />
                  </div>
                )}
                {item.uploading && (
                  <div className="absolute inset-x-0 bottom-0 h-1 bg-zinc-700">
                    <div
                      className="h-full bg-blue-500 transition-all"
                      style={{ width: `${item.progress}%` }}
                    />
                  </div>
                )}
              </div>

              {/* Caption + status */}
              <div className="flex-1 min-w-0">
                <input
                  type="text"
                  placeholder="Caption (optional)"
                  value={item.caption}
                  onChange={(e) => updateCaption(item.id, e.target.value)}
                  disabled={item.uploading || !!item.uploadedUrl}
                  className="w-full text-xs px-2 py-1.5 rounded-lg border border-zinc-700 bg-zinc-800 text-zinc-300 focus:outline-none focus:ring-1 focus:ring-blue-400 disabled:bg-transparent disabled:border-transparent disabled:text-zinc-500"
                />
                {item.error && <p className="text-xs text-red-400 mt-1">{item.error}</p>}
                {item.uploadedUrl && <p className="text-xs text-emerald-400 font-medium mt-1">Uploaded</p>}
                {item.uploading && <p className="text-xs text-blue-400 mt-1">Uploading {item.progress}%...</p>}
                <p className="text-xs text-zinc-500 mt-0.5 truncate">{item.file.name} · {(item.file.size / 1024).toFixed(0)} KB</p>
              </div>

              {/* Remove */}
              {!item.uploading && !item.uploadedUrl && (
                <button
                  type="button"
                  onClick={() => removeItem(item.id)}
                  className="p-1.5 rounded-lg hover:bg-zinc-800 shrink-0 transition-colors"
                >
                  <X size={13} className="text-zinc-500" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Status summary */}
      {pending.length > 0 && (
        <div className="text-xs text-zinc-500">
          {readyCount > 0 && <span className="text-emerald-400 font-medium">{readyCount} uploaded </span>}
          {pendingCount > 0 && <span>{pendingCount} ready to upload </span>}
          {failedCount > 0 && <span className="text-red-400">{failedCount} failed </span>}
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="text-sm px-4 py-2 rounded-xl border border-zinc-700 text-zinc-400 hover:bg-zinc-800 transition-colors"
        >
          Cancel
        </button>
        {pending.filter((i) => !i.uploadedUrl && !i.uploading).length > 0 && (
          <button
            type="button"
            onClick={handleUploadAll}
            disabled={uploadingAll}
            className="text-sm px-4 py-2 rounded-xl bg-blue-600 text-white font-medium hover:bg-blue-700 disabled:opacity-60 transition-colors flex items-center gap-1.5"
          >
            {uploadingAll ? <><Loader size={13} className="animate-spin" /> Uploading...</> : `Upload ${pending.filter((i) => !i.uploadedUrl && !i.uploading).length} image${pending.filter((i) => !i.uploadedUrl && !i.uploading).length !== 1 ? 's' : ''}`}
          </button>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        multiple
        className="hidden"
        onChange={handleInputChange}
      />
    </div>
  );
}
