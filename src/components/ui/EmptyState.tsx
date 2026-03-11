import React from 'react';
import { motion } from 'framer-motion';

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col items-center justify-center py-16 px-6 text-center"
    >
      {icon && (
        <div className="w-14 h-14 rounded-2xl bg-zinc-800 flex items-center justify-center text-zinc-500 mb-4">
          {icon}
        </div>
      )}
      <h3 className="text-base font-semibold text-zinc-200 mb-1">{title}</h3>
      {description && <p className="text-sm text-zinc-500 max-w-sm mb-6">{description}</p>}
      {action}
    </motion.div>
  );
}
