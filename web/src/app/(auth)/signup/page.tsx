'use client';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function SignupPage() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/auth/sign-in/magic-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, callbackURL: '/app/onboarding' }),
      });
      if (!res.ok) throw new Error('Failed to send magic link');
      setSent(true);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Start with shoppingmate</CardTitle>
        <CardDescription>
          Start your $30/mo Starter plan. Magic-link sign-up — no password.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {sent ? (
          <p className="text-sm text-text-secondary">
            Check your inbox at{' '}
            <strong className="text-text-primary">{email}</strong> for a sign-in link.
          </p>
        ) : (
          <form onSubmit={onSubmit} className="flex flex-col gap-3">
            <Input
              type="email"
              placeholder="you@brand.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            {error && (
              <p className="text-sm text-rose-500" role="alert" aria-live="polite">
                {error}
              </p>
            )}
            <Button type="submit" disabled={loading}>
              {loading ? 'Sending…' : 'Sign up'}
            </Button>
            <p className="text-xs text-text-muted">
              By continuing you agree to our Terms.
            </p>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
