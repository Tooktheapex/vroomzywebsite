import React from 'react';
import { motion } from 'framer-motion';
import { Header } from './Header';
import { Footer } from './Footer';

interface AppLayoutProps {
  children: React.ReactNode;
  hideFooter?: boolean;
}

export function AppLayout({ children, hideFooter = false }: AppLayoutProps) {
  return (
    <div className="min-h-screen flex flex-col bg-zinc-950">
      <Header />
      <motion.main
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25 }}
        className="flex-1"
      >
        {children}
      </motion.main>
      {!hideFooter && <Footer />}
    </div>
  );
}

interface DashboardLayoutProps {
  children: React.ReactNode;
  sidebar?: React.ReactNode;
  title?: string;
}

export function DashboardLayout({ children, sidebar, title }: DashboardLayoutProps) {
  return (
    <div className="min-h-screen bg-zinc-950">
      <Header />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {title && (
          <h1 className="text-2xl font-bold text-zinc-100 mb-8">{title}</h1>
        )}
        <div className="flex gap-8">
          {sidebar && <aside className="hidden lg:block w-56 shrink-0">{sidebar}</aside>}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
            className="flex-1 min-w-0"
          >
            {children}
          </motion.div>
        </div>
      </div>
    </div>
  );
}
