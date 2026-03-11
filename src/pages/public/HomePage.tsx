import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Search, Shield, ArrowRight, Sparkles, Wrench, Car, Layers, Sun, Zap, MapPin, CheckCircle, Settings, Users, Truck, Camera } from 'lucide-react';
import { BRAND_NAME, BRAND_DESCRIPTION, BRAND_HOW_IT_WORKS_HEADING, BRAND_PROVIDER_CTA } from '../../lib/brand';
import { supabase } from '../../lib/supabase';
import type { Provider } from '../../lib/database.types';
import { AppLayout } from '../../components/layout/AppLayout';
import { Button } from '../../components/ui/Button';

const categories = [
  { icon: <Sparkles size={22} />, label: 'Detailing', slug: 'detailing' },
  { icon: <Wrench size={22} />, label: 'Mechanic', slug: 'mechanic' },
  { icon: <Car size={22} />, label: 'Body Shop', slug: 'body-shop' },
  { icon: <Settings size={22} />, label: 'Auto Repair', slug: 'auto-repair' },
  { icon: <Truck size={22} />, label: 'Towing', slug: 'towing' },
  { icon: <Layers size={22} />, label: 'Wrap', slug: 'wrap' },
  { icon: <Sun size={22} />, label: 'Window Tint', slug: 'tint' },
  { icon: <Shield size={22} />, label: 'PPF', slug: 'ppf' },
  { icon: <Zap size={22} />, label: 'Performance', slug: 'performance-tuning' },
  { icon: <Camera size={22} />, label: 'Photo & Video', slug: 'photo-video' },
];

const trustItems = [
  {
    icon: <CheckCircle size={22} className="text-blue-400" />,
    title: 'Verified Providers',
    desc: 'Every business is reviewed before going live. No unvetted listings.',
  },
  {
    icon: <Settings size={22} className="text-blue-400" />,
    title: 'Specialty Automotive Services',
    desc: 'From detailing and PPF to performance tuning — specialists for every need.',
  },
  {
    icon: <MapPin size={22} className="text-blue-400" />,
    title: 'Local Search & Easy Booking',
    desc: 'Find pros in your area and submit a lead request in under a minute.',
  },
  {
    icon: <Users size={22} className="text-blue-400" />,
    title: 'Built for Car Owners',
    desc: 'Track your service history, manage your garage, and stay in control.',
  },
];

const steps = [
  { step: '01', title: 'Search your area', desc: 'Find vetted automotive service professionals near you by category or location.' },
  { step: '02', title: 'View profiles', desc: 'Read detailed business profiles, service lists, and verified information.' },
  { step: '03', title: 'Request service', desc: "Submit a lead request directly to the provider. They'll reach out to confirm." },
];

type ProviderCard = Pick<Provider, 'id' | 'business_name' | 'city' | 'state' | 'description'>;

export function HomePage() {
  const navigate = useNavigate();
  const [featuredProviders, setFeaturedProviders] = useState<ProviderCard[]>([]);

  useEffect(() => {
    supabase
      .from('providers')
      .select('id, business_name, city, state, description')
      .eq('status', 'approved')
      .eq('is_public', true)
      .limit(4)
      .then(({ data }) => {
        if (data) setFeaturedProviders(data as ProviderCard[]);
      });
  }, []);

  return (
    <AppLayout>
      {/* Hero */}
      <section className="relative bg-slate-900 overflow-hidden">
        <div className="absolute inset-0 bg-[url('/Untitled_design_(5).jpg')] bg-cover bg-center opacity-30" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-28 lg:py-36">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="max-w-3xl"
          >
            <div className="inline-flex items-center gap-2 bg-blue-600/20 border border-blue-500/30 text-blue-300 text-xs font-medium px-3 py-1.5 rounded-full mb-6">
              <span className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-pulse" />
              The automotive services marketplace
            </div>
            <h1 className="text-5xl sm:text-6xl font-extrabold text-white leading-tight tracking-tight mb-6">
              Find trusted<br />
              <span className="text-blue-400">auto service pros</span><br />
              near you
            </h1>
            <p className="text-lg text-slate-300 mb-10 max-w-xl leading-relaxed">
              {BRAND_DESCRIPTION}
            </p>
            <div className="flex flex-col sm:flex-row gap-3">
              <Button size="lg" onClick={() => navigate('/browse')} className="gap-2">
                <Search size={18} /> Find Providers
              </Button>
              <Button size="lg" variant="outline" onClick={() => navigate('/signup?role=provider')} className="text-white border-white/30 hover:bg-white/10 hover:text-white">
                List Your Business <ArrowRight size={16} />
              </Button>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Trust Banner */}
      <section className="border-b border-zinc-800 bg-zinc-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14">
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-8">
            {trustItems.map((item, i) => (
              <motion.div
                key={item.title}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.07 }}
                className="flex gap-4"
              >
                <div className="w-10 h-10 rounded-xl bg-blue-900/40 flex items-center justify-center shrink-0 mt-0.5">
                  {item.icon}
                </div>
                <div>
                  <h3 className="font-semibold text-zinc-100 text-sm mb-1">{item.title}</h3>
                  <p className="text-sm text-zinc-400 leading-relaxed">{item.desc}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Categories */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold text-zinc-100 mb-3">Browse by service</h2>
          <p className="text-zinc-500">Whatever your car needs, find the right specialist.</p>
        </div>
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-10 gap-4">
          {categories.map((cat, i) => (
            <motion.div
              key={cat.slug}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.05 }}
            >
              <Link
                to={`/browse?category=${cat.slug}`}
                className="flex flex-col items-center gap-3 p-4 rounded-2xl border border-zinc-800 bg-zinc-900 hover:border-blue-500 hover:bg-zinc-800 hover:-translate-y-0.5 transition-all group text-center"
              >
                <span className="text-blue-400 group-hover:scale-110 transition-transform">{cat.icon}</span>
                <span className="text-xs font-medium text-zinc-400 group-hover:text-zinc-200">{cat.label}</span>
              </Link>
            </motion.div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="relative border-y border-zinc-800 py-20 overflow-hidden">
        <div className="absolute inset-0 bg-[url('/Untitled_design_(6).jpg')] bg-cover bg-center opacity-40" />
        <div className="absolute inset-0 bg-black/80" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-white mb-3">{BRAND_HOW_IT_WORKS_HEADING}</h2>
            <p className="text-zinc-400">Three simple steps to get your vehicle serviced by a pro.</p>
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            {steps.map((s, i) => (
              <motion.div
                key={s.step}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="bg-zinc-900/70 backdrop-blur-sm rounded-2xl p-8 border border-zinc-800/80 shadow-sm"
              >
                <div className="text-4xl font-black text-blue-500/50 mb-4">{s.step}</div>
                <h3 className="text-lg font-bold text-white mb-2">{s.title}</h3>
                <p className="text-sm text-zinc-400 leading-relaxed">{s.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Featured Providers */}
      {featuredProviders.length > 0 && (
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
          <div className="flex items-end justify-between mb-10">
            <div>
              <h2 className="text-3xl font-bold text-zinc-100 mb-2">Featured providers</h2>
              <p className="text-zinc-500">Verified businesses ready to serve your vehicle.</p>
            </div>
            <Link
              to="/browse"
              className="hidden sm:flex items-center gap-1.5 text-sm font-medium text-blue-400 hover:text-blue-300 transition-colors"
            >
              View all <ArrowRight size={15} />
            </Link>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {featuredProviders.map((p, i) => (
              <motion.div
                key={p.id}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.07 }}
              >
                <Link
                  to={`/provider/${p.id}`}
                  className="block bg-zinc-900 rounded-2xl border border-zinc-800 shadow-sm hover:shadow-lg hover:border-zinc-700 hover:-translate-y-0.5 transition-all p-5 h-full"
                >
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-11 h-11 rounded-xl bg-blue-900/40 flex items-center justify-center shrink-0">
                      <Car size={20} className="text-blue-400" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-zinc-100 text-sm truncate">{p.business_name}</p>
                      {(p.city || p.state) && (
                        <p className="text-xs text-zinc-500 flex items-center gap-1 mt-0.5">
                          <MapPin size={11} />
                          {[p.city, p.state].filter(Boolean).join(', ')}
                        </p>
                      )}
                    </div>
                  </div>
                  {p.description && (
                    <p className="text-xs text-zinc-500 leading-relaxed line-clamp-3">{p.description}</p>
                  )}
                  <div className="mt-4 flex items-center gap-1 text-xs font-medium text-blue-400">
                    View profile <ArrowRight size={12} />
                  </div>
                </Link>
              </motion.div>
            ))}
          </div>
          <div className="mt-8 text-center sm:hidden">
            <Button variant="secondary" onClick={() => navigate('/browse')}>
              View all providers
            </Button>
          </div>
        </section>
      )}

      {/* Provider CTA */}
      <section className="relative bg-black py-20 overflow-hidden">
        <div className="absolute inset-0 bg-[url('/Untitled_design_(4).jpg')] bg-cover bg-center opacity-25" />
        <div className="absolute inset-0 bg-gradient-to-r from-black/90 via-black/75 to-black/90" />
        <div className="relative max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <h2 className="text-3xl sm:text-4xl font-extrabold text-white mb-4">
              Grow your automotive business
            </h2>
            <p className="text-lg text-zinc-400 mb-8 max-w-2xl mx-auto">
              {BRAND_PROVIDER_CTA}
            </p>
            <Button size="lg" onClick={() => navigate('/signup?role=provider')}>
              List Your Business Free <ArrowRight size={16} />
            </Button>
          </motion.div>
        </div>
      </section>
    </AppLayout>
  );
}
