import * as React from 'react';
import { cn } from '@/lib/cn';

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      className={cn(
        'flex h-11 w-full rounded-xl border border-border bg-surface-elevated px-3.5 py-2 text-[15px] text-text-primary shadow-[inset_0_1px_2px_rgba(0,0,0,0.04)] placeholder:text-text-muted transition-colors hover:border-border-strong focus:outline-none focus:border-violet focus:ring-4 focus:ring-violet/15',
        className,
      )}
      {...props}
    />
  ),
);
Input.displayName = 'Input';
