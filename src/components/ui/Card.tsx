import React from 'react';
import { motion } from 'framer-motion';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  hover?: boolean;
  onClick?: () => void;
  padding?: 'sm' | 'md' | 'lg' | 'none';
}

const paddingMap = {
  none: '',
  sm: 'p-4',
  md: 'p-6',
  lg: 'p-8',
};

export function Card({ children, className = '', hover = false, onClick, padding = 'md' }: CardProps) {
  const base = `bg-zinc-900 rounded-2xl border border-zinc-800 shadow-sm ${paddingMap[padding]}`;

  if (hover || onClick) {
    return (
      <motion.div
        whileHover={{ y: -2, boxShadow: '0 8px 30px rgba(0,0,0,0.40)' }}
        transition={{ duration: 0.2 }}
        className={`${base} ${onClick ? 'cursor-pointer' : ''} ${className}`}
        onClick={onClick}
      >
        {children}
      </motion.div>
    );
  }

  return <div className={`${base} ${className}`}>{children}</div>;
}
