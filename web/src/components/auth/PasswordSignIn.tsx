'use client';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

// Password sign-in for accounts we set up ourselves (e.g. a payment-gateway
// reviewer's demo login). Brand owners sign in with a magic link above.
export function PasswordSignIn({ callbackURL }: { callbackURL: string }) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-center text-sm text-text-muted underline-offset-4 hover:text-text-secondary hover:underline"
      >
        Have a password? Sign in with password
      </button>
    );
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/auth/sign-in/email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, callbackURL }),
      });
      if (!res.ok) throw new Error('That email and password don’t match.');
      window.location.assign(callbackURL);
    } catch (err) {
      setError((err as Error).message);
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-3 rounded-xl border border-border p-4" aria-label="Sign in with password">
      <label htmlFor="pw-email" className="text-sm font-medium text-text-secondary">
        Email
      </label>
      <Input id="pw-email" type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required />
      <label htmlFor="pw-password" className="text-sm font-medium text-text-secondary">
        Password
      </label>
      <Input
        id="pw-password"
        type="password"
        autoComplete="current-password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        required
      />
      {error && (
        <p className="text-sm text-rose-500" role="alert" aria-live="polite">
          {error}
        </p>
      )}
      <Button type="submit" variant="outline" disabled={loading}>
        {loading ? 'Signing in…' : 'Sign in'}
      </Button>
    </form>
  );
}
