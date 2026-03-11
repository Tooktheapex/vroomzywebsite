import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { AlertTriangle } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { PageLoader } from '../ui/LoadingSpinner';
import { Button } from '../ui/Button';

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: ('consumer' | 'provider' | 'admin')[];
  redirectTo?: string;
}

const roleRedirects: Record<string, string> = {
  consumer: '/consumer',
  provider: '/provider',
  admin: '/admin',
};

export function ProtectedRoute({ children, allowedRoles, redirectTo = '/login' }: ProtectedRouteProps) {
  const { user, profile, loading, profileError, signOut } = useAuth();
  const location = useLocation();

  // Still resolving session from storage — show full-page loader
  if (loading) return <PageLoader />;

  // No authenticated session — redirect to login, preserving destination
  if (!user) {
    return <Navigate to={redirectTo} state={{ from: location }} replace />;
  }

  // User is authenticated but we could not load or create their profile.
  // This is a broken state — show a clear error with a sign-out escape hatch.
  // Do NOT render the protected content, as role checks would be meaningless.
  if (profileError || (allowedRoles && !profile)) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-8 max-w-sm w-full text-center">
          <div className="w-12 h-12 rounded-2xl bg-amber-100 flex items-center justify-center mx-auto mb-4">
            <AlertTriangle size={22} className="text-amber-600" />
          </div>
          <h2 className="text-lg font-bold text-slate-900 mb-2">Account setup incomplete</h2>
          <p className="text-sm text-slate-500 mb-6">
            We were unable to load your account profile. This can happen if your internet connection dropped during sign-up. Please sign out and try again.
          </p>
          <Button fullWidth variant="secondary" onClick={signOut}>
            Sign Out & Retry
          </Button>
        </div>
      </div>
    );
  }

  // Profile is loaded — enforce role-based access
  if (allowedRoles && profile && !allowedRoles.includes(profile.role)) {
    return <Navigate to={roleRedirects[profile.role] ?? '/'} replace />;
  }

  return <>{children}</>;
}
