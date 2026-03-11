import React, { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Trash2, Eye, EyeOff, ArrowUp, ArrowDown, Images, AlertCircle } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { storagePathFromUrl, deleteStorageFile } from '../../lib/storage';
import type { ProviderGalleryImage } from '../../lib/database.types';
import { useAuth } from '../../contexts/AuthContext';
import { EmptyState } from '../../components/ui/EmptyState';
import { GalleryUpload } from '../../components/ui/GalleryUpload';

export function GalleryPage() {
  const { user } = useAuth();
  const [providerId, setProviderId] = useState<string | null>(null);
  const [images, setImages] = useState<ProviderGalleryImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [providerNotFound, setProviderNotFound] = useState(false);
  const [showUploader, setShowUploader] = useState(false);

  const fetchImages = useCallback(async (pid: string) => {
    const { data } = await supabase
      .from('provider_gallery_images')
      .select('*')
      .eq('provider_id', pid)
      .order('sort_order')
      .order('created_at');
    setImages(data ?? []);
  }, []);

  useEffect(() => {
    if (!user) return;
    supabase
      .from('providers')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (!data) { setProviderNotFound(true); setLoading(false); return; }
        setProviderId(data.id);
        fetchImages(data.id).then(() => setLoading(false));
      });
  }, [user, fetchImages]);

  const handleImagesReady = async (uploads: { url: string; caption: string }[]) => {
    if (!providerId) return;
    const maxSort = images.length > 0 ? Math.max(...images.map((i) => i.sort_order)) : -1;
    const rows = uploads.map((u, i) => ({
      provider_id: providerId,
      image_url: u.url,
      caption: u.caption || null,
      sort_order: maxSort + 1 + i,
      is_active: true,
    }));
    await supabase.from('provider_gallery_images').insert(rows);
    setShowUploader(false);
    fetchImages(providerId);
  };

  const handleToggleActive = async (img: ProviderGalleryImage) => {
    await supabase.from('provider_gallery_images').update({ is_active: !img.is_active }).eq('id', img.id);
    setImages((prev) => prev.map((i) => i.id === img.id ? { ...i, is_active: !img.is_active } : i));
  };

  const handleDelete = async (img: ProviderGalleryImage) => {
    if (!confirm('Remove this image from your gallery?')) return;
    const path = storagePathFromUrl(img.image_url, 'provider-gallery');
    if (path) await deleteStorageFile('provider-gallery', path);
    await supabase.from('provider_gallery_images').delete().eq('id', img.id);
    setImages((prev) => prev.filter((i) => i.id !== img.id));
  };

  const handleMove = async (img: ProviderGalleryImage, direction: 'up' | 'down') => {
    const idx = images.findIndex((i) => i.id === img.id);
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= images.length) return;

    const swapImg = images[swapIdx];
    const newImages = [...images];
    newImages[idx] = { ...img, sort_order: swapImg.sort_order };
    newImages[swapIdx] = { ...swapImg, sort_order: img.sort_order };
    newImages.sort((a, b) => a.sort_order - b.sort_order);
    setImages(newImages);

    await Promise.all([
      supabase.from('provider_gallery_images').update({ sort_order: swapImg.sort_order }).eq('id', img.id),
      supabase.from('provider_gallery_images').update({ sort_order: img.sort_order }).eq('id', swapImg.id),
    ]);
  };

  const handleCaptionUpdate = async (img: ProviderGalleryImage, caption: string) => {
    await supabase.from('provider_gallery_images').update({ caption: caption || null }).eq('id', img.id);
    setImages((prev) => prev.map((i) => i.id === img.id ? { ...i, caption: caption || null } : i));
  };

  if (loading) return (
    <div className="h-48 flex items-center justify-center">
      <div className="w-6 h-6 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  if (providerNotFound) return (
    <EmptyState
      icon={<AlertCircle size={24} />}
      title="No provider profile found"
      description="Complete your business profile setup before managing your gallery."
    />
  );

  const activeCount = images.filter((i) => i.is_active).length;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-xl font-bold text-zinc-100">Gallery</h2>
          <p className="text-sm text-zinc-500 mt-1">
            {images.length === 0
              ? 'Add portfolio photos to showcase your work. These appear on your public profile.'
              : `${images.length} image${images.length !== 1 ? 's' : ''} · ${activeCount} visible on your profile`}
          </p>
        </div>
        {!showUploader && (
          <button
            onClick={() => setShowUploader(true)}
            className="inline-flex items-center gap-1.5 text-sm font-medium px-4 py-2 rounded-xl bg-blue-600 text-white hover:bg-blue-700 transition-colors"
          >
            <Plus size={14} /> Add Photos
          </button>
        )}
      </div>

      {/* Upload panel */}
      <AnimatePresence>
        {showUploader && providerId && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="bg-zinc-900 rounded-2xl border border-zinc-800 shadow-sm p-6"
          >
            <h3 className="font-semibold text-zinc-100 mb-4">Upload Photos</h3>
            <GalleryUpload
              providerId={providerId}
              onImagesReady={handleImagesReady}
              onCancel={() => setShowUploader(false)}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Gallery grid */}
      {images.length === 0 && !showUploader ? (
        <EmptyState
          icon={<Images size={24} />}
          title="No gallery images yet"
          description="Add portfolio photos to help potential customers see your work quality."
          action={
            <button
              onClick={() => setShowUploader(true)}
              className="inline-flex items-center gap-1.5 text-sm font-medium px-4 py-2 rounded-xl bg-blue-600 text-white hover:bg-blue-700 transition-colors mt-3"
            >
              <Plus size={14} /> Upload Photos
            </button>
          }
        />
      ) : (
        <div className="grid gap-3">
          {images.map((img, idx) => (
            <motion.div
              key={img.id}
              layout
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className={`bg-zinc-900 rounded-2xl border shadow-sm p-4 flex gap-4 ${!img.is_active ? 'opacity-60' : ''} border-zinc-800`}
            >
              <img
                src={img.image_url}
                alt={img.caption ?? ''}
                className="w-24 h-20 object-cover rounded-xl border border-zinc-800 shrink-0"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = 'https://images.pexels.com/photos/3807517/pexels-photo-3807517.jpeg?auto=compress&cs=tinysrgb&w=200';
                }}
              />
              <div className="flex-1 min-w-0 space-y-1.5">
                <CaptionEditor
                  value={img.caption ?? ''}
                  onSave={(v) => handleCaptionUpdate(img, v)}
                />
                <div className="flex items-center gap-2 text-xs">
                  {img.is_active ? (
                    <span className="text-emerald-400 font-medium flex items-center gap-1">
                      <Eye size={11} /> Visible on profile
                    </span>
                  ) : (
                    <span className="text-zinc-500 flex items-center gap-1">
                      <EyeOff size={11} /> Hidden
                    </span>
                  )}
                  <span className="text-zinc-700">·</span>
                  <span className="text-zinc-500">Position {idx + 1} of {images.length}</span>
                </div>
              </div>

              {/* Controls */}
              <div className="flex flex-col gap-1.5 shrink-0">
                <button
                  onClick={() => handleMove(img, 'up')}
                  disabled={idx === 0}
                  title="Move up"
                  className="p-1.5 rounded-lg hover:bg-zinc-800 disabled:opacity-25 transition-colors"
                >
                  <ArrowUp size={13} className="text-zinc-500" />
                </button>
                <button
                  onClick={() => handleMove(img, 'down')}
                  disabled={idx === images.length - 1}
                  title="Move down"
                  className="p-1.5 rounded-lg hover:bg-zinc-800 disabled:opacity-25 transition-colors"
                >
                  <ArrowDown size={13} className="text-zinc-500" />
                </button>
                <button
                  onClick={() => handleToggleActive(img)}
                  title={img.is_active ? 'Hide from profile' : 'Show on profile'}
                  className="p-1.5 rounded-lg hover:bg-zinc-800 transition-colors"
                >
                  {img.is_active
                    ? <EyeOff size={13} className="text-zinc-500" />
                    : <Eye size={13} className="text-blue-400" />}
                </button>
                <button
                  onClick={() => handleDelete(img)}
                  title="Remove image"
                  className="p-1.5 rounded-lg hover:bg-red-950/50 transition-colors"
                >
                  <Trash2 size={13} className="text-red-400" />
                </button>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}

function CaptionEditor({ value, onSave }: { value: string; onSave: (v: string) => void }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);

  const commit = () => {
    setEditing(false);
    if (draft !== value) onSave(draft);
  };

  if (editing) {
    return (
      <input
        autoFocus
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') commit();
          if (e.key === 'Escape') { setDraft(value); setEditing(false); }
        }}
        placeholder="Add a caption..."
        className="text-sm text-zinc-300 border-b border-blue-400 focus:outline-none bg-transparent w-full"
      />
    );
  }

  return (
    <button
      onClick={() => { setDraft(value); setEditing(true); }}
      className="text-sm text-left text-zinc-300 hover:text-blue-400 transition-colors w-full truncate block"
    >
      {value || <span className="text-zinc-500 italic">Click to add caption...</span>}
    </button>
  );
}
