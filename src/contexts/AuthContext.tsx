import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import type { Profile } from '../lib/database.types';

interface AuthContextValue {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  profileError: boolean;
  signUp: (email: string, password: string, fullName: string, role: 'consumer' | 'provider') => Promise<{ error: string | null }>;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [profileError, setProfileError] = useState(false);

  // Guard against state updates after unmount to prevent memory leaks
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  /**
   * Fetch the profile for a given auth user.
   * If no profile row exists (edge case where signUp insert failed),
   * attempt to create one using data from user_metadata.
   * Returns null only on hard database failure.
   */
  const fetchOrCreateProfile = useCallback(async (u: User): Promise<Profile | null> => {
    const { data: existing, error: fetchErr } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', u.id)
      .maybeSingle();

    if (fetchErr) {
      console.error('[AuthContext] profile fetch error:', fetchErr.message);
      return null;
    }

    if (existing) return existing;

    // Profile missing — attempt recovery insert
    const role = (u.user_metadata?.role as 'consumer' | 'provider' | undefined) ?? 'consumer';
    const { data: created, error: insertErr } = await supabase
      .from('profiles')
      .insert({
        id: u.id,
        email: u.email ?? null,
        full_name: (u.user_metadata?.full_name as string | undefined) ?? null,
        role,
      })
      .select()
      .single();

    if (insertErr) {
      console.error('[AuthContext] profile recovery insert error:', insertErr.message);
      return null;
    }

    return created;
  }, []);

  /**
   * Load a session: resolve the profile and update all context state atomically.
   * All state is set at once after the async profile fetch to avoid flicker.
   */
  const hydrateSession = useCallback(async (u: User, s: Session) => {
    const p = await fetchOrCreateProfile(u);
    if (!mountedRef.current) return;
    setSession(s);
    setUser(u);
    setProfile(p);
    setProfileError(p === null);
    setLoading(false);
  }, [fetchOrCreateProfile]);

  useEffect(() => {
    // Load persisted session on mount
    supabase.auth.getSession().then(({ data: { session: s }, error }) => {
      if (error) console.error('[AuthContext] getSession error:', error.message);
      if (!mountedRef.current) return;

      if (s?.user) {
        hydrateSession(s.user, s);
      } else {
        setLoading(false);
      }
    });

    // React to all future auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, s) => {
      if (!mountedRef.current) return;

      if (event === 'SIGNED_OUT' || !s) {
        setSession(null);
        setUser(null);
        setProfile(null);
        setProfileError(false);
        setLoading(false);
        return;
      }

      if (event === 'PASSWORD_RECOVERY') {
        // Token validated — just store session; user still needs to set password
        setSession(s);
        setUser(s.user);
        setLoading(false);
        return;
      }

      if (s.user && (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED')) {
        // Defer async work via IIFE to avoid passing async fn directly to the handler
        // (direct async handlers can deadlock Supabase's internal queue)
        (async () => { await hydrateSession(s.user, s); })();
      }
    });

    return () => subscription.unsubscribe();
  }, [hydrateSession]);

  const refreshProfile = useCallback(async () => {
    if (!user) return;
    const p = await fetchOrCreateProfile(user);
    if (!mountedRef.current) return;
    setProfile(p);
    setProfileError(p === null);
  }, [user, fetchOrCreateProfile]);

  const signUp = async (
    email: string,
    password: string,
    fullName: string,
    role: 'consumer' | 'provider'
  ): Promise<{ error: string | null }> => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName, role } },
    });

    if (error) return { error: error.message };
    if (!data.user) return { error: 'Signup failed. Please try again.' };

    // Insert profile row eagerly so it exists before onAuthStateChange fires.
    // ON CONFLICT DO NOTHING handles the case where the trigger or a parallel
    // call already created it.
    const { error: profileErr } = await supabase.from('profiles').insert({
      id: data.user.id,
      email,
      full_name: fullName,
      role,
    });

    // code 23505 = unique_violation (profile already exists) — safe to ignore
    if (profileErr && profileErr.code !== '23505') {
      console.warn('[AuthContext] profile insert warning:', profileErr.code, profileErr.message);
    }

    return { error: null };
  };

  const signIn = async (email: string, password: string): Promise<{ error: string | null }> => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { error: error.message };
    return { error: null };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    // SIGNED_OUT event in the listener above will clear all state
  };

  return (
    <AuthContext.Provider value={{ session, user, profile, loading, profileError, signUp, signIn, signOut, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
