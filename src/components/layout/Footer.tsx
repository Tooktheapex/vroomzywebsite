import React from 'react';
import { Link } from 'react-router-dom';
import { BRAND_NAME, BRAND_COPYRIGHT } from '../../lib/brand';

export function Footer() {
  return (
    <footer className="bg-black text-zinc-500 border-t border-zinc-900">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          <div className="md:col-span-2">
            <Link to="/" className="flex items-center gap-2.5 mb-3">
              <img src="/ChatGPT_Image_Mar_10,_2026,_02_22_10_PM.png" alt="Vroomzy" className="w-10 h-10 object-contain" />
              <span className="text-lg font-bold text-white">{BRAND_NAME}</span>
            </Link>
            <p className="text-sm leading-relaxed max-w-sm">
              The trusted marketplace connecting car owners with automotive service professionals. Find detailers, mechanics, wrap shops, and more.
            </p>
          </div>
          <div>
            <h4 className="text-sm font-semibold text-zinc-300 mb-3">Marketplace</h4>
            <ul className="space-y-2">
              <li><Link to="/browse" className="text-sm hover:text-white transition-colors">Find Providers</Link></li>
              <li><Link to="/signup?role=provider" className="text-sm hover:text-white transition-colors">List Your Business</Link></li>
            </ul>
          </div>
          <div>
            <h4 className="text-sm font-semibold text-zinc-300 mb-3">Account</h4>
            <ul className="space-y-2">
              <li><Link to="/login" className="text-sm hover:text-white transition-colors">Sign In</Link></li>
              <li><Link to="/signup" className="text-sm hover:text-white transition-colors">Get Started</Link></li>
            </ul>
          </div>
        </div>
        <div className="border-t border-zinc-900 mt-10 pt-6 text-xs text-center">
          {BRAND_COPYRIGHT}
        </div>
      </div>
    </footer>
  );
}
