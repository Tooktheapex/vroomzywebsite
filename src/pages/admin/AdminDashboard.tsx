import React, { useEffect, useState } from 'react';
import { Outlet } from 'react-router-dom';
import { LayoutDashboard, Store, MessageSquare, Users, FileText } from 'lucide-react';
import { DashboardLayout } from '../../components/layout/AppLayout';
import { DashboardSidebar } from '../../components/layout/DashboardSidebar';
import { supabase } from '../../lib/supabase';

const navItems = [
  { to: '/admin', label: 'Overview', icon: LayoutDashboard, end: true },
  { to: '/admin/providers', label: 'Providers', icon: Store },
  { to: '/admin/leads', label: 'Lead Activity', icon: MessageSquare },
  { to: '/admin/users', label: 'Users', icon: Users },
  { to: '/admin/service-records', label: 'Service Records', icon: FileText },
];

export function AdminDashboardLayout() {
  return (
    <DashboardLayout sidebar={<DashboardSidebar items={navItems} title="Admin" />}>
      <Outlet />
    </DashboardLayout>
  );
}

export function AdminOverview() {
  const [stats, setStats] = useState({ providers: 0, pending: 0, leads: 0, users: 0 });

  useEffect(() => {
    Promise.all([
      supabase.from('providers').select('id', { count: 'exact', head: true }),
      supabase.from('providers').select('id', { count: 'exact', head: true }).eq('status', 'pending_approval'),
      supabase.from('lead_requests').select('id', { count: 'exact', head: true }),
      supabase.from('profiles').select('id', { count: 'exact', head: true }),
    ]).then(([prov, pending, leads, users]) => {
      setStats({
        providers: prov.count ?? 0,
        pending: pending.count ?? 0,
        leads: leads.count ?? 0,
        users: users.count ?? 0,
      });
    });
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-zinc-100">Admin Dashboard</h2>
        <p className="text-sm text-zinc-500">Platform overview and controls.</p>
      </div>
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Providers', value: stats.providers },
          { label: 'Pending Review', value: stats.pending, highlight: stats.pending > 0 },
          { label: 'Total Leads', value: stats.leads },
          { label: 'Total Users', value: stats.users },
        ].map((item) => (
          <div
            key={item.label}
            className={`rounded-2xl border shadow-sm p-5 ${item.highlight ? 'border-amber-800 bg-amber-900/50' : 'bg-zinc-900 border-zinc-800'}`}
          >
            <p className="text-xs font-medium text-zinc-500 mb-1">{item.label}</p>
            <p className={`text-3xl font-bold ${item.highlight ? 'text-amber-300' : 'text-zinc-100'}`}>{item.value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
