import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Car, Eye, EyeOff, AlertTriangle } from 'lucide-react';
import { BRAND_NAME } from '../../lib/brand';
import { supabase } from '../../lib/supabase';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { PageLoader } from '../../components/ui/LoadingSpinner';

export function ResetPasswordPage() {
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [tokenState, setTokenState] = useState<'checking' | 'valid' | 'invalid'>('checking');

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setTokenState('valid');
      }
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        setTokenState('valid');
      } else {
        const timer = setTimeout(() => {
          setTokenState((prev) => prev === 'checking' ? 'invalid' : prev);
        }, 3000);
        return () => clearTimeout(timer);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!password || !confirm) { setError('Please fill in all fields.'); return; }
    if (password.length < 8) { setError('Password must be at least 8 characters.'); return; }
    if (password !== confirm) { setError('Passwords do not match.'); return; }

    setSubmitting(true);
    const { error: err } = await supabase.auth.updateUser({ password });
    setSubmitting(false);
    if (err) { setError(err.message); return; }
    setSuccess(true);
    await supabase.auth.signOut();
    setTimeout(() => navigate('/login'), 2500);
  };

  if (tokenState === 'checking') return <PageLoader />;

  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center px-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        className="w-full max-w-md"
      >
        <div className="bg-zinc-900 rounded-3xl shadow-2xl border border-zinc-800 p-8">
          <div className="flex items-center gap-2.5 mb-8">
            <img src="/ChatGPT_Image_Mar_10,_2026,_02_22_10_PM.png" alt="Vroomzy" className="w-8 h-8 object-contain" />
            <span className="text-xl font-bold text-white">{BRAND_NAME}</span>
          </div>

          {tokenState === 'invalid' ? (
            <div className="text-center py-4">
              <div className="w-14 h-14 rounded-2xl bg-amber-900/50 flex items-center justify-center mx-auto mb-4">
                <AlertTriangle size={26} className="text-amber-400" />
              </div>
              <h2 className="text-xl font-bold text-zinc-100 mb-2">Link expired or invalid</h2>
              <p className="text-sm text-zinc-500 mb-6">
                This password reset link is no longer valid. Reset links expire after 24 hours. Please request a new one.
              </p>
              <Link to="/forgot-password" className="text-sm text-blue-400 font-medium hover:underline">
                Request a new reset link
              </Link>
            </div>
          ) : success ? (
            <div className="text-center py-4">
              <div className="w-14 h-14 rounded-2xl bg-emerald-900/50 flex items-center justify-center mx-auto mb-4">
                <svg className="w-7 h-7 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h2 className="text-xl font-bold text-zinc-100 mb-2">Password updated!</h2>
              <p className="text-sm text-zinc-500">Redirecting you to sign in...</p>
            </div>
          ) : (
            <>
              <h1 className="text-2xl font-bold text-zinc-100 mb-1">Set new password</h1>
              <p className="text-sm text-zinc-500 mb-8">Choose a strong password for your account.</p>

              {error && (
                <div className="mb-5 px-4 py-3 bg-red-950/50 border border-red-800 rounded-xl text-sm text-red-400">
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                <div className="relative">
                  <Input
                    label="New password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Min. 8 characters"
                    value={password}
                    onChange={(e) => { setPassword(e.target.value); if (error) setError(''); }}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 bottom-2.5 text-zinc-500 hover:text-zinc-300"
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                <Input
                  label="Confirm password"
                  type="password"
                  placeholder="Repeat your password"
                  value={confirm}
                  onChange={(e) => { setConfirm(e.target.value); if (error) setError(''); }}
                  required
                />
                <Button type="submit" fullWidth loading={submitting} size="lg" className="mt-2">
                  Update Password
                </Button>
              </form>
            </>
          )}
        </div>
      </motion.div>
    </div>
  );
}
