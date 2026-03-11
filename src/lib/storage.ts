import { supabase } from './supabase';

export const ACCEPTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
export const ACCEPTED_SERVICE_RECORD_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
export const MAX_PROFILE_SIZE = 5 * 1024 * 1024;
export const MAX_GALLERY_SIZE = 8 * 1024 * 1024;
export const MAX_LOGO_SIZE = 2 * 1024 * 1024;
export const MAX_SERVICE_RECORD_SIZE = 20 * 1024 * 1024;

export function validateImageFile(file: File, maxBytes: number): string | null {
  if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
    return `${file.name} is not a supported image format. Use JPG, PNG, WebP, or GIF.`;
  }
  if (file.size > maxBytes) {
    return `${file.name} exceeds the ${Math.round(maxBytes / 1024 / 1024)} MB size limit.`;
  }
  return null;
}

export function getPublicUrl(bucket: string, path: string): string {
  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  return data.publicUrl;
}

export async function uploadProviderProfileImage(
  providerId: string,
  file: File,
  onProgress?: (pct: number) => void
): Promise<{ url: string; error: null } | { url: null; error: string }> {
  const validationError = validateImageFile(file, MAX_PROFILE_SIZE);
  if (validationError) return { url: null, error: validationError };

  const ext = file.name.split('.').pop() ?? 'jpg';
  const path = `${providerId}/profile.${ext}`;

  onProgress?.(10);

  const { error } = await supabase.storage
    .from('provider-profiles')
    .upload(path, file, { upsert: true, contentType: file.type });

  if (error) return { url: null, error: error.message };

  onProgress?.(100);

  const url = getPublicUrl('provider-profiles', path);
  return { url, error: null };
}

export async function uploadProviderGalleryImage(
  providerId: string,
  file: File,
  onProgress?: (pct: number) => void
): Promise<{ url: string; path: string; error: null } | { url: null; path: null; error: string }> {
  const validationError = validateImageFile(file, MAX_GALLERY_SIZE);
  if (validationError) return { url: null, path: null, error: validationError };

  const ext = file.name.split('.').pop() ?? 'jpg';
  const ts = Date.now();
  const rand = Math.random().toString(36).slice(2, 7);
  const path = `${providerId}/${ts}-${rand}.${ext}`;

  onProgress?.(10);

  const { error } = await supabase.storage
    .from('provider-gallery')
    .upload(path, file, { upsert: false, contentType: file.type });

  if (error) return { url: null, path: null, error: error.message };

  onProgress?.(100);

  const url = getPublicUrl('provider-gallery', path);
  return { url, path, error: null };
}

export async function uploadVehiclePhoto(
  userId: string,
  vehicleId: string,
  file: File
): Promise<{ url: string; path: string; error: null } | { url: null; path: null; error: string }> {
  const validationError = validateImageFile(file, MAX_GALLERY_SIZE);
  if (validationError) return { url: null, path: null, error: validationError };

  const ext = file.name.split('.').pop() ?? 'jpg';
  const ts = Date.now();
  const rand = Math.random().toString(36).slice(2, 7);
  const path = `${userId}/${vehicleId}/${ts}-${rand}.${ext}`;

  const { error } = await supabase.storage
    .from('vehicle-photos')
    .upload(path, file, { upsert: false, contentType: file.type });

  if (error) return { url: null, path: null, error: error.message };

  const url = getPublicUrl('vehicle-photos', path);
  return { url, path, error: null };
}

export function validateServiceRecordFile(file: File): string | null {
  if (!ACCEPTED_SERVICE_RECORD_TYPES.includes(file.type)) {
    return `${file.name} is not supported. Use PDF, JPG, PNG, or WebP.`;
  }
  if (file.size > MAX_SERVICE_RECORD_SIZE) {
    return `${file.name} exceeds the 20 MB size limit.`;
  }
  return null;
}

export async function uploadProviderLogo(
  providerId: string,
  file: File,
  onProgress?: (pct: number) => void
): Promise<{ url: string; path: string; error: null } | { url: null; path: null; error: string }> {
  const validationError = validateImageFile(file, MAX_LOGO_SIZE);
  if (validationError) return { url: null, path: null, error: validationError };

  const ext = file.name.split('.').pop() ?? 'jpg';
  const path = `${providerId}/logo.${ext}`;

  onProgress?.(10);

  const { error } = await supabase.storage
    .from('provider-logos')
    .upload(path, file, { upsert: true, contentType: file.type });

  if (error) return { url: null, path: null, error: error.message };

  onProgress?.(100);

  const url = getPublicUrl('provider-logos', path);
  return { url, path, error: null };
}

export async function uploadServiceRecordFile(
  userId: string,
  recordId: string,
  file: File,
  onProgress?: (pct: number) => void
): Promise<{ url: string; path: string; error: null } | { url: null; path: null; error: string }> {
  const validationError = validateServiceRecordFile(file);
  if (validationError) return { url: null, path: null, error: validationError };

  const ext = file.name.split('.').pop() ?? 'pdf';
  const ts = Date.now();
  const rand = Math.random().toString(36).slice(2, 7);
  const path = `${userId}/${recordId}/${ts}-${rand}.${ext}`;

  onProgress?.(10);

  const { error } = await supabase.storage
    .from('service-records')
    .upload(path, file, { upsert: false, contentType: file.type });

  if (error) return { url: null, path: null, error: error.message };

  onProgress?.(80);

  const { data: signedData, error: signErr } = await supabase.storage
    .from('service-records')
    .createSignedUrl(path, 60 * 60 * 24 * 365);

  onProgress?.(100);

  if (signErr || !signedData) {
    return { url: null, path: null, error: 'Uploaded but could not generate file URL.' };
  }

  return { url: signedData.signedUrl, path, error: null };
}

export async function getServiceRecordSignedUrl(path: string, expiresInSeconds = 3600): Promise<string | null> {
  const { data, error } = await supabase.storage
    .from('service-records')
    .createSignedUrl(path, expiresInSeconds);
  if (error || !data) return null;
  return data.signedUrl;
}

export async function deleteStorageFile(bucket: string, path: string): Promise<void> {
  await supabase.storage.from(bucket).remove([path]);
}

export function storagePathFromUrl(url: string, bucket: string): string | null {
  try {
    const parsed = new URL(url);
    const marker = `/storage/v1/object/public/${bucket}/`;
    const idx = parsed.pathname.indexOf(marker);
    if (idx === -1) return null;
    return decodeURIComponent(parsed.pathname.slice(idx + marker.length));
  } catch {
    return null;
  }
}
