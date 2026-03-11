import React, { useEffect, useState } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import { LayoutDashboard, Car, MessageSquare, Settings } from 'lucide-react';
import { DashboardLayout } from '../../components/layout/AppLayout';
import { DashboardSidebar } from '../../components/layout/DashboardSidebar';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';

const navItems = [
  { to: '/consumer', label: 'Overview', icon: LayoutDashboard, end: true },
  { to: '/consumer/garage', label: 'My Garage', icon: Car },
  { to: '/consumer/requests', label: 'My Requests', icon: MessageSquare },
  { to: '/consumer/settings', label: 'Settings', icon: Settings },
];

export function ConsumerDashboardLayout() {
  return (
    <DashboardLayout sidebar={<DashboardSidebar items={navItems} title="Consumer" />}>
      <Outlet />
    </DashboardLayout>
  );
}

export function ConsumerOverview() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [counts, setCounts] = useState({ vehicles: 0, requests: 0 });

  useEffect(() => {
    if (!profile) return;
    Promise.all([
      supabase.from('vehicles').select('id', { count: 'exact', head: true }).eq('user_id', profile.id),
      supabase.from('lead_requests').select('id', { count: 'exact', head: true }).eq('consumer_user_id', profile.id),
    ]).then(([v, r]) => {
      setCounts({ vehicles: v.count ?? 0, requests: r.count ?? 0 });
    });
  }, [profile]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-zinc-100">Welcome back, {profile?.full_name?.split(' ')[0] ?? 'there'}</h2>
        <p className="text-sm text-zinc-500 mt-1">Manage your vehicles and service requests.</p>
      </div>

      <div className="grid sm:grid-cols-3 gap-4">
        {[
          { label: 'Vehicles in Garage', value: counts.vehicles, action: () => navigate('/consumer/garage'), cta: 'Manage Garage' },
          { label: 'Service Requests', value: counts.requests, action: () => navigate('/consumer/requests'), cta: 'View Requests' },
          { label: 'Find Providers', value: null, action: () => navigate('/browse'), cta: 'Browse Now' },
        ].map((item) => (
          <div key={item.label} className="bg-zinc-900 rounded-2xl border border-zinc-800 shadow-sm p-5">
            <p className="text-xs font-medium text-zinc-500 mb-2">{item.label}</p>
            {item.value !== null && <p className="text-3xl font-bold text-zinc-100 mb-3">{item.value}</p>}
            <button
              onClick={item.action}
              className="text-sm text-blue-400 font-medium hover:underline"
            >
              {item.cta} →
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
