import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Car, ArrowLeft } from 'lucide-react';
import { BRAND_NAME } from '../../lib/brand';
import { supabase } from '../../lib/supabase';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';

export function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!email) { setError('Please enter your email.'); return; }
    setSubmitting(true);
    const { error: err } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setSubmitting(false);
    if (err) { setError(err.message); return; }
    setSent(true);
  };

  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center px-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        className="w-full max-w-md"
      >
        <div className="bg-zinc-900 rounded-3xl shadow-2xl border border-zinc-800 p-8">
          <Link to="/" className="flex items-center gap-2.5 mb-8">
            <img src="/ChatGPT_Image_Mar_10,_2026,_02_22_10_PM.png" alt="Vroomzy" className="w-8 h-8 object-contain" />
            <span className="text-xl font-bold text-white">{BRAND_NAME}</span>
          </Link>

          {sent ? (
            <div className="text-center py-4">
              <div className="w-14 h-14 rounded-2xl bg-emerald-900/50 flex items-center justify-center mx-auto mb-4">
                <svg className="w-7 h-7 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h2 className="text-xl font-bold text-zinc-100 mb-2">Check your email</h2>
              <p className="text-sm text-zinc-500 mb-6">
                We sent a password reset link to <strong className="text-zinc-300">{email}</strong>. Check your inbox and follow the instructions.
              </p>
              <Link to="/login" className="text-sm text-blue-400 font-medium hover:underline">
                Back to sign in
              </Link>
            </div>
          ) : (
            <>
              <Link to="/login" className="flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-300 mb-6 transition-colors">
                <ArrowLeft size={14} /> Back to sign in
              </Link>
              <h1 className="text-2xl font-bold text-zinc-100 mb-1">Reset your password</h1>
              <p className="text-sm text-zinc-500 mb-8">
                Enter your email and we'll send you a link to reset your password.
              </p>

              {error && (
                <div className="mb-5 px-4 py-3 bg-red-950/50 border border-red-800 rounded-xl text-sm text-red-400">
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit} className="flex flex-col gap-5">
                <Input
                  label="Email address"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
                <Button type="submit" fullWidth loading={submitting} size="lg">
                  Send Reset Link
                </Button>
              </form>
            </>
          )}
        </div>
      </motion.div>
    </div>
  );
}
