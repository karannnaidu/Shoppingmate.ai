'use client';
import { useActionState } from 'react';
import { Button } from '@/components/ui/button';
import { adminLogin } from '../actions';

const field =
  'h-11 w-full rounded-xl border border-border bg-surface-elevated px-3 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-violet focus:ring-2 focus:ring-violet/30';

export function AdminLoginForm() {
  const [state, action, pending] = useActionState(adminLogin, undefined);
  return (
    <form action={action} className="mt-6 flex flex-col gap-3">
      <label className="flex flex-col gap-1.5 text-sm font-medium">
        Email
        <input name="email" type="email" autoComplete="username" required defaultValue={state?.email ?? ''} className={field} />
      </label>
      <label className="flex flex-col gap-1.5 text-sm font-medium">
        Password
        <input name="password" type="password" autoComplete="current-password" required className={field} />
      </label>
      {state?.error && (
        <p role="alert" className="text-sm text-rose-500">
          {state.error}
        </p>
      )}
      <Button type="submit" disabled={pending} className="mt-1 h-11">
        {pending ? 'Signing in…' : 'Sign in'}
      </Button>
    </form>
  );
}
