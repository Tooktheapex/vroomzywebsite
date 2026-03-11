import React, { useEffect, useState } from 'react';
import { Users } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import type { Profile } from '../../lib/database.types';
import { Badge } from '../../components/ui/Badge';
import { EmptyState } from '../../components/ui/EmptyState';
import { CardSkeleton } from '../../components/ui/LoadingSpinner';

export function AdminUsersPage() {
  const [users, setUsers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100)
      .then(({ data }) => {
        setUsers(data ?? []);
        setLoading(false);
      });
  }, []);

  const roleVariant = (role: string) => {
    if (role === 'admin') return 'danger';
    if (role === 'provider') return 'info';
    return 'neutral';
  };

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-xl font-bold text-zinc-100">Users</h2>
        <p className="text-sm text-zinc-500">All registered accounts on the platform.</p>
      </div>

      {loading ? (
        <div className="space-y-3">{[0,1,2].map((i) => <CardSkeleton key={i} />)}</div>
      ) : users.length === 0 ? (
        <EmptyState icon={<Users size={24} />} title="No users" description="Registered users will appear here." />
      ) : (
        <div className="bg-zinc-900 rounded-2xl border border-zinc-800 shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-zinc-800 border-b border-zinc-800">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-semibold text-zinc-300">Name</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-zinc-300">Email</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-zinc-300">Role</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-zinc-300">Joined</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800">
              {users.map((u) => (
                <tr key={u.id} className="hover:bg-zinc-800 transition-colors">
                  <td className="px-4 py-3 font-medium text-zinc-200">{u.full_name ?? '—'}</td>
                  <td className="px-4 py-3 text-zinc-400">{u.email ?? '—'}</td>
                  <td className="px-4 py-3">
                    <Badge variant={roleVariant(u.role)}>{u.role}</Badge>
                  </td>
                  <td className="px-4 py-3 text-xs text-zinc-500">{new Date(u.created_at).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
