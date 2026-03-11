import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, DollarSign } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { ProfileImageUpload } from '../../components/ui/ProfileImageUpload';
import { LogoUpload } from '../../components/ui/LogoUpload';
import type { Provider, ServiceCategory } from '../../lib/database.types';

interface PriceRange {
  min: string;
  max: string;
}

export function ProviderSettingsPage() {
  const { profile, refreshProfile, user } = useAuth();
  const [fullName, setFullName] = useState(profile?.full_name ?? '');
  const [phone, setPhone] = useState(profile?.phone ?? '');
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  const [provider, setProvider] = useState<Provider | null>(null);
  const [photoSaved, setPhotoSaved] = useState(false);

  const [categories, setCategories] = useState<ServiceCategory[]>([]);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [servicePricing, setServicePricing] = useState<Record<string, PriceRange>>({});
  const [servicesSaving, setServicesSaving] = useState(false);
  const [servicesSuccess, setServicesSuccess] = useState(false);
  const [servicesError, setServicesError] = useState('');

  useEffect(() => {
    supabase.from('service_categories').select('*').order('label').then(({ data }) => {
      if (data) setCategories(data);
    });
  }, []);

  useEffect(() => {
    if (!user) return;
    supabase
      .from('providers')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle()
      .then(async ({ data }) => {
        setProvider(data ?? null);
        if (data) {
          const { data: ps } = await supabase
            .from('provider_services')
            .select('category_id, price_min, price_max')
            .eq('provider_id', data.id);

          setSelectedCategories(ps?.map((p) => p.category_id) ?? []);
          const pricing: Record<string, PriceRange> = {};
          ps?.forEach((p) => {
            pricing[p.category_id] = {
              min: p.price_min != null ? String(p.price_min) : '',
              max: p.price_max != null ? String(p.price_max) : '',
            };
          });
          setServicePricing(pricing);
        }
      });
  }, [user]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;
    setSaving(true);
    setError('');
    const { error: err } = await supabase
      .from('profiles')
      .update({ full_name: fullName, phone: phone || null })
      .eq('id', profile.id);
    setSaving(false);
    if (err) { setError(err.message); return; }
    await refreshProfile();
    setSuccess(true);
    setTimeout(() => setSuccess(false), 3000);
  };

  const handlePhotoUploaded = async (url: string) => {
    if (!provider) return;
    await supabase.from('providers').update({ profile_image_url: url }).eq('id', provider.id);
    setProvider((prev) => prev ? { ...prev, profile_image_url: url } : prev);
    setPhotoSaved(true);
    setTimeout(() => setPhotoSaved(false), 3000);
  };

  const handlePhotoRemoved = async () => {
    if (!provider) return;
    await supabase.from('providers').update({ profile_image_url: null }).eq('id', provider.id);
    setProvider((prev) => prev ? { ...prev, profile_image_url: null } : prev);
  };

  const handleLogoChange = (url: string | null, path: string | null) => {
    setProvider((prev) => prev ? { ...prev, logo_image_url: url, logo_storage_path: path } : prev);
  };

  const toggleCategory = (id: string) => {
    const next = selectedCategories.includes(id)
      ? selectedCategories.filter((c) => c !== id)
      : [...selectedCategories, id];
    if (!next.includes(id)) {
      setServicePricing((prev) => {
        const updated = { ...prev };
        delete updated[id];
        return updated;
      });
    }
    setSelectedCategories(next);
  };

  const updatePrice = (categoryId: string, field: 'min' | 'max', value: string) => {
    const cleaned = value.replace(/[^0-9]/g, '');
    setServicePricing((prev) => ({
      ...prev,
      [categoryId]: { ...prev[categoryId], [field]: cleaned },
    }));
  };

  const handleSaveServices = async () => {
    if (!provider) return;
    setServicesSaving(true);
    setServicesError('');

    await supabase.from('provider_services').delete().eq('provider_id', provider.id);
    if (selectedCategories.length > 0) {
      const { error: insertErr } = await supabase.from('provider_services').insert(
        selectedCategories.map((cid) => {
          const p = servicePricing[cid];
          const price_min = p?.min ? parseInt(p.min) : null;
          const price_max = p?.max ? parseInt(p.max) : null;
          return {
            provider_id: provider.id,
            category_id: cid,
            price_min: price_min != null && !isNaN(price_min) ? price_min : null,
            price_max: price_max != null && !isNaN(price_max) ? price_max : null,
          };
        })
      );
      if (insertErr) {
        setServicesError(insertErr.message);
        setServicesSaving(false);
        return;
      }
    }

    setServicesSaving(false);
    setServicesSuccess(true);
    setTimeout(() => setServicesSuccess(false), 3000);
  };

  const selectedCats = categories.filter((c) => selectedCategories.includes(c.id));

  return (
    <div className="space-y-8">
      {/* Account Settings */}
      <div>
        <div className="mb-6">
          <h2 className="text-xl font-bold text-zinc-100">Account Settings</h2>
          <p className="text-sm text-zinc-500">Update your personal account information.</p>
        </div>
        <div className="bg-zinc-900 rounded-2xl border border-zinc-800 shadow-sm p-6 max-w-lg">
          {success && (
            <div className="mb-4 px-4 py-3 bg-emerald-900/50 border border-emerald-800 text-emerald-400 text-sm rounded-xl">
              Saved successfully.
            </div>
          )}
          {error && (
            <div className="mb-4 px-4 py-3 bg-red-950/50 border border-red-800 text-red-400 text-sm rounded-xl">
              {error}
            </div>
          )}
          <form onSubmit={handleSave} className="space-y-4">
            <Input label="Full name" value={fullName} onChange={(e) => setFullName(e.target.value)} required />
            <Input label="Email" value={profile?.email ?? ''} disabled hint="Email cannot be changed here." />
            <Input label="Phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
            <Button type="submit" loading={saving}>Save Changes</Button>
          </form>
        </div>
      </div>

      {/* Services & Pricing */}
      {provider && (
        <div>
          <div className="mb-6">
            <h2 className="text-xl font-bold text-zinc-100">Services & Pricing</h2>
            <p className="text-sm text-zinc-500">Update the services you offer and set typical price ranges to help customers.</p>
          </div>
          <div className="bg-zinc-900 rounded-2xl border border-zinc-800 shadow-sm p-6">
            {servicesSuccess && (
              <div className="mb-4 px-4 py-3 bg-emerald-900/50 border border-emerald-800 text-emerald-400 text-sm rounded-xl flex items-center gap-2">
                <Check size={14} /> Services updated successfully.
              </div>
            )}
            {servicesError && (
              <div className="mb-4 px-4 py-3 bg-red-950/50 border border-red-800 text-red-400 text-sm rounded-xl">
                {servicesError}
              </div>
            )}

            <p className="text-sm font-medium text-zinc-300 mb-3">Select all services you offer</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 mb-6">
              {categories.map((cat) => {
                const selected = selectedCategories.includes(cat.id);
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => toggleCategory(cat.id)}
                    className={`flex items-center gap-2 p-3 rounded-xl border-2 text-sm font-medium transition-all ${
                      selected
                        ? 'border-blue-600 bg-blue-900/40 text-blue-400'
                        : 'border-zinc-700 hover:border-zinc-600 text-zinc-300'
                    }`}
                  >
                    <div className={`w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 ${selected ? 'bg-blue-600 border-blue-600' : 'border-zinc-600'}`}>
                      {selected && <Check size={10} className="text-white" />}
                    </div>
                    {cat.label}
                  </button>
                );
              })}
            </div>

            <AnimatePresence>
              {selectedCats.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  className="border border-zinc-800 rounded-xl overflow-hidden mb-6"
                >
                  <div className="px-4 py-3 bg-zinc-800/60 border-b border-zinc-800 flex items-center gap-2">
                    <DollarSign size={14} className="text-blue-400" />
                    <span className="text-sm font-semibold text-zinc-200">Typical Price Ranges</span>
                    <span className="text-xs text-zinc-500 ml-1">(optional)</span>
                  </div>
                  <div className="divide-y divide-zinc-800">
                    {selectedCats.map((cat) => {
                      const pricing = servicePricing[cat.id] ?? { min: '', max: '' };
                      return (
                        <div key={cat.id} className="px-4 py-3 flex items-center gap-4">
                          <span className="text-sm font-medium text-zinc-300 w-36 shrink-0">{cat.label}</span>
                          <div className="flex items-center gap-2 flex-1">
                            <div className="relative flex-1">
                              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 text-sm">$</span>
                              <input
                                type="text"
                                inputMode="numeric"
                                placeholder="Min"
                                value={pricing.min}
                                onChange={(e) => updatePrice(cat.id, 'min', e.target.value)}
                                className="w-full pl-7 pr-3 py-2 rounded-lg border border-zinc-700 bg-zinc-800 text-zinc-100 text-sm placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                              />
                            </div>
                            <span className="text-zinc-600 text-sm shrink-0">—</span>
                            <div className="relative flex-1">
                              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 text-sm">$</span>
                              <input
                                type="text"
                                inputMode="numeric"
                                placeholder="Max"
                                value={pricing.max}
                                onChange={(e) => updatePrice(cat.id, 'max', e.target.value)}
                                className="w-full pl-7 pr-3 py-2 rounded-lg border border-zinc-700 bg-zinc-800 text-zinc-100 text-sm placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                              />
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <Button onClick={handleSaveServices} loading={servicesSaving}>
              Save Services & Pricing
            </Button>
          </div>
        </div>
      )}

      {/* Business Logo */}
      <div>
        <div className="mb-6">
          <h2 className="text-xl font-bold text-zinc-100">Business Logo</h2>
          <p className="text-sm text-zinc-500">
            Your logo appears on your public listing, provider cards, and admin reviews. Distinct from your profile/gallery photos.
          </p>
        </div>

        {provider ? (
          <div className="bg-zinc-900 rounded-2xl border border-zinc-800 shadow-sm p-6 max-w-lg">
            <LogoUpload
              providerId={provider.id}
              currentLogoUrl={provider.logo_image_url ?? null}
              currentLogoPath={provider.logo_storage_path ?? null}
              onLogoChange={handleLogoChange}
            />
          </div>
        ) : (
          <div className="bg-zinc-900 rounded-2xl border border-zinc-800 shadow-sm p-6 max-w-lg">
            <p className="text-sm text-zinc-500">
              Complete your <a href="/provider/onboarding" className="text-blue-400 hover:underline">business profile</a> first to upload a logo.
            </p>
          </div>
        )}
      </div>

      {/* Business Profile Photo */}
      <div>
        <div className="mb-6">
          <h2 className="text-xl font-bold text-zinc-100">Business Profile Photo</h2>
          <p className="text-sm text-zinc-500">
            A representative photo of your work or business shown on your public listing.
          </p>
        </div>

        {provider ? (
          <div className="bg-zinc-900 rounded-2xl border border-zinc-800 shadow-sm p-6 max-w-lg">
            {photoSaved && (
              <div className="mb-4 px-4 py-3 bg-emerald-900/50 border border-emerald-800 text-emerald-400 text-sm rounded-xl">
                Photo updated successfully.
              </div>
            )}

            {provider.profile_image_url && (
              <div className="mb-5 flex items-center gap-4 p-4 bg-zinc-950 rounded-xl border border-zinc-800">
                <img
                  src={provider.profile_image_url}
                  alt={provider.business_name ?? 'Business photo'}
                  className="w-16 h-16 rounded-xl object-cover border border-zinc-800 shrink-0"
                />
                <div>
                  <p className="text-sm font-medium text-zinc-200">{provider.business_name}</p>
                  <p className="text-xs text-zinc-500 mt-0.5">Current profile photo</p>
                </div>
              </div>
            )}

            <ProfileImageUpload
              providerId={provider.id}
              currentUrl={provider.profile_image_url ?? null}
              onUploaded={handlePhotoUploaded}
              onRemoved={handlePhotoRemoved}
            />

            <p className="mt-3 text-xs text-zinc-500">
              Recommended: square image, at least 400×400px. Supported formats: JPG, PNG, WebP.
            </p>
          </div>
        ) : (
          <div className="bg-zinc-900 rounded-2xl border border-zinc-800 shadow-sm p-6 max-w-lg">
            <p className="text-sm text-zinc-500">
              Complete your <a href="/provider/onboarding" className="text-blue-400 hover:underline">business profile</a> first to upload a photo.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
