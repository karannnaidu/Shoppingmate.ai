'use client';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { GoogleSignInButton } from '@/components/auth/GoogleSignInButton';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    await fetch('/api/auth/sign-in/magic-link', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, callbackURL: '/app' }),
    });
    setSent(true);
    setLoading(false);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Sign in to shoppingmate</CardTitle>
        <CardDescription>Continue with Google or get a magic link.</CardDescription>
      </CardHeader>
      <CardContent>
        {sent ? (
          <p className="text-sm text-text-secondary">
            Check your inbox at <strong className="text-text-primary">{email}</strong>.
          </p>
        ) : (
          <div className="flex flex-col gap-4">
            <GoogleSignInButton callbackURL="/app" label="Continue with Google" />
            <div className="flex items-center gap-3 text-xs text-text-muted">
              <span className="h-px flex-1 bg-border" />
              or
              <span className="h-px flex-1 bg-border" />
            </div>
            <form onSubmit={onSubmit} className="flex flex-col gap-3">
              <Input
                type="email"
                placeholder="you@brand.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
              <Button type="submit" disabled={loading}>
                {loading ? 'Sending…' : 'Send link'}
              </Button>
            </form>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
