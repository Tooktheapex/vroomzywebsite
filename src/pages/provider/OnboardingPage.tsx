import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, ChevronRight, ChevronLeft, Send, DollarSign } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import type { ServiceCategory, Provider } from '../../lib/database.types';
import { useAuth } from '../../contexts/AuthContext';
import { Input, TextArea, Select } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { ProfileImageUpload } from '../../components/ui/ProfileImageUpload';

const US_STATES = [
  'AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA',
  'KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ',
  'NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT',
  'VA','WA','WV','WI','WY',
];

interface PriceRange {
  min: string;
  max: string;
}

interface FormState {
  business_name: string;
  contact_name: string;
  phone: string;
  email: string;
  website: string;
  instagram: string;
  description: string;
  profile_image_url: string;
  mobile_service: boolean;
  street_address: string;
  city: string;
  state: string;
  zip_code: string;
  service_radius_miles: string;
  selectedCategories: string[];
  servicePricing: Record<string, PriceRange>;
}

const emptyForm: FormState = {
  business_name: '',
  contact_name: '',
  phone: '',
  email: '',
  website: '',
  instagram: '',
  description: '',
  profile_image_url: '',
  mobile_service: false,
  street_address: '',
  city: '',
  state: '',
  zip_code: '',
  service_radius_miles: '25',
  selectedCategories: [],
  servicePricing: {},
};

const STEPS = ['Business Info', 'Services', 'Location', 'Review & Submit'];

export function OnboardingPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [categories, setCategories] = useState<ServiceCategory[]>([]);
  const [existingProvider, setExistingProvider] = useState<Provider | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    supabase.from('service_categories').select('*').order('label').then(({ data }) => {
      if (data) setCategories(data);
    });
  }, []);

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      const { data: prov } = await supabase.from('providers').select('*').eq('user_id', user.id).maybeSingle();
      if (prov) {
        setExistingProvider(prov);
        const { data: ps } = await supabase
          .from('provider_services')
          .select('category_id, price_min, price_max')
          .eq('provider_id', prov.id);

        const pricing: Record<string, PriceRange> = {};
        ps?.forEach((p) => {
          pricing[p.category_id] = {
            min: p.price_min != null ? String(p.price_min) : '',
            max: p.price_max != null ? String(p.price_max) : '',
          };
        });

        setForm({
          business_name: prov.business_name ?? '',
          contact_name: prov.contact_name ?? '',
          phone: prov.phone ?? '',
          email: prov.email ?? '',
          website: prov.website ?? '',
          instagram: prov.instagram ?? '',
          description: prov.description ?? '',
          profile_image_url: prov.profile_image_url ?? '',
          mobile_service: prov.mobile_service ?? false,
          street_address: prov.street_address ?? '',
          city: prov.city ?? '',
          state: prov.state ?? '',
          zip_code: prov.zip_code ?? '',
          service_radius_miles: String(prov.service_radius_miles ?? 25),
          selectedCategories: ps?.map((p) => p.category_id) ?? [],
          servicePricing: pricing,
        });
      }
    };
    load();
  }, [user]);

  const saveAsDraft = async (): Promise<string | null> => {
    if (!user) return null;
    const payload = {
      user_id: user.id,
      business_name: form.business_name || 'My Business',
      contact_name: form.contact_name || null,
      phone: form.phone || null,
      email: form.email || null,
      website: form.website || null,
      instagram: form.instagram || null,
      description: form.description || null,
      profile_image_url: form.profile_image_url || null,
      mobile_service: form.mobile_service,
      street_address: form.street_address || null,
      city: form.city || null,
      state: form.state || null,
      zip_code: form.zip_code || null,
      service_radius_miles: form.service_radius_miles ? parseInt(form.service_radius_miles) : 0,
      status: 'draft' as const,
    };

    if (existingProvider) {
      const { error: err } = await supabase.from('providers').update(payload).eq('id', existingProvider.id);
      if (err) return err.message;
      await syncCategories(existingProvider.id);
      return null;
    } else {
      const { data, error: err } = await supabase.from('providers').insert(payload).select().single();
      if (err) return err.message;
      if (data) {
        setExistingProvider(data);
        await syncCategories(data.id);
      }
      return null;
    }
  };

  const syncCategories = async (providerId: string) => {
    await supabase.from('provider_services').delete().eq('provider_id', providerId);
    if (form.selectedCategories.length > 0) {
      await supabase.from('provider_services').insert(
        form.selectedCategories.map((cid) => {
          const pricing = form.servicePricing[cid];
          const price_min = pricing?.min ? parseInt(pricing.min) : null;
          const price_max = pricing?.max ? parseInt(pricing.max) : null;
          return {
            provider_id: providerId,
            category_id: cid,
            price_min: price_min != null && !isNaN(price_min) ? price_min : null,
            price_max: price_max != null && !isNaN(price_max) ? price_max : null,
          };
        })
      );
    }
  };

  const handleNext = async () => {
    setError('');
    if (step === 0 && !form.business_name) { setError('Business name is required.'); return; }
    if (step === 1 && form.selectedCategories.length === 0) { setError('Select at least one service category.'); return; }

    setSaving(true);
    const err = await saveAsDraft();
    setSaving(false);
    if (err) { setError(err); return; }
    setStep((s) => s + 1);
  };

  const handleSubmitForReview = async () => {
    if (!user || !existingProvider) return;
    setError('');
    setSaving(true);

    const err = await saveAsDraft();
    if (err) { setError(err); setSaving(false); return; }

    const { error: submitErr } = await supabase
      .from('providers')
      .update({ status: 'pending_approval' })
      .eq('id', existingProvider.id);

    setSaving(false);
    if (submitErr) { setError(submitErr.message); return; }
    setSuccess(true);
    setTimeout(() => navigate('/provider'), 2000);
  };

  if (success) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 rounded-full bg-emerald-900/50 flex items-center justify-center mx-auto mb-4">
            <Check size={28} className="text-emerald-400" />
          </div>
          <h2 className="text-2xl font-bold text-zinc-100 mb-2">Submitted for review!</h2>
          <p className="text-zinc-500">Our team will review your listing and approve it shortly.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950">
      <div className="max-w-2xl mx-auto px-4 py-10">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-zinc-100 mb-1">Business Profile</h1>
          <p className="text-sm text-zinc-500">Complete your listing to start receiving leads.</p>
        </div>

        <div className="flex items-center gap-2 mb-8">
          {STEPS.map((label, i) => (
            <React.Fragment key={label}>
              <div className={`flex items-center gap-2 ${i <= step ? 'text-blue-400' : 'text-zinc-500'}`}>
                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-colors ${
                  i < step ? 'bg-blue-600 border-blue-600 text-white' :
                  i === step ? 'border-blue-400 text-blue-400' :
                  'border-zinc-700 text-zinc-500'
                }`}>
                  {i < step ? <Check size={12} /> : i + 1}
                </div>
                <span className="hidden sm:block text-xs font-medium">{label}</span>
              </div>
              {i < STEPS.length - 1 && (
                <div className={`flex-1 h-0.5 ${i < step ? 'bg-blue-600' : 'bg-zinc-800'}`} />
              )}
            </React.Fragment>
          ))}
        </div>

        {error && <div className="mb-5 px-4 py-3 bg-red-950/50 border border-red-800 text-red-400 text-sm rounded-xl">{error}</div>}

        <motion.div
          key={step}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.2 }}
          className="bg-zinc-900 rounded-2xl border border-zinc-800 shadow-sm p-6 mb-6"
        >
          {step === 0 && <Step1BusinessInfo form={form} setForm={setForm} existingProviderId={existingProvider?.id ?? null} />}
          {step === 1 && <Step2Services form={form} setForm={setForm} categories={categories} />}
          {step === 2 && <Step3Location form={form} setForm={setForm} />}
          {step === 3 && <Step4Review form={form} categories={categories} />}
        </motion.div>

        <div className="flex justify-between">
          {step > 0 ? (
            <Button variant="ghost" onClick={() => setStep((s) => s - 1)}>
              <ChevronLeft size={16} /> Back
            </Button>
          ) : <div />}

          {step < STEPS.length - 1 ? (
            <Button onClick={handleNext} loading={saving}>
              Save & Continue <ChevronRight size={16} />
            </Button>
          ) : (
            <Button onClick={handleSubmitForReview} loading={saving}>
              <Send size={16} /> Submit for Review
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

function Step1BusinessInfo({
  form,
  setForm,
  existingProviderId,
}: {
  form: FormState;
  setForm: React.Dispatch<React.SetStateAction<FormState>>;
  existingProviderId: string | null;
}) {
  const handleProfileUploaded = async (url: string) => {
    setForm((prev) => ({ ...prev, profile_image_url: url }));
    if (existingProviderId) {
      await supabase.from('providers').update({ profile_image_url: url }).eq('id', existingProviderId);
    }
  };

  const handleProfileRemoved = async () => {
    setForm((prev) => ({ ...prev, profile_image_url: '' }));
    if (existingProviderId) {
      await supabase.from('providers').update({ profile_image_url: null }).eq('id', existingProviderId);
    }
  };

  return (
    <div className="space-y-4">
      <h2 className="font-bold text-zinc-100 mb-4">Business Information</h2>
      <Input label="Business name *" value={form.business_name} onChange={(e) => setForm({ ...form, business_name: e.target.value })} required />
      <Input label="Contact name" value={form.contact_name} onChange={(e) => setForm({ ...form, contact_name: e.target.value })} placeholder="Owner or manager name" />
      <div className="grid grid-cols-2 gap-3">
        <Input label="Phone" type="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
        <Input label="Business email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Input label="Website" type="url" placeholder="https://" value={form.website} onChange={(e) => setForm({ ...form, website: e.target.value })} />
        <Input label="Instagram" placeholder="@yourbusiness" value={form.instagram} onChange={(e) => setForm({ ...form, instagram: e.target.value })} />
      </div>
      <TextArea label="Business description" placeholder="Describe your business, specialties, and experience..." value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={4} />

      {existingProviderId ? (
        <ProfileImageUpload
          providerId={existingProviderId}
          currentUrl={form.profile_image_url || null}
          onUploaded={handleProfileUploaded}
          onRemoved={handleProfileRemoved}
        />
      ) : (
        <div className="p-4 bg-zinc-950 border border-zinc-800 rounded-xl text-sm text-zinc-500">
          Save your business name and continue to unlock profile photo upload.
        </div>
      )}
    </div>
  );
}

function Step2Services({ form, setForm, categories }: {
  form: FormState;
  setForm: React.Dispatch<React.SetStateAction<FormState>>;
  categories: ServiceCategory[];
}) {
  const toggle = (id: string) => {
    const existing = form.selectedCategories;
    const newSelected = existing.includes(id) ? existing.filter((c) => c !== id) : [...existing, id];
    const newPricing = { ...form.servicePricing };
    if (!newSelected.includes(id)) {
      delete newPricing[id];
    }
    setForm({ ...form, selectedCategories: newSelected, servicePricing: newPricing });
  };

  const updatePrice = (categoryId: string, field: 'min' | 'max', value: string) => {
    const cleaned = value.replace(/[^0-9]/g, '');
    setForm((prev) => ({
      ...prev,
      servicePricing: {
        ...prev.servicePricing,
        [categoryId]: {
          ...prev.servicePricing[categoryId],
          [field]: cleaned,
        },
      },
    }));
  };

  const selectedCats = categories.filter((c) => form.selectedCategories.includes(c.id));

  return (
    <div>
      <h2 className="font-bold text-zinc-100 mb-1">Services Offered *</h2>
      <p className="text-sm text-zinc-500 mb-5">Select all that apply to your business.</p>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 mb-6">
        {categories.map((cat) => {
          const selected = form.selectedCategories.includes(cat.id);
          return (
            <button
              key={cat.id}
              type="button"
              onClick={() => toggle(cat.id)}
              className={`flex items-center gap-2 p-3 rounded-xl border-2 text-sm font-medium transition-all ${
                selected ? 'border-blue-600 bg-blue-900/40 text-blue-400' : 'border-zinc-700 hover:border-zinc-600 text-zinc-300'
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
              <span className="text-xs text-zinc-500 ml-1">(optional — helps customers know what to expect)</span>
            </div>
            <div className="divide-y divide-zinc-800">
              {selectedCats.map((cat) => {
                const pricing = form.servicePricing[cat.id] ?? { min: '', max: '' };
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

      <div className="pt-4 border-t border-zinc-900">
        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={form.mobile_service}
            onChange={(e) => setForm({ ...form, mobile_service: e.target.checked })}
            className="w-4 h-4 rounded accent-blue-600"
          />
          <div>
            <span className="text-sm font-medium text-zinc-200">Offer mobile / on-site service</span>
            <p className="text-xs text-zinc-500">You travel to the customer's location</p>
          </div>
        </label>
      </div>
    </div>
  );
}

function Step3Location({ form, setForm }: { form: FormState; setForm: React.Dispatch<React.SetStateAction<FormState>> }) {
  return (
    <div className="space-y-4">
      <h2 className="font-bold text-zinc-100 mb-4">Location</h2>
      <Input label="Street address" value={form.street_address} onChange={(e) => setForm({ ...form, street_address: e.target.value })} placeholder="123 Auto Blvd" />
      <div className="grid grid-cols-2 gap-3">
        <Input label="City" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} required />
        <Select
          label="State"
          value={form.state}
          onChange={(e) => setForm({ ...form, state: e.target.value })}
          options={US_STATES.map((s) => ({ value: s, label: s }))}
          placeholder="Select state"
        />
      </div>
      <Input label="ZIP code" value={form.zip_code} onChange={(e) => setForm({ ...form, zip_code: e.target.value })} placeholder="90210" />
      {form.mobile_service && (
        <Input
          label="Service radius (miles)"
          type="number"
          value={form.service_radius_miles}
          onChange={(e) => setForm({ ...form, service_radius_miles: e.target.value })}
          hint="How far do you travel for mobile service?"
        />
      )}
    </div>
  );
}

function Step4Review({ form, categories }: { form: FormState; categories: ServiceCategory[] }) {
  const selectedCats = categories.filter((c) => form.selectedCategories.includes(c.id));

  return (
    <div>
      <h2 className="font-bold text-zinc-100 mb-5">Review your profile</h2>
      <div className="space-y-4">
        {[
          { label: 'Business name', value: form.business_name },
          { label: 'Contact', value: form.contact_name },
          { label: 'Phone', value: form.phone },
          { label: 'Email', value: form.email },
          { label: 'Website', value: form.website },
          { label: 'Instagram', value: form.instagram },
          { label: 'Location', value: [form.city, form.state, form.zip_code].filter(Boolean).join(', ') },
          { label: 'Mobile service', value: form.mobile_service ? `Yes (within ${form.service_radius_miles} miles)` : 'No' },
        ].map((row) =>
          row.value ? (
            <div key={row.label} className="flex gap-4">
              <span className="text-xs font-medium text-zinc-500 w-28 shrink-0 pt-0.5">{row.label}</span>
              <span className="text-sm text-zinc-200">{row.value}</span>
            </div>
          ) : null
        )}
        {form.description && (
          <div className="flex gap-4">
            <span className="text-xs font-medium text-zinc-500 w-28 shrink-0 pt-0.5">Description</span>
            <span className="text-sm text-zinc-200 line-clamp-3">{form.description}</span>
          </div>
        )}
        {selectedCats.length > 0 && (
          <div className="flex gap-4">
            <span className="text-xs font-medium text-zinc-500 w-28 shrink-0 pt-0.5">Services</span>
            <div className="flex flex-col gap-1.5 flex-1">
              {selectedCats.map((cat) => {
                const pricing = form.servicePricing[cat.id];
                const hasPrice = pricing?.min || pricing?.max;
                return (
                  <div key={cat.id} className="flex items-center justify-between">
                    <span className="text-sm text-zinc-200">{cat.label}</span>
                    {hasPrice && (
                      <span className="text-xs text-zinc-400">
                        {pricing.min && pricing.max
                          ? `$${pricing.min} – $${pricing.max}`
                          : pricing.min
                          ? `From $${pricing.min}`
                          : `Up to $${pricing.max}`}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
      <div className="mt-6 p-4 bg-amber-900/50 border border-amber-800 rounded-xl text-sm text-amber-300">
        After submitting, your listing will be reviewed by our team before going live. This typically takes 1-2 business days.
      </div>
    </div>
  );
}
