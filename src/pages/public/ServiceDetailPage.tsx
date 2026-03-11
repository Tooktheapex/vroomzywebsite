import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Sparkles, Wrench, Car, Layers, Sun, Zap, Shield, Truck, Settings, Camera,
  MapPin, Smartphone, Store, ArrowLeft, CheckCircle, ChevronRight,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import type { Provider, ServiceCategory } from '../../lib/database.types';
import { AppLayout } from '../../components/layout/AppLayout';
import { Badge } from '../../components/ui/Badge';
import { CardSkeleton } from '../../components/ui/LoadingSpinner';
import { EmptyState } from '../../components/ui/EmptyState';

type ProviderWithServices = Provider & {
  provider_services: { service_categories: ServiceCategory }[];
};

const ICON_MAP: Record<string, React.ReactNode> = {
  detailing: <Sparkles size={32} />,
  mechanic: <Wrench size={32} />,
  'body-shop': <Car size={32} />,
  'auto-repair': <Settings size={32} />,
  towing: <Truck size={32} />,
  wrap: <Layers size={32} />,
  tint: <Sun size={32} />,
  ppf: <Shield size={32} />,
  'performance-tuning': <Zap size={32} />,
  'photo-video': <Camera size={32} />,
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

const SERVICE_INFO: Record<string, {
  tagline: string;
  description: string;
  whatToExpect: string[];
  benefits: string[];
}> = {
  detailing: {
    tagline: 'Restore your car to showroom condition',
    description: 'Professional auto detailing goes far beyond a standard car wash. Detailers use specialized tools, compounds, and techniques to deep clean, restore, and protect every surface of your vehicle — inside and out.',
    whatToExpect: [
      'Thorough interior vacuuming and steam cleaning',
      'Exterior hand wash, clay bar treatment, and polish',
      'Paint correction and swirl removal',
      'Ceramic coating or wax application',
      'Engine bay cleaning',
    ],
    benefits: ['Protects resale value', 'Removes contaminants that degrade paint', 'Long-lasting shine and protection'],
  },
  mechanic: {
    tagline: 'Keep your engine running strong',
    description: 'Certified mechanics diagnose and repair everything under the hood. Whether you need routine maintenance or a complex repair, skilled mechanics ensure your vehicle is safe and reliable on the road.',
    whatToExpect: [
      'Oil, filter, and fluid changes',
      'Brake inspection and replacement',
      'Engine diagnostics and repair',
      'Transmission service',
      'Suspension and steering work',
    ],
    benefits: ['Prevents breakdowns before they happen', 'Extends vehicle life', 'Ensures safety on the road'],
  },
  'body-shop': {
    tagline: 'Collision repair & bodywork specialists',
    description: 'After an accident or hail storm, body shops restore your vehicle to its pre-damage condition. They handle everything from minor dents to full structural repairs with precision paint matching.',
    whatToExpect: [
      'Collision damage assessment and repair',
      'Panel replacement and welding',
      'Paint color matching and refinishing',
      'Dent and ding removal (PDR)',
      'Insurance claim assistance',
    ],
    benefits: ['Restore factory appearance', 'Maintain structural integrity', 'Professional color-matching'],
  },
  'auto-repair': {
    tagline: 'General mechanical repair & diagnostics',
    description: 'Auto repair shops handle a wide range of mechanical issues beyond what a dealership covers. From complex diagnostics to routine maintenance, these shops keep all makes and models running smoothly.',
    whatToExpect: [
      'Check engine light diagnostics',
      'Timing belt and chain service',
      'AC and heating system repair',
      'Fuel system service',
      'Exhaust and emissions repair',
    ],
    benefits: ['Multi-make expertise', 'Often more affordable than dealerships', 'Fast turnaround on common repairs'],
  },
  towing: {
    tagline: 'Roadside assistance when you need it most',
    description: 'Towing providers offer fast, reliable roadside assistance and vehicle transport services. Whether your car broke down, was in an accident, or needs to be moved, towing companies are on call to help.',
    whatToExpect: [
      'Emergency roadside assistance',
      'Flatbed and wheel-lift towing',
      'Long-distance vehicle transport',
      'Jump starts and lockout service',
      'Winch-out recovery',
    ],
    benefits: ['24/7 availability', 'Safe vehicle transport', 'Fast response times'],
  },
  wrap: {
    tagline: 'Transform your ride with a custom wrap',
    description: 'Vinyl wrap installers can completely transform the look of your vehicle without permanent paint changes. Wraps protect the original paint and can be removed or updated whenever you want a new look.',
    whatToExpect: [
      'Full vehicle color change wraps',
      'Partial wraps and accents',
      'Matte, satin, gloss, and chrome finishes',
      'Custom graphics and branding',
      'Paint protection film combos',
    ],
    benefits: ['Reversible color changes', 'Protects factory paint', 'Endless design possibilities'],
  },
  tint: {
    tagline: 'Privacy, UV protection, and sleek style',
    description: 'Professional window tinting blocks UV rays, reduces interior heat, improves privacy, and gives your car a clean, refined aesthetic. Quality tint films last years without bubbling or fading.',
    whatToExpect: [
      'Precision-cut film for your vehicle',
      'Multiple tint shades and VLT levels',
      'UV and infrared blocking film options',
      'Ceramic tint for maximum heat rejection',
      'Windshield strip tinting',
    ],
    benefits: ['Reduces interior fading and heat', 'Glare reduction for safer driving', 'Enhances privacy and aesthetics'],
  },
  ppf: {
    tagline: 'Invisible armor for your paint',
    description: 'Paint Protection Film (PPF) is a nearly invisible urethane layer applied to your car\'s painted surfaces. It self-heals from minor scratches and repels rock chips, keeping your paint pristine for years.',
    whatToExpect: [
      'Full front-end or full-vehicle coverage',
      'Self-healing top coat technology',
      'Matte or gloss finish options',
      'Professional computer-cut templates',
      '5–10 year warranty on quality films',
    ],
    benefits: ['Guards against rock chips and scratches', 'Self-healing surface', 'Maintains showroom-quality paint'],
  },
  'performance-tuning': {
    tagline: 'Unlock your car\'s full potential',
    description: 'Performance tuning shops specialize in extracting more power, responsiveness, and driving pleasure from your vehicle. From ECU tuning to full builds, these specialists know how to push your car to its limits.',
    whatToExpect: [
      'ECU and tune optimization',
      'Forced induction (turbo/supercharger) installation',
      'Suspension lowering and alignment',
      'Exhaust system upgrades',
      'Intercooler and cooling system upgrades',
    ],
    benefits: ['Improved horsepower and torque', 'Better throttle response', 'Customized driving dynamics'],
  },
  'photo-video': {
    tagline: 'Capture your car in stunning detail',
    description: 'Automotive photographers and videographers create professional, high-quality content for car owners, enthusiasts, and brands. Whether you\'re showcasing a build, selling a vehicle, or creating social media content, these pros deliver stunning results.',
    whatToExpect: [
      'Professional studio or location photo shoots',
      'Cinematic video reels and walk-arounds',
      'Social media content packages',
      'Car show and event coverage',
      'Drone aerial footage',
    ],
    benefits: ['Showcase your build professionally', 'High-resolution deliverables', 'Perfect for listings and social content'],
  },
};

export function ServiceDetailPage() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();

  const [category, setCategory] = useState<ServiceCategory | null>(null);
  const [providers, setProviders] = useState<ProviderWithServices[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!slug) return;

    const fetchData = async () => {
      setLoading(true);

      const { data: cat } = await supabase
        .from('service_categories')
        .select('*')
        .eq('slug', slug)
        .maybeSingle();

      if (!cat) {
        setNotFound(true);
        setLoading(false);
        return;
      }

      setCategory(cat);

      const { data: provData } = await supabase
        .from('providers')
        .select(`
          *,
          provider_services!inner (
            service_categories (*)
          )
        `)
        .eq('status', 'approved')
        .eq('is_public', true)
        .eq('provider_services.category_id', cat.id)
        .order('created_at', { ascending: false });

      setProviders((provData ?? []) as ProviderWithServices[]);
      setLoading(false);
    };

    fetchData();
  }, [slug]);

  if (notFound) {
    return (
      <AppLayout>
        <div className="max-w-7xl mx-auto px-4 py-24 text-center">
          <h1 className="text-2xl font-bold text-zinc-100 mb-4">Service not found</h1>
          <Link to="/services" className="text-blue-400 hover:underline">Back to Services</Link>
        </div>
      </AppLayout>
    );
  }

  const info = slug ? SERVICE_INFO[slug] : undefined;
  const gradient = slug ? (GRADIENT_MAP[slug] ?? 'from-blue-500 to-blue-700') : 'from-blue-500 to-blue-700';
  const icon = slug ? (ICON_MAP[slug] ?? <Wrench size={32} />) : <Wrench size={32} />;

  return (
    <AppLayout>
      <div className={`bg-gradient-to-br ${gradient} relative overflow-hidden`}>
        <div className="absolute inset-0 bg-zinc-950/70" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <button
            onClick={() => navigate('/services')}
            className="flex items-center gap-1.5 text-sm text-white/60 hover:text-white transition-colors mb-8"
          >
            <ArrowLeft size={14} /> All Services
          </button>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="flex flex-col md:flex-row items-start md:items-center gap-6"
          >
            <div className={`w-20 h-20 rounded-2xl bg-gradient-to-br ${gradient} flex items-center justify-center text-white shadow-2xl border border-white/20`}>
              {loading ? <div className="w-8 h-8 bg-white/20 rounded-lg animate-pulse" /> : icon}
            </div>
            <div>
              {loading ? (
                <div className="space-y-2">
                  <div className="h-8 w-48 bg-white/20 rounded-lg animate-pulse" />
                  <div className="h-5 w-64 bg-white/10 rounded animate-pulse" />
                </div>
              ) : (
                <>
                  <h1 className="text-4xl font-bold text-white mb-2">{category?.label}</h1>
                  <p className="text-white/70 text-lg">{info?.tagline ?? 'Professional automotive services'}</p>
                </>
              )}
            </div>
          </motion.div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {info && (
          <div className="grid lg:grid-cols-3 gap-8 mb-16">
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="lg:col-span-2 bg-zinc-900 border border-zinc-800 rounded-2xl p-8"
            >
              <h2 className="text-xl font-bold text-zinc-100 mb-4">About this service</h2>
              <p className="text-zinc-400 leading-relaxed mb-6">{info.description}</p>
              <h3 className="text-sm font-semibold uppercase tracking-widest text-zinc-500 mb-4">What to expect</h3>
              <ul className="space-y-2.5">
                {info.whatToExpect.map((item, i) => (
                  <li key={i} className="flex items-start gap-3 text-sm text-zinc-300">
                    <CheckCircle size={15} className="text-blue-400 mt-0.5 shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="space-y-4"
            >
              <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
                <h3 className="text-sm font-semibold uppercase tracking-widest text-zinc-500 mb-4">Key benefits</h3>
                <ul className="space-y-3">
                  {info.benefits.map((b, i) => (
                    <li key={i} className="flex items-center gap-2.5 text-sm text-zinc-300">
                      <div className={`w-6 h-6 rounded-full bg-gradient-to-br ${gradient} flex items-center justify-center shrink-0`}>
                        <CheckCircle size={12} className="text-white" />
                      </div>
                      {b}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
                <p className="text-sm text-zinc-400 mb-4">Ready to find a {category?.label?.toLowerCase()} provider?</p>
                <button
                  onClick={() => navigate(`/browse?category=${slug}`)}
                  className={`w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-gradient-to-r ${gradient} text-white font-semibold text-sm hover:opacity-90 transition-opacity`}
                >
                  Browse All Providers <ChevronRight size={15} />
                </button>
              </div>
            </motion.div>
          </div>
        )}

        <div>
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-zinc-100">
              {loading ? 'Finding providers...' : `${providers.length} ${category?.label ?? ''} provider${providers.length !== 1 ? 's' : ''}`}
            </h2>
            {!loading && providers.length > 0 && (
              <button
                onClick={() => navigate(`/browse?category=${slug}`)}
                className="text-sm text-blue-400 hover:underline flex items-center gap-1"
              >
                See all <ChevronRight size={13} />
              </button>
            )}
          </div>

          {loading ? (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
              {Array.from({ length: 6 }).map((_, i) => <CardSkeleton key={i} />)}
            </div>
          ) : providers.length === 0 ? (
            <EmptyState
              icon={<Store size={24} />}
              title="No providers yet"
              description={`We don't have any ${category?.label?.toLowerCase()} providers listed yet. Check back soon or list your own business.`}
              action={
                <button
                  onClick={() => navigate('/signup?role=provider')}
                  className="text-sm text-blue-400 hover:underline"
                >
                  List your business
                </button>
              }
            />
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
              {providers.map((provider, i) => (
                <ServiceProviderCard
                  key={provider.id}
                  provider={provider}
                  index={i}
                  onClick={() => navigate(`/provider/${provider.id}`)}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}

function ServiceProviderCard({
  provider,
  index,
  onClick,
}: {
  provider: ProviderWithServices;
  index: number;
  onClick: () => void;
}) {
  const services = provider.provider_services?.map((ps) => ps.service_categories).filter(Boolean) ?? [];

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04 }}
      whileHover={{ y: -3, boxShadow: '0 10px 40px rgba(0,0,0,0.40)' }}
      onClick={onClick}
      className="bg-zinc-900 rounded-2xl border border-zinc-800 shadow-sm cursor-pointer overflow-hidden group hover:border-zinc-700 transition-colors"
    >
      <div className="h-2 bg-gradient-to-r from-blue-600 to-blue-400" />
      <div className="p-6">
        <div className="flex items-start gap-3 mb-3">
          {provider.profile_image_url ? (
            <img
              src={provider.profile_image_url}
              alt={provider.business_name}
              className="w-12 h-12 rounded-xl object-cover border border-zinc-700 shrink-0"
            />
          ) : (
            <div className="w-12 h-12 rounded-xl bg-blue-900/40 flex items-center justify-center shrink-0">
              <Store size={18} className="text-blue-400" />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <h3 className="font-bold text-zinc-100 group-hover:text-blue-400 transition-colors leading-tight">
                {provider.business_name}
              </h3>
              <div className="shrink-0">
                {provider.mobile_service ? (
                  <span className="flex items-center gap-1 text-xs bg-emerald-900/50 text-emerald-300 border border-emerald-800 px-2 py-1 rounded-full font-medium">
                    <Smartphone size={11} /> Mobile
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-xs bg-zinc-800 text-zinc-400 border border-zinc-700 px-2 py-1 rounded-full font-medium">
                    <Store size={11} /> Shop
                  </span>
                )}
              </div>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-zinc-500 mt-0.5">
              <MapPin size={11} />
              {[provider.city, provider.state].filter(Boolean).join(', ') || 'Location not set'}
            </div>
          </div>
        </div>
        {provider.description && (
          <p className="text-xs text-zinc-500 leading-relaxed mb-4 line-clamp-2">{provider.description}</p>
        )}
        <div className="flex flex-wrap gap-1.5">
          {services.slice(0, 4).map((cat) => (
            <Badge key={cat.id} variant="neutral" className="text-xs">{cat.label}</Badge>
          ))}
          {services.length > 4 && (
            <Badge variant="neutral" className="text-xs">+{services.length - 4} more</Badge>
          )}
        </div>
      </div>
    </motion.div>
  );
}
