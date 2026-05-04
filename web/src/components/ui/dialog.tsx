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
      <div className="fixed inset-0 bg-foreground/50 backdrop-blur-sm" onClick={onClose} />
      <div
        className={cn(
          'relative z-10 w-full max-w-md rounded-2xl border border-border bg-surface-elevated p-6 shadow-[var(--shadow-lg)]',
        )}
      >
        {children}
      </div>
    </div>
  );
}
