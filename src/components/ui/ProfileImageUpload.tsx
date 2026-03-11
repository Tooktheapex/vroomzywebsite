import React, { useRef, useState, useCallback } from 'react';
import { Camera, X, Upload, Loader } from 'lucide-react';
import { uploadProviderProfileImage, storagePathFromUrl, deleteStorageFile } from '../../lib/storage';

interface ProfileImageUploadProps {
  providerId: string;
  currentUrl: string | null;
  onUploaded: (url: string) => void;
  onRemoved: () => void;
}

export function ProfileImageUpload({ providerId, currentUrl, onUploaded, onRemoved }: ProfileImageUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);

  const handleFile = useCallback(async (file: File) => {
    setError(null);
    setUploading(true);
    setProgress(0);

    const localPreview = URL.createObjectURL(file);
    setPreview(localPreview);

    const result = await uploadProviderProfileImage(providerId, file, setProgress);

    setUploading(false);
    URL.revokeObjectURL(localPreview);
    setPreview(null);

    if (result.error) {
      setError(result.error);
      return;
    }
    onUploaded(result.url);
  }, [providerId, onUploaded]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    e.target.value = '';
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  };

  const handleRemove = async () => {
    if (!currentUrl) return;
    const path = storagePathFromUrl(currentUrl, 'provider-profiles');
    if (path) await deleteStorageFile('provider-profiles', path);
    onRemoved();
  };

  const displayUrl = preview ?? currentUrl;

  return (
    <div className="flex flex-col gap-3">
      <label className="text-sm font-medium text-zinc-300">Profile / Business Photo</label>

      <div
        className={`relative flex items-center gap-5 p-4 rounded-2xl border-2 transition-all ${
          dragging ? 'border-blue-400 bg-blue-900/40' : 'border-dashed border-zinc-700 hover:border-zinc-600 bg-zinc-900'
        }`}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
      >
        {/* Thumbnail */}
        <div className="w-20 h-20 rounded-xl overflow-hidden shrink-0 border border-zinc-700 bg-zinc-800 flex items-center justify-center">
          {displayUrl ? (
            <img
              src={displayUrl}
              alt="Profile preview"
              className="w-full h-full object-cover"
            />
          ) : (
            <Camera size={24} className="text-zinc-600" />
          )}
          {uploading && (
            <div className="absolute inset-0 bg-zinc-900/70 flex items-center justify-center">
              <Loader size={20} className="text-blue-400 animate-spin" />
            </div>
          )}
        </div>

        {/* Upload progress bar */}
        {uploading && (
          <div className="absolute inset-x-4 bottom-2 h-1 bg-zinc-700 rounded-full overflow-hidden">
            <div
              className="h-full bg-blue-500 rounded-full transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
        )}

        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-zinc-300 mb-0.5">
            {uploading ? `Uploading... ${progress}%` : displayUrl ? 'Replace photo' : 'Upload photo'}
          </p>
          <p className="text-xs text-zinc-500 mb-3">JPG, PNG, or WebP — max 5 MB</p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={uploading}
              onClick={() => inputRef.current?.click()}
              className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border border-zinc-700 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 transition-colors disabled:opacity-50"
            >
              <Upload size={12} /> Choose file
            </button>
            {displayUrl && !uploading && (
              <button
                type="button"
                onClick={handleRemove}
                className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border border-red-800 text-red-400 bg-zinc-900 hover:bg-red-950/50 transition-colors"
              >
                <X size={12} /> Remove
              </button>
            )}
          </div>
          <p className="text-xs text-zinc-500 mt-2">or drag and drop an image here</p>
        </div>
      </div>

      {error && (
        <p className="text-xs text-red-400 bg-red-950/50 border border-red-800 rounded-lg px-3 py-2">{error}</p>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        className="hidden"
        onChange={handleInputChange}
      />
    </div>
  );
}
