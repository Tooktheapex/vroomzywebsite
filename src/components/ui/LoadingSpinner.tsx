import React from 'react';

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const sizeMap = { sm: 'h-4 w-4', md: 'h-8 w-8', lg: 'h-12 w-12' };

export function LoadingSpinner({ size = 'md', className = '' }: LoadingSpinnerProps) {
  return (
    <svg
      className={`animate-spin text-blue-400 ${sizeMap[size]} ${className}`}
      viewBox="0 0 24 24"
      fill="none"
    >
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}

export function PageLoader() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-950">
      <div className="flex flex-col items-center gap-3">
        <LoadingSpinner size="lg" />
        <p className="text-sm text-zinc-500">Loading...</p>
      </div>
    </div>
  );
}

export function CardSkeleton() {
  return (
    <div className="bg-zinc-900 rounded-2xl border border-zinc-800 p-6 animate-pulse">
      <div className="h-4 bg-zinc-700 rounded w-3/4 mb-3" />
      <div className="h-3 bg-zinc-700 rounded w-1/2 mb-6" />
      <div className="h-3 bg-zinc-700 rounded w-full mb-2" />
      <div className="h-3 bg-zinc-700 rounded w-5/6" />
    </div>
  );
}
