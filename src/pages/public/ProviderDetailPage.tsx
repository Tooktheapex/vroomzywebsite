import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { MapPin, Phone, Globe, Instagram, Smartphone, Store, ArrowLeft, Send, Images } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import type { Provider, ServiceCategory, Vehicle, ProviderGalleryImage } from '../../lib/database.types';
import { useAuth } from '../../contexts/AuthContext';
import { AppLayout } from '../../components/layout/AppLayout';
import { Button } from '../../components/ui/Button';
import { Input, TextArea, Select } from '../../components/ui/Input';
import { PageLoader } from '../../components/ui/LoadingSpinner';

type ProviderService = {
  service_categories: ServiceCategory;
  price_min: number | null;
  price_max: number | null;
};

type ProviderWithServices = Provider & {
  provider_services: ProviderService[];
};

export function ProviderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, profile } = useAuth();

  const [provider, setProvider] = useState<ProviderWithServices | null>(null);
  const [categories, setCategories] = useState<ServiceCategory[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [galleryImages, setGalleryImages] = useState<ProviderGalleryImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  const [form, setForm] = useState({
    contact_name: profile?.full_name ?? '',
    contact_phone: profile?.phone ?? '',
    contact_email: user?.email ?? '',
    service_category_id: '',
    service_needed: '',
    preferred_date: '',
    notes: '',
    vehicle_id: '',
    vehicle_year: '',
    vehicle_make: '',
    vehicle_model: '',
  });

  useEffect(() => {
    if (!id) return;
    const load = async () => {
      const [provRes, galleryRes] = await Promise.all([
        supabase
          .from('providers')
          .select(`*, provider_services(price_min, price_max, service_categories(*))`)
          .eq('id', id)
          .eq('status', 'approved')
          .eq('is_public', true)
          .maybeSingle(),
        supabase
          .from('provider_gallery_images')
          .select('*')
          .eq('provider_id', id)
          .eq('is_active', true)
          .order('sort_order'),
      ]);
      setProvider(provRes.data as ProviderWithServices);
      setGalleryImages(galleryRes.data ?? []);
      setLoading(false);
    };
    load();
  }, [id]);

  useEffect(() => {
    supabase.from('service_categories').select('*').order('label').then(({ data }) => {
      if (data) setCategories(data);
    });
  }, []);

  useEffect(() => {
    if (!user) return;
    supabase.from('vehicles').select('*').eq('user_id', user.id).order('year', { ascending: false }).then(({ data }) => {
      if (data) setVehicles(data);
    });
  }, [user]);

  useEffect(() => {
    if (profile) {
      setForm((f) => ({
        ...f,
        contact_name: profile.full_name ?? '',
        contact_phone: profile.phone ?? '',
        contact_email: user?.email ?? '',
      }));
    }
  }, [profile, user]);

  const handleSubmitLead = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !provider || submitting || submitted) return;
    setError('');

    if (!form.contact_name.trim()) {
      setError('Please enter your name.');
      return;
    }
    if (!form.service_needed.trim()) {
      setError('Please describe the service you need.');
      return;
    }

    setSubmitting(true);

    // Re-verify the provider is still approved and public before inserting.
    // The page-load query could be stale if the admin changed the status
    // while the user was filling out the form.
    const { data: currentProvider, error: provCheckErr } = await supabase
      .from('providers')
      .select('id, status, is_public')
      .eq('id', provider.id)
      .eq('status', 'approved')
      .eq('is_public', true)
      .maybeSingle();

    if (provCheckErr || !currentProvider) {
      setError('This provider is no longer accepting requests. Please go back and choose another provider.');
      setSubmitting(false);
      return;
    }

    const selectedVehicle = vehicles.find((v) => v.id === form.vehicle_id);

    const { data: lead, error: leadErr } = await supabase
      .from('lead_requests')
      .insert({
        provider_id: provider.id,
        consumer_user_id: user.id,
        vehicle_id: form.vehicle_id || null,
        service_category_id: form.service_category_id || null,
        service_needed: form.service_needed,
        preferred_date: form.preferred_date || null,
        notes: form.notes || null,
        contact_name: form.contact_name,
        contact_phone: form.contact_phone || null,
        contact_email: form.contact_email || null,
        vehicle_year: selectedVehicle?.year ?? (form.vehicle_year ? parseInt(form.vehicle_year) : null),
        vehicle_make: (selectedVehicle?.make ?? form.vehicle_make) || null,
        vehicle_model: (selectedVehicle?.model ?? form.vehicle_model) || null,
      })
      .select()
      .single();

    if (leadErr) {
      // Provide a friendlier message for the RLS policy block case
      if (leadErr.code === '42501' || leadErr.message.toLowerCase().includes('policy')) {
        setError('Unable to submit request. Please ensure you are signed in as a car owner.');
      } else {
        setError(leadErr.message);
      }
      setSubmitting(false);
      return;
    }

    // Record lead_created event in the billing ledger.
    // Failure here is non-fatal to the user — the lead was already saved.
    // Log the error so the team can investigate billing ledger gaps.
    const { error: eventErr } = await supabase.from('provider_lead_events').insert({
      provider_id: provider.id,
      lead_request_id: lead.id,
      event_type: 'lead_created',
      notes: 'Lead created from provider profile page',
    });

    if (eventErr) {
      console.error('[LeadSubmit] provider_lead_events insert failed:', eventErr.code, eventErr.message);
    }

    setSubmitting(false);
    setSubmitted(true);
  };

  if (loading) return <PageLoader />;
  if (!provider) return (
    <AppLayout>
      <div className="max-w-3xl mx-auto px-4 py-20 text-center">
        <h2 className="text-xl font-bold text-zinc-200 mb-3">Provider not found</h2>
        <p className="text-zinc-500 mb-6">This provider may not exist or is not currently available.</p>
        <Button onClick={() => navigate('/browse')}>Back to Browse</Button>
      </div>
    </AppLayout>
  );

  const services = provider.provider_services?.filter((ps) => ps.service_categories) ?? [];

  return (
    <AppLayout>
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <button
          onClick={() => navigate('/browse')}
          className="flex items-center gap-2 text-sm text-zinc-500 hover:text-zinc-200 mb-8 transition-colors"
        >
          <ArrowLeft size={15} /> Back to results
        </button>

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Main Info */}
          <div className="lg:col-span-2 space-y-6">
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="bg-zinc-900 rounded-2xl border border-zinc-800 shadow-sm overflow-hidden">
              <div className="h-2 bg-gradient-to-r from-blue-600 to-blue-400" />
              <div className="p-8">
                <div className="flex items-start gap-5 mb-4">
                  <div className="shrink-0 flex flex-col items-center gap-2">
                    {provider.logo_image_url ? (
                      <div className="w-16 h-16 rounded-2xl border border-zinc-700 bg-zinc-800 flex items-center justify-center overflow-hidden p-1">
                        <img
                          src={provider.logo_image_url}
                          alt={`${provider.business_name} logo`}
                          className="w-full h-full object-contain"
                        />
                      </div>
                    ) : provider.profile_image_url ? (
                      <img
                        src={provider.profile_image_url}
                        alt={provider.business_name}
                        className="w-16 h-16 rounded-2xl object-cover border border-zinc-700"
                      />
                    ) : (
                      <div className="w-16 h-16 rounded-2xl bg-blue-900/40 flex items-center justify-center">
                        <Store size={22} className="text-blue-400" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-4 mb-1">
                      <h1 className="text-2xl font-bold text-zinc-100">{provider.business_name}</h1>
                      <div className="shrink-0">
                        {provider.mobile_service ? (
                          <span className="flex items-center gap-1.5 text-sm bg-emerald-900/50 text-emerald-300 border border-emerald-800 px-3 py-1.5 rounded-full font-medium">
                            <Smartphone size={13} /> Mobile Service
                          </span>
                        ) : (
                          <span className="flex items-center gap-1.5 text-sm bg-zinc-800 text-zinc-400 border border-zinc-700 px-3 py-1.5 rounded-full font-medium">
                            <Store size={13} /> Shop
                          </span>
                        )}
                      </div>
                    </div>
                    {(provider.city || provider.state) && (
                      <div className="flex items-center gap-2 text-sm text-zinc-500">
                        <MapPin size={13} />
                        {[provider.street_address, provider.city, provider.state, provider.zip_code].filter(Boolean).join(', ')}
                      </div>
                    )}
                  </div>
                </div>

                {provider.description && (
                  <p className="text-zinc-400 leading-relaxed mb-6">{provider.description}</p>
                )}

                {services.length > 0 && (
                  <div>
                    <h3 className="text-sm font-semibold text-zinc-300 mb-3">Services offered</h3>
                    <div className="flex flex-col gap-2">
                      {services.map((ps) => (
                        <div key={ps.service_categories.id} className="flex items-center justify-between gap-3 py-1.5 px-3 rounded-xl bg-zinc-800/60 border border-zinc-700/50">
                          <span className="text-sm font-medium text-zinc-200">{ps.service_categories.label}</span>
                          {(ps.price_min != null || ps.price_max != null) && (
                            <span className="text-xs text-zinc-400 shrink-0">
                              {ps.price_min != null && ps.price_max != null
                                ? `$${ps.price_min} – $${ps.price_max}`
                                : ps.price_min != null
                                  ? `from $${ps.price_min}`
                                  : `up to $${ps.price_max}`}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </motion.div>

            {/* Gallery */}
            {galleryImages.length > 0 && (
              <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="bg-zinc-900 rounded-2xl border border-zinc-800 shadow-sm p-6">
                <h2 className="font-bold text-zinc-100 mb-4 flex items-center gap-2">
                  <Images size={16} className="text-zinc-500" /> Portfolio
                </h2>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {galleryImages.map((img) => (
                    <div key={img.id} className="group relative">
                      <img
                        src={img.image_url}
                        alt={img.caption ?? ''}
                        className="w-full h-32 object-cover rounded-xl border border-zinc-700 group-hover:opacity-90 transition-opacity"
                      />
                      {img.caption && (
                        <div className="absolute inset-x-0 bottom-0 bg-black/50 text-white text-xs p-2 rounded-b-xl opacity-0 group-hover:opacity-100 transition-opacity line-clamp-1">
                          {img.caption}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </motion.div>
            )}

            {/* Contact & Links */}
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="bg-zinc-900 rounded-2xl border border-zinc-800 shadow-sm p-6">
              <h2 className="font-bold text-zinc-100 mb-4">Contact information</h2>
              <div className="space-y-3">
                {provider.phone && (
                  <div className="flex items-center gap-3 text-sm text-zinc-400">
                    <Phone size={14} className="text-zinc-500" /> {provider.phone}
                  </div>
                )}
                {provider.website && (
                  <div className="flex items-center gap-3 text-sm">
                    <Globe size={14} className="text-zinc-500" />
                    <a href={provider.website} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline truncate">
                      {provider.website}
                    </a>
                  </div>
                )}
                {provider.instagram && (
                  <div className="flex items-center gap-3 text-sm">
                    <Instagram size={14} className="text-zinc-500" />
                    <a href={`https://instagram.com/${provider.instagram.replace('@', '')}`} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">
                      @{provider.instagram.replace('@', '')}
                    </a>
                  </div>
                )}
                {provider.mobile_service && provider.service_radius_miles > 0 && (
                  <div className="flex items-center gap-3 text-sm text-zinc-400">
                    <MapPin size={14} className="text-zinc-500" /> Serves within {provider.service_radius_miles} miles
                  </div>
                )}
              </div>
            </motion.div>
          </div>

          {/* Lead Form Sidebar */}
          <div className="lg:col-span-1">
            <motion.div initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.15 }} className="bg-zinc-900 rounded-2xl border border-zinc-800 shadow-sm p-6 sticky top-24">
              {submitted ? (
                <div className="text-center py-6">
                  <div className="w-12 h-12 rounded-2xl bg-emerald-900/50 flex items-center justify-center mx-auto mb-4">
                    <svg className="w-6 h-6 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <h3 className="font-bold text-zinc-100 mb-1">Request sent!</h3>
                  <p className="text-sm text-zinc-500">The provider will be in touch with you soon.</p>
                </div>
              ) : !user ? (
                <div className="text-center py-4">
                  <div className="w-12 h-12 rounded-2xl bg-blue-900/40 flex items-center justify-center mx-auto mb-4">
                    <Send size={20} className="text-blue-400" />
                  </div>
                  <h3 className="font-bold text-zinc-100 mb-2">Request this service</h3>
                  <p className="text-sm text-zinc-500 mb-5">Sign in to send a service request to this provider.</p>
                  <Button fullWidth onClick={() => navigate('/login', { state: { from: { pathname: `/provider/${provider.id}` } } })}>
                    Sign In to Request
                  </Button>
                  <p className="text-xs text-zinc-500 mt-3">
                    No account?{' '}
                    <button onClick={() => navigate('/signup')} className="text-blue-400 hover:underline">Sign up free</button>
                  </p>
                </div>
              ) : showForm ? (
                <form onSubmit={handleSubmitLead} className="space-y-4">
                  <h3 className="font-bold text-zinc-100">Request service</h3>
                  {error && <p className="text-xs text-red-400 bg-red-950/50 border border-red-800 p-2.5 rounded-lg">{error}</p>}
                  <Input
                    label="Your name"
                    value={form.contact_name}
                    onChange={(e) => setForm({ ...form, contact_name: e.target.value })}
                    required
                  />
                  <Input
                    label="Phone"
                    type="tel"
                    value={form.contact_phone}
                    onChange={(e) => setForm({ ...form, contact_phone: e.target.value })}
                  />
                  <Input
                    label="Email"
                    type="email"
                    value={form.contact_email}
                    onChange={(e) => setForm({ ...form, contact_email: e.target.value })}
                  />
                  <Select
                    label="Service needed"
                    value={form.service_category_id}
                    onChange={(e) => setForm({ ...form, service_category_id: e.target.value })}
                    options={categories.map((c) => ({ value: c.id, label: c.label }))}
                    placeholder="Select category"
                  />
                  <TextArea
                    label="Describe the service"
                    placeholder="What do you need done?"
                    value={form.service_needed}
                    onChange={(e) => setForm({ ...form, service_needed: e.target.value })}
                    rows={3}
                    required
                  />
                  <Input
                    label="Preferred date"
                    type="date"
                    value={form.preferred_date}
                    onChange={(e) => setForm({ ...form, preferred_date: e.target.value })}
                  />
                  {vehicles.length > 0 ? (
                    <Select
                      label="Vehicle (optional)"
                      value={form.vehicle_id}
                      onChange={(e) => setForm({ ...form, vehicle_id: e.target.value })}
                      options={vehicles.map((v) => ({ value: v.id, label: `${v.year} ${v.make} ${v.model}` }))}
                      placeholder="Select from garage"
                    />
                  ) : (
                    <div className="grid grid-cols-3 gap-2">
                      <Input label="Year" placeholder="2020" value={form.vehicle_year} onChange={(e) => setForm({ ...form, vehicle_year: e.target.value })} />
                      <Input label="Make" placeholder="Toyota" value={form.vehicle_make} onChange={(e) => setForm({ ...form, vehicle_make: e.target.value })} />
                      <Input label="Model" placeholder="Camry" value={form.vehicle_model} onChange={(e) => setForm({ ...form, vehicle_model: e.target.value })} />
                    </div>
                  )}
                  <div className="flex gap-2 pt-1">
                    <Button type="button" variant="ghost" size="sm" onClick={() => setShowForm(false)}>Cancel</Button>
                    <Button type="submit" fullWidth loading={submitting} size="sm">Send Request</Button>
                  </div>
                </form>
              ) : (
                <div className="text-center">
                  <div className="w-12 h-12 rounded-2xl bg-blue-900/40 flex items-center justify-center mx-auto mb-4">
                    <Send size={20} className="text-blue-400" />
                  </div>
                  <h3 className="font-bold text-zinc-100 mb-2">Request this service</h3>
                  <p className="text-sm text-zinc-500 mb-5">Get in touch with {provider.business_name} directly.</p>
                  <Button fullWidth onClick={() => setShowForm(true)}>
                    Send a Request
                  </Button>
                </div>
              )}
            </motion.div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
