import React, { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';

export function ConsumerSettingsPage() {
  const { profile, refreshProfile } = useAuth();
  const [fullName, setFullName] = useState(profile?.full_name ?? '');
  const [phone, setPhone] = useState(profile?.phone ?? '');
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;
    setSaving(true);
    setError('');
    const { error: err } = await supabase.from('profiles').update({ full_name: fullName, phone: phone || null }).eq('id', profile.id);
    setSaving(false);
    if (err) { setError(err.message); return; }
    await refreshProfile();
    setSuccess(true);
    setTimeout(() => setSuccess(false), 3000);
  };

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-xl font-bold text-zinc-100">Settings</h2>
        <p className="text-sm text-zinc-500">Update your account information.</p>
      </div>
      <div className="bg-zinc-900 rounded-2xl border border-zinc-800 shadow-sm p-6 max-w-lg">
        {success && <div className="mb-4 px-4 py-3 bg-emerald-900/50 border border-emerald-800 text-emerald-400 text-sm rounded-xl">Profile updated successfully.</div>}
        {error && <div className="mb-4 px-4 py-3 bg-red-950/50 border border-red-800 text-red-400 text-sm rounded-xl">{error}</div>}
        <form onSubmit={handleSave} className="space-y-4">
          <Input label="Full name" value={fullName} onChange={(e) => setFullName(e.target.value)} required />
          <Input label="Email" value={profile?.email ?? ''} disabled hint="Email cannot be changed here." />
          <Input label="Phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+1 (555) 000-0000" />
          <Button type="submit" loading={saving}>Save Changes</Button>
        </form>
      </div>
    </div>
  );
}
