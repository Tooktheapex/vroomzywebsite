import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Search, MapPin, Filter, Smartphone, Store, X } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import type { Provider, ServiceCategory } from '../../lib/database.types';
import { AppLayout } from '../../components/layout/AppLayout';
import { Input, Select } from '../../components/ui/Input';
import { Badge } from '../../components/ui/Badge';
import { CardSkeleton } from '../../components/ui/LoadingSpinner';
import { EmptyState } from '../../components/ui/EmptyState';

type ProviderWithServices = Provider & {
  provider_services: { service_categories: ServiceCategory }[];
};

const US_STATES = [
  'AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA',
  'KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ',
  'NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT',
  'VA','WA','WV','WI','WY',
];

export function BrowsePage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const [providers, setProviders] = useState<ProviderWithServices[]>([]);
  const [categories, setCategories] = useState<ServiceCategory[]>([]);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState(searchParams.get('search') ?? '');
  const [categoryFilter, setCategoryFilter] = useState(searchParams.get('category') ?? '');
  const [stateFilter, setStateFilter] = useState(searchParams.get('state') ?? '');
  const [cityFilter, setCityFilter] = useState(searchParams.get('city') ?? '');
  const [mobileOnly, setMobileOnly] = useState(searchParams.get('mobile') === 'true');

  useEffect(() => {
    supabase.from('service_categories').select('*').order('label').then(({ data }) => {
      if (data) setCategories(data);
    });
  }, []);

  useEffect(() => {
    const params: Record<string, string> = {};
    if (search) params.search = search;
    if (categoryFilter) params.category = categoryFilter;
    if (stateFilter) params.state = stateFilter;
    if (cityFilter) params.city = cityFilter;
    if (mobileOnly) params.mobile = 'true';
    setSearchParams(params, { replace: true });
  }, [search, categoryFilter, stateFilter, cityFilter, mobileOnly, setSearchParams]);

  useEffect(() => {
    const fetchProviders = async () => {
      setLoading(true);
      let query = supabase
        .from('providers')
        .select(`
          *,
          provider_services (
            service_categories (*)
          )
        `)
        .eq('status', 'approved')
        .eq('is_public', true);

      if (stateFilter) query = query.eq('state', stateFilter);
      if (cityFilter) query = query.ilike('city', `%${cityFilter}%`);
      if (mobileOnly) query = query.eq('mobile_service', true);
      if (search) query = query.or(`business_name.ilike.%${search}%,description.ilike.%${search}%`);

      query = query.order('created_at', { ascending: false });

      const { data } = await query;
      let results = (data ?? []) as ProviderWithServices[];

      // Filter by category client-side (join filter)
      if (categoryFilter) {
        results = results.filter((p) =>
          p.provider_services.some((ps) => ps.service_categories?.slug === categoryFilter)
        );
      }

      setProviders(results);
      setLoading(false);
    };

    fetchProviders();
  }, [search, categoryFilter, stateFilter, cityFilter, mobileOnly]);

  const clearFilters = () => {
    setSearch('');
    setCategoryFilter('');
    setStateFilter('');
    setCityFilter('');
    setMobileOnly(false);
  };

  const hasFilters = search || categoryFilter || stateFilter || cityFilter || mobileOnly;

  return (
    <AppLayout>
      <div className="bg-zinc-950 border-b border-zinc-800 py-14">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h1 className="text-3xl font-bold text-white mb-2">Find automotive pros</h1>
          <p className="text-zinc-400 mb-8">Browse verified providers in your area</p>
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="relative">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
              <input
                type="text"
                placeholder="Search businesses..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-2.5 rounded-lg border border-zinc-700 bg-zinc-800 text-zinc-100 placeholder-zinc-500 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <Select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              options={categories.map((c) => ({ value: c.slug, label: c.label }))}
              placeholder="All Categories"
            />
            <Select
              value={stateFilter}
              onChange={(e) => setStateFilter(e.target.value)}
              options={US_STATES.map((s) => ({ value: s, label: s }))}
              placeholder="All States"
            />
            <div className="flex items-center gap-3">
              <Input
                type="text"
                placeholder="City"
                value={cityFilter}
                onChange={(e) => setCityFilter(e.target.value)}
                className="flex-1"
              />
            </div>
          </div>
          <div className="flex items-center gap-4 mt-4">
            <label className="flex items-center gap-2 text-sm text-zinc-400 cursor-pointer">
              <input
                type="checkbox"
                checked={mobileOnly}
                onChange={(e) => setMobileOnly(e.target.checked)}
                className="w-4 h-4 rounded accent-blue-500"
              />
              Mobile service only
            </label>
            {hasFilters && (
              <button
                onClick={clearFilters}
                className="flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-200 transition-colors"
              >
                <X size={12} /> Clear filters
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="flex items-center justify-between mb-6">
          <p className="text-sm text-zinc-500">
            {loading ? 'Searching...' : `${providers.length} provider${providers.length !== 1 ? 's' : ''} found`}
          </p>
        </div>

        {loading ? (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
            {Array.from({ length: 6 }).map((_, i) => <CardSkeleton key={i} />)}
          </div>
        ) : providers.length === 0 ? (
          <EmptyState
            icon={<Search size={24} />}
            title="No providers found"
            description="Try adjusting your filters or searching in a different city."
            action={
              hasFilters ? (
                <button onClick={clearFilters} className="text-sm text-blue-400 hover:underline">
                  Clear all filters
                </button>
              ) : undefined
            }
          />
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
            {providers.map((provider, i) => (
              <ProviderCard key={provider.id} provider={provider} index={i} onClick={() => navigate(`/provider/${provider.id}`)} />
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}

function ProviderCard({ provider, index, onClick }: { provider: ProviderWithServices; index: number; onClick: () => void }) {
  const services = provider.provider_services?.map((ps) => ps.service_categories).filter(Boolean) ?? [];

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04 }}
      whileHover={{ y: -3, boxShadow: '0 10px 40px rgba(0,0,0,0.40)' }}
      onClick={onClick}
      className="bg-zinc-900 rounded-2xl border border-zinc-800 shadow-sm cursor-pointer overflow-hidden group hover:border-zinc-700"
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
