'use client';
import * as React from 'react';
import { cn } from '@/lib/cn';

export function Dialog({
  open,
  onClose,
  children,
}: {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-black/40" onClick={onClose} />
      <div className={cn('relative z-10 w-full max-w-md rounded-lg bg-white p-6 shadow-lg')}>{children}</div>
    </div>
  );
}
