import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Car, Eye, EyeOff } from 'lucide-react';
import { BRAND_NAME } from '../../lib/brand';
import { useAuth } from '../../contexts/AuthContext';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';

export function LoginPage() {
  const { signIn, user, profile, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const rawFrom = (location.state as { from?: { pathname: string } })?.from?.pathname;
  const authPaths = ['/login', '/signup', '/forgot-password', '/reset-password'];
  const from = rawFrom && !authPaths.includes(rawFrom) ? rawFrom : undefined;

  useEffect(() => {
    if (!loading && user && profile) {
      const dest = from ?? { consumer: '/consumer', provider: '/provider', admin: '/admin' }[profile.role] ?? '/';
      navigate(dest, { replace: true });
    }
  }, [user, profile, loading, navigate, from]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!email || !password) { setError('Please fill in all fields.'); return; }
    setSubmitting(true);
    const { error: err } = await signIn(email, password);
    if (err) {
      setError(err);
      setSubmitting(false);
    }
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

          <h1 className="text-2xl font-bold text-zinc-100 mb-1">Welcome back</h1>
          <p className="text-sm text-zinc-500 mb-8">Sign in to your account to continue.</p>

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
              onChange={(e) => { setEmail(e.target.value); if (error) setError(''); }}
              autoComplete="email"
              required
            />
            <div className="relative">
              <Input
                label="Password"
                type={showPassword ? 'text' : 'password'}
                placeholder="••••••••"
                value={password}
                onChange={(e) => { setPassword(e.target.value); if (error) setError(''); }}
                autoComplete="current-password"
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
            <div className="flex justify-end">
              <Link to="/forgot-password" className="text-xs text-blue-400 hover:underline">
                Forgot password?
              </Link>
            </div>
            <Button type="submit" fullWidth loading={submitting} size="lg">
              Sign In
            </Button>
          </form>

          <p className="mt-6 text-center text-sm text-zinc-500">
            Don't have an account?{' '}
            <Link to="/signup" className="text-blue-400 font-medium hover:underline">
              Create one
            </Link>
          </p>
        </div>
      </motion.div>
    </div>
  );
}
