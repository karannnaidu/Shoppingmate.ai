'use client';
import { useState } from 'react';
import Link from 'next/link';
import { MailCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { GoogleSignInButton } from '@/components/auth/GoogleSignInButton';

// Shared magic-link form for /login and /signup (same endpoint, different
// copy + callback). Includes a clear "check your inbox" state with resend.
export function MagicLinkForm({
  mode,
  callbackURL,
}: {
  mode: 'login' | 'signup';
  callbackURL: string;
}) {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [resent, setResent] = useState(false);
  const google = process.env.NEXT_PUBLIC_GOOGLE_ENABLED === 'true';

  async function send() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/auth/sign-in/magic-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, callbackURL }),
      });
      if (!res.ok) throw new Error("We couldn't send the link. Check the address and try again.");
      return true;
    } catch (err) {
      setError((err as Error).message);
      return false;
    } finally {
      setLoading(false);
    }
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (await send()) setSent(true);
  }

  if (sent) {
    return (
      <div className="text-center">
        <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-signal-soft text-signal">
          <MailCheck className="tick-pop h-6 w-6" />
        </div>
        <h1 className="mt-6 font-display text-3xl font-semibold tracking-[-0.03em]">Check your inbox</h1>
        <p className="mt-3 text-[15px] leading-relaxed text-text-secondary">
          We sent a sign-in link to <strong className="text-text-primary">{email}</strong>. It works once and expires
          soon — open it on this device.
        </p>
        <div className="mt-7 flex flex-col items-center gap-2">
          <Button
            variant="outline"
            disabled={loading || resent}
            onClick={async () => {
              if (await send()) setResent(true);
            }}
          >
            {resent ? 'Sent again ✓' : loading ? 'Sending…' : 'Send it again'}
          </Button>
          <button
            type="button"
            onClick={() => {
              setSent(false);
              setResent(false);
            }}
            className="text-sm text-text-muted underline-offset-4 hover:text-text-secondary hover:underline"
          >
            Use a different email
          </button>
          {error && (
            <p className="text-sm text-rose-500" role="alert">
              {error}
            </p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div>
      <h1 className="font-display text-[2rem] font-semibold leading-tight tracking-[-0.035em]">
        {mode === 'login' ? (
          <>
            Welcome <span className="serif-em">back.</span>
          </>
        ) : (
          <>
            Put Olivia on <span className="serif-em">your store.</span>
          </>
        )}
      </h1>
      <p className="mt-2.5 text-[15px] text-text-secondary">
        {mode === 'login'
          ? "Enter your email and we'll send you a link to sign in — no password."
          : 'Create your account with just your email — no password. Plans start at $30/month; you choose yours inside.'}
      </p>

      <div className="mt-8 flex flex-col gap-4">
        {google && (
          <>
            <GoogleSignInButton callbackURL={callbackURL} label="Continue with Google" />
            <div className="flex items-center gap-3 text-xs text-text-muted">
              <span className="h-px flex-1 bg-border" />
              or with email
              <span className="h-px flex-1 bg-border" />
            </div>
          </>
        )}
        <form onSubmit={onSubmit} className="flex flex-col gap-3">
          <label htmlFor="email" className="text-sm font-medium text-text-secondary">
            Work email
          </label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            placeholder="you@yourbrand.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          {error && (
            <p className="text-sm text-rose-500" role="alert" aria-live="polite">
              {error}
            </p>
          )}
          <Button type="submit" size="lg" disabled={loading} className="mt-1">
            {loading ? 'Sending…' : mode === 'login' ? 'Email me a sign-in link' : 'Create my account'}
          </Button>
        </form>
        <p className="text-center text-sm text-text-muted">
          {mode === 'login' ? (
            <>
              New here?{' '}
              <Link href="/signup" className="font-medium text-text-primary underline-offset-4 hover:underline">
                Create an account
              </Link>
            </>
          ) : (
            <>
              Already have an account?{' '}
              <Link href="/login" className="font-medium text-text-primary underline-offset-4 hover:underline">
                Log in
              </Link>
            </>
          )}
        </p>
        {mode === 'signup' && (
          <p className="text-center text-xs text-text-muted">
            By continuing you agree to our{' '}
            <a href="/legal/privacy" className="underline underline-offset-2 hover:text-text-secondary">
              Privacy Policy
            </a>
            .
          </p>
        )}
      </div>
    </div>
  );
}
