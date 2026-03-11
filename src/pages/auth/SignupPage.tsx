import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Car, Eye, EyeOff, User, Wrench } from 'lucide-react';
import { BRAND_NAME } from '../../lib/brand';
import { useAuth } from '../../contexts/AuthContext';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';

type Role = 'consumer' | 'provider';

export function SignupPage() {
  const { signUp, user, profile, loading } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const initialRole = (searchParams.get('role') as Role) === 'provider' ? 'provider' : 'consumer';

  const [role, setRole] = useState<Role>(initialRole);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [awaitingSession, setAwaitingSession] = useState(false);

  useEffect(() => {
    if (!loading && user && profile) {
      const dest = { consumer: '/consumer', provider: '/provider', admin: '/admin' }[profile.role] ?? '/';
      navigate(dest, { replace: true });
    }
  }, [user, profile, loading, navigate]);

  useEffect(() => {
    if (!awaitingSession) return;
    if (loading) return;
    if (user && profile) {
      const dest = profile.role === 'provider' ? '/provider/onboarding' : '/consumer';
      navigate(dest, { replace: true });
    }
  }, [awaitingSession, user, profile, loading, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!fullName.trim() || !email.trim() || !password) {
      setError('Please fill in all fields.');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }

    setSubmitting(true);
    const { error: err } = await signUp(email, password, fullName, role);
    if (err) {
      setError(err);
      setSubmitting(false);
      return;
    }

    setAwaitingSession(true);
  };

  if (awaitingSession && (loading || !profile)) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="text-center">
          <LoadingSpinner size="lg" className="mx-auto mb-4 text-white" />
          <p className="text-zinc-400 text-sm">Setting up your account...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center px-4 py-10">
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

          <h1 className="text-2xl font-bold text-zinc-100 mb-1">Create your account</h1>
          <p className="text-sm text-zinc-500 mb-6">Join thousands of car owners and service pros.</p>

          {/* Role Selector */}
          <div className="grid grid-cols-2 gap-3 mb-6">
            {([
              { value: 'consumer', label: 'Car Owner', icon: <User size={18} />, sub: 'Find trusted services' },
              { value: 'provider', label: 'Business', icon: <Wrench size={18} />, sub: 'List your services' },
            ] as { value: Role; label: string; icon: React.ReactNode; sub: string }[]).map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setRole(opt.value)}
                className={`flex flex-col items-center gap-1.5 p-4 rounded-xl border-2 text-center transition-all ${
                  role === opt.value
                    ? 'border-blue-600 bg-blue-900/30 text-blue-400'
                    : 'border-zinc-700 hover:border-zinc-600 text-zinc-400'
                }`}
              >
                <span className={role === opt.value ? 'text-blue-400' : 'text-zinc-500'}>{opt.icon}</span>
                <span className="text-sm font-semibold">{opt.label}</span>
                <span className="text-xs opacity-70">{opt.sub}</span>
              </button>
            ))}
          </div>

          {error && (
            <div className="mb-5 px-4 py-3 bg-red-950/50 border border-red-800 rounded-xl text-sm text-red-400">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <Input
              label="Full name"
              type="text"
              placeholder="John Smith"
              value={fullName}
              onChange={(e) => { setFullName(e.target.value); if (error) setError(''); }}
              autoComplete="name"
              required
            />
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
                placeholder="Min. 8 characters"
                value={password}
                onChange={(e) => { setPassword(e.target.value); if (error) setError(''); }}
                autoComplete="new-password"
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
            <Button type="submit" fullWidth loading={submitting} size="lg" className="mt-2">
              {role === 'provider' ? 'Create Business Account' : 'Create Account'}
            </Button>
          </form>

          <p className="mt-6 text-center text-sm text-zinc-500">
            Already have an account?{' '}
            <Link to="/login" className="text-blue-400 font-medium hover:underline">
              Sign in
            </Link>
          </p>
        </div>
      </motion.div>
    </div>
  );
}
