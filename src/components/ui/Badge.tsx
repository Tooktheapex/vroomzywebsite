import React from 'react';

type BadgeVariant = 'default' | 'success' | 'warning' | 'danger' | 'info' | 'neutral';

interface BadgeProps {
  variant?: BadgeVariant;
  children: React.ReactNode;
  className?: string;
}

const variantClasses: Record<BadgeVariant, string> = {
  default: 'bg-blue-900/50 text-blue-300 border border-blue-800',
  success: 'bg-emerald-900/50 text-emerald-300 border border-emerald-800',
  warning: 'bg-amber-900/50 text-amber-300 border border-amber-800',
  danger: 'bg-red-900/50 text-red-300 border border-red-800',
  info: 'bg-sky-900/50 text-sky-300 border border-sky-800',
  neutral: 'bg-zinc-800 text-zinc-400 border border-zinc-700',
};

export function Badge({ variant = 'default', children, className = '' }: BadgeProps) {
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${variantClasses[variant]} ${className}`}>
      {children}
    </span>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { variant: BadgeVariant; label: string }> = {
    draft: { variant: 'neutral', label: 'Draft' },
    pending_approval: { variant: 'warning', label: 'Pending Review' },
    approved: { variant: 'success', label: 'Approved' },
    rejected: { variant: 'danger', label: 'Rejected' },
    suspended: { variant: 'danger', label: 'Suspended' },
    new: { variant: 'info', label: 'New' },
    viewed: { variant: 'warning', label: 'Viewed' },
    contacted: { variant: 'success', label: 'Contacted' },
    closed: { variant: 'neutral', label: 'Closed' },
    spam: { variant: 'danger', label: 'Spam' },
    inactive: { variant: 'neutral', label: 'Inactive' },
    active: { variant: 'success', label: 'Active' },
    trialing: { variant: 'info', label: 'Trial' },
    past_due: { variant: 'danger', label: 'Past Due' },
    canceled: { variant: 'neutral', label: 'Canceled' },
  };
  const entry = map[status] ?? { variant: 'neutral', label: status };
  return <Badge variant={entry.variant}>{entry.label}</Badge>;
}
