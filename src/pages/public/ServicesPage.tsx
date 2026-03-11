import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Sparkles, Wrench, Car, Layers, Sun, Zap, Shield, Truck, Settings, Camera,
  ArrowRight, ChevronRight,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import type { ServiceCategory } from '../../lib/database.types';
import { AppLayout } from '../../components/layout/AppLayout';

const ICON_MAP: Record<string, React.ReactNode> = {
  detailing: <Sparkles size={28} />,
  mechanic: <Wrench size={28} />,
  'body-shop': <Car size={28} />,
  'auto-repair': <Settings size={28} />,
  towing: <Truck size={28} />,
  wrap: <Layers size={28} />,
  tint: <Sun size={28} />,
  ppf: <Shield size={28} />,
  'performance-tuning': <Zap size={28} />,
  'photo-video': <Camera size={28} />,
};

const DESCRIPTIONS: Record<string, { tagline: string; description: string }> = {
  detailing: {
    tagline: 'Restore your car to showroom condition',
    description: 'Professional detailers offer interior & exterior cleaning, paint correction, ceramic coating, and more to keep your car looking its absolute best.',
  },
  mechanic: {
    tagline: 'Keep your engine running strong',
    description: 'Certified mechanics handle everything from oil changes and brake service to full engine diagnostics and repairs.',
  },
  'body-shop': {
    tagline: 'Collision repair & bodywork specialists',
    description: 'Body shops restore vehicles after accidents, remove dents and dings, and handle paint matching and panel replacement.',
  },
  'auto-repair': {
    tagline: 'General mechanical repair & diagnostics',
    description: 'Auto repair shops cover a wide range of mechanical services including transmission work, suspension, electrical diagnostics, and routine maintenance.',
  },
  towing: {
    tagline: 'Roadside assistance when you need it most',
    description: 'Towing providers offer emergency roadside service, flatbed transport, long-distance towing, and vehicle recovery.',
  },
  wrap: {
    tagline: 'Transform your ride with a custom wrap',
    description: 'Vinyl wrap specialists can change your car\'s color, add graphics, protect the original paint, and create one-of-a-kind custom designs.',
  },
  tint: {
    tagline: 'Privacy, UV protection, and sleek style',
    description: 'Window tint professionals install high-quality film to reduce heat and glare, protect interiors from UV rays, and give your car a refined look.',
  },
  ppf: {
    tagline: 'Invisible armor for your paint',
    description: 'Paint Protection Film (PPF) installers apply a self-healing clear layer to guard against rock chips, scratches, and road debris.',
  },
  'performance-tuning': {
    tagline: 'Unlock your car\'s full potential',
    description: 'Performance tuning shops offer ECU remapping, exhaust upgrades, suspension tuning, forced induction, and more to elevate your driving experience.',
  },
  'photo-video': {
    tagline: 'Capture your car in stunning detail',
    description: 'Automotive photographers and videographers create professional content — from stunning still photo shoots and cinematic reels to social media content and car show coverage.',
  },
};

const GRADIENT_MAP: Record<string, string> = {
  detailing: 'from-sky-500 to-blue-600',
  mechanic: 'from-zinc-500 to-zinc-700',
  'body-shop': 'from-red-500 to-rose-700',
  'auto-repair': 'from-orange-500 to-orange-700',
  towing: 'from-yellow-500 to-amber-600',
  wrap: 'from-emerald-500 to-teal-600',
  tint: 'from-slate-400 to-slate-600',
  ppf: 'from-cyan-500 to-cyan-700',
  'performance-tuning': 'from-blue-500 to-blue-700',
  'photo-video': 'from-pink-500 to-rose-500',
};

export function ServicesPage() {
  const navigate = useNavigate();
  const [categories, setCategories] = useState<ServiceCategory[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase
      .from('service_categories')
      .select('*')
      .order('label')
      .then(({ data }) => {
        if (data) setCategories(data);
        setLoading(false);
      });
  }, []);

  return (
    <AppLayout>
      <div className="bg-zinc-950 border-b border-zinc-800 pt-16 pb-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <span className="inline-block text-xs font-semibold uppercase tracking-widest text-blue-400 mb-4">
              Our Services
            </span>
            <h1 className="text-4xl sm:text-5xl font-bold text-white mb-4 leading-tight">
              Everything your car needs,<br className="hidden sm:block" /> in one place.
            </h1>
            <p className="text-zinc-400 text-lg max-w-2xl mx-auto">
              Browse every automotive service we offer through our network of verified, vetted providers.
            </p>
          </motion.div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        {loading ? (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {Array.from({ length: 9 }).map((_, i) => (
              <div key={i} className="h-56 bg-zinc-900 rounded-2xl border border-zinc-800 animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {categories.map((cat, i) => {
              const meta = DESCRIPTIONS[cat.slug] ?? {
                tagline: 'Professional automotive services',
                description: 'Connect with verified providers in your area.',
              };
              const gradient = GRADIENT_MAP[cat.slug] ?? 'from-blue-500 to-blue-700';
              const icon = ICON_MAP[cat.slug] ?? <Wrench size={28} />;

              return (
                <motion.div
                  key={cat.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05, duration: 0.4 }}
                  whileHover={{ y: -4, boxShadow: '0 16px 48px rgba(0,0,0,0.4)' }}
                  onClick={() => navigate(`/services/${cat.slug}`)}
                  className="group cursor-pointer bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden hover:border-zinc-600 transition-colors"
                >
                  <div className={`h-1.5 bg-gradient-to-r ${gradient}`} />
                  <div className="p-7">
                    <div className={`w-14 h-14 rounded-xl bg-gradient-to-br ${gradient} flex items-center justify-center text-white mb-5 shadow-lg`}>
                      {icon}
                    </div>
                    <h2 className="text-xl font-bold text-zinc-100 mb-1.5 group-hover:text-white transition-colors">
                      {cat.label}
                    </h2>
                    <p className="text-sm font-medium text-blue-400 mb-3">{meta.tagline}</p>
                    <p className="text-sm text-zinc-500 leading-relaxed mb-6 line-clamp-3">
                      {meta.description}
                    </p>
                    <div className="flex items-center gap-1.5 text-sm font-semibold text-zinc-300 group-hover:text-blue-400 transition-colors">
                      Find providers <ArrowRight size={15} className="group-hover:translate-x-1 transition-transform" />
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5, duration: 0.5 }}
          className="mt-20 bg-zinc-900 border border-zinc-800 rounded-3xl p-10 flex flex-col md:flex-row items-center justify-between gap-6"
        >
          <div>
            <h3 className="text-2xl font-bold text-white mb-2">Are you a service provider?</h3>
            <p className="text-zinc-400">List your business on Vroomzy and start receiving leads from local car owners.</p>
          </div>
          <button
            onClick={() => navigate('/signup?role=provider')}
            className="shrink-0 flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-xl transition-colors"
          >
            Get Listed <ChevronRight size={16} />
          </button>
        </motion.div>
      </div>
    </AppLayout>
  );
}
