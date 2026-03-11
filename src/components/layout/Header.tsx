import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Menu, X, ChevronDown, LogOut, Settings, LayoutDashboard } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { Button } from '../ui/Button';
import { BRAND_NAME } from '../../lib/brand';

export function Header() {
  const { user, profile, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };

  const dashboardPath = {
    consumer: '/consumer',
    provider: '/provider',
    admin: '/admin',
  }[profile?.role ?? 'consumer'] ?? '/consumer';

  const isActive = (path: string) => location.pathname === path;

  return (
    <header className="sticky top-0 z-50 bg-zinc-950/95 backdrop-blur-sm border-b border-zinc-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2.5">
            <img src="/ChatGPT_Image_Mar_10,_2026,_02_22_10_PM.png" alt="Vroomzy" className="w-12 h-12 object-contain" />
            <span className="text-xl font-bold text-white tracking-tight">{BRAND_NAME}</span>
          </Link>

          {/* Desktop Nav */}
          <nav className="hidden md:flex items-center gap-1">
            <Link
              to="/services"
              className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                location.pathname.startsWith('/services') ? 'bg-blue-900/40 text-blue-400' : 'text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800'
              }`}
            >
              Services
            </Link>
            <Link
              to="/browse"
              className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                isActive('/browse') ? 'bg-blue-900/40 text-blue-400' : 'text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800'
              }`}
            >
              Find Providers
            </Link>
            {!user && (
              <Link
                to="/signup?role=provider"
                className="px-3 py-2 rounded-lg text-sm font-medium text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 transition-colors"
              >
                List Your Business
              </Link>
            )}
          </nav>

          {/* Right Side */}
          <div className="flex items-center gap-2">
            {user && profile ? (
              <div className="relative">
                <button
                  onClick={() => setUserMenuOpen(!userMenuOpen)}
                  className="flex items-center gap-2 px-3 py-2 rounded-xl hover:bg-zinc-800 transition-colors"
                >
                  <div className="w-7 h-7 rounded-full bg-blue-600 flex items-center justify-center">
                    <span className="text-xs font-semibold text-white">
                      {(profile.full_name ?? profile.email ?? 'U')[0].toUpperCase()}
                    </span>
                  </div>
                  <span className="hidden sm:block text-sm font-medium text-zinc-300 max-w-[120px] truncate">
                    {profile.full_name ?? profile.email}
                  </span>
                  <ChevronDown size={14} className="text-zinc-500" />
                </button>

                <AnimatePresence>
                  {userMenuOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: 8, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 8, scale: 0.95 }}
                      transition={{ duration: 0.15 }}
                      className="absolute right-0 mt-2 w-52 bg-zinc-900 rounded-2xl shadow-xl border border-zinc-800 py-2 z-50"
                    >
                      <div className="px-3 py-2 border-b border-zinc-800 mb-1">
                        <p className="text-xs font-medium text-zinc-500 uppercase tracking-wide">{profile.role}</p>
                        <p className="text-sm font-semibold text-zinc-200 truncate">{profile.full_name ?? profile.email}</p>
                      </div>
                      <button
                        onClick={() => { navigate(dashboardPath); setUserMenuOpen(false); }}
                        className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-zinc-300 hover:bg-zinc-800 transition-colors"
                      >
                        <LayoutDashboard size={15} className="text-zinc-500" /> Dashboard
                      </button>
                      <button
                        onClick={() => { navigate(`${dashboardPath}/settings`); setUserMenuOpen(false); }}
                        className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-zinc-300 hover:bg-zinc-800 transition-colors"
                      >
                        <Settings size={15} className="text-zinc-500" /> Settings
                      </button>
                      <div className="border-t border-zinc-800 mt-1 pt-1">
                        <button
                          onClick={handleSignOut}
                          className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-red-400 hover:bg-red-950/50 transition-colors"
                        >
                          <LogOut size={15} /> Sign Out
                        </button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {userMenuOpen && (
                  <div className="fixed inset-0 z-40" onClick={() => setUserMenuOpen(false)} />
                )}
              </div>
            ) : (
              <div className="hidden md:flex items-center gap-2">
                <Button variant="ghost" size="sm" onClick={() => navigate('/login')}>
                  Sign In
                </Button>
                <Button variant="primary" size="sm" onClick={() => navigate('/signup')}>
                  Get Started
                </Button>
              </div>
            )}

            {/* Mobile menu toggle */}
            <button
              className="md:hidden p-2 rounded-lg hover:bg-zinc-800 transition-colors text-zinc-300"
              onClick={() => setMobileOpen(!mobileOpen)}
            >
              {mobileOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="md:hidden border-t border-zinc-800 bg-zinc-950 overflow-hidden"
          >
            <nav className="px-4 py-3 flex flex-col gap-1">
              <Link
                to="/services"
                className="px-3 py-2.5 rounded-lg text-sm font-medium text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 transition-colors"
                onClick={() => setMobileOpen(false)}
              >
                Services
              </Link>
              <Link
                to="/browse"
                className="px-3 py-2.5 rounded-lg text-sm font-medium text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 transition-colors"
                onClick={() => setMobileOpen(false)}
              >
                Find Providers
              </Link>
              {user ? (
                <>
                  <Link
                    to={dashboardPath}
                    className="px-3 py-2.5 rounded-lg text-sm font-medium text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 transition-colors"
                    onClick={() => setMobileOpen(false)}
                  >
                    Dashboard
                  </Link>
                  <button
                    onClick={() => { handleSignOut(); setMobileOpen(false); }}
                    className="px-3 py-2.5 rounded-lg text-sm font-medium text-red-400 hover:bg-red-950/50 transition-colors text-left"
                  >
                    Sign Out
                  </button>
                </>
              ) : (
                <>
                  <Link
                    to="/login"
                    className="px-3 py-2.5 rounded-lg text-sm font-medium text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 transition-colors"
                    onClick={() => setMobileOpen(false)}
                  >
                    Sign In
                  </Link>
                  <Link
                    to="/signup"
                    className="px-3 py-2.5 rounded-lg text-sm font-medium text-blue-400 hover:bg-blue-900/40 transition-colors"
                    onClick={() => setMobileOpen(false)}
                  >
                    Get Started
                  </Link>
                </>
              )}
            </nav>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
