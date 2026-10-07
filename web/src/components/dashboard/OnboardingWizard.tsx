'use client';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/cn';

type Merchant = {
  id: string;
  status: string;
  plan: string;
  billingStatus: string;
  persona: unknown;
  leadWebhookUrl: string | null;
  knowledgeBaseStatus: string;
  lastWidgetPing: Date | null;
};

const STEPS = ['Account', 'Plan', 'Your store', 'Go live'];

export function OnboardingWizard({ step, merchant }: { step: number; merchant: Merchant | null }) {
  return (
    <div className="mx-auto max-w-2xl py-4 md:py-8">
      <Progress current={step} />
      {step === 2 && <PayStep />}
      {step === 3 && merchant && <ConnectStep merchantId={merchant.id} status={merchant.status} />}
      {step === 4 && merchant && <InstallStep merchantId={merchant.id} />}
    </div>
  );
}

function Progress({ current }: { current: number }) {
  return (
    <div className="mb-8">
      <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-text-muted tabular-nums">{`Step ${current} of 4`}</p>
      <ol className="mt-3 grid grid-cols-4 gap-2">
        {STEPS.map((label, i) => {
          const idx = i + 1;
          const done = idx < current;
          const now = idx === current;
          return (
            <li key={label} className="flex flex-col gap-2">
              <span
                className={cn(
                  'h-1.5 rounded-full transition-colors',
                  done ? 'bg-signal' : now ? 'bg-foreground' : 'bg-border',
                )}
              />
              <span className={cn('text-xs', now ? 'font-medium text-text-primary' : 'text-text-muted')}>
                {done ? '✓ ' : ''}
                {label}
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function StepHeader({ title, body }: { title: React.ReactNode; body: string }) {
  return (
    <div className="mb-5">
      <h1 className="font-display text-[1.75rem] font-semibold leading-tight tracking-[-0.03em] text-text-primary">{title}</h1>
      <p className="mt-2 text-[15px] leading-relaxed text-text-secondary">{body}</p>
    </div>
  );
}

function PayStep() {
  const [loading, setLoading] = useState(false);
  async function go() {
    setLoading(true);
    const res = await fetch('/api/billing/checkout-session', { method: 'POST' });
    const json = await res.json();
    if (json.url) window.location.href = json.url;
    setLoading(false);
  }
  return (
    <div>
      <StepHeader
        title={
          <>
            Start your <span className="serif-em">Starter</span> plan
          </>
        }
        body="$30 a month for 100 shopper conversations — voice or chat. Cancel anytime, and move up a plan whenever you need more."
      />
      <Card>
        <CardContent className="flex flex-col gap-5 pt-6">
          <ul className="grid gap-2.5 text-[15px] text-text-secondary">
            {[
              '100 conversations a month — top up anytime at $0.30 each',
              'Works on Shopify, WooCommerce or any website',
              'Trained on your products, pages and documents',
              'Customer requests sent straight to your inbox',
            ].map((t) => (
              <li key={t} className="flex items-start gap-2.5">
                <span className="mt-0.5 grid h-4 w-4 flex-none place-items-center rounded-full bg-signal text-[10px] font-bold text-background">✓</span>
                {t}
              </li>
            ))}
          </ul>
          <Button size="lg" onClick={go} disabled={loading}>
            {loading ? 'Taking you to payment…' : 'Start Starter plan — $30/mo'}
          </Button>
          <p className="text-center text-xs text-text-muted">Secure payment by Razorpay. We never see your card details.</p>
        </CardContent>
      </Card>
    </div>
  );
}

function ConnectStep({ merchantId, status }: { merchantId: string; status: string }) {
  return (
    <div>
      <StepHeader
        title={
          <>
            Where&apos;s <span className="serif-em">your store?</span>
          </>
        }
        body="Enter your store's address. Olivia will read your products and pages from there — Shopify, WooCommerce or any website."
      />
    <Card>
      <CardContent className="flex flex-col gap-4 pt-6">
        <UrlForm merchantId={merchantId} />
        <p className="text-xs text-text-muted">
          Nothing to install from an app store and no passwords to share — next you&apos;ll paste one line into your site.
        </p>
        {!['pending', 'onboarding'].includes(status) && (
          <p className="text-xs text-text-secondary">
            Status:{' '}
            <code className="rounded bg-surface-muted px-1 py-0.5 font-mono text-text-primary">
              {status}
            </code>
          </p>
        )}
      </CardContent>
    </Card>
    </div>
  );
}

function UrlForm({ merchantId }: { merchantId: string }) {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function go(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const normalized = /^https?:\/\//i.test(url) ? url : `https://${url}`;
    const res = await fetch('/api/install/start-url', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ merchantId, url: normalized }),
    });
    setLoading(false);
    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      setError(json.error ?? `Couldn't save URL (status ${res.status}).`);
      return;
    }
    window.location.href = '/app/onboarding?step=4';
  }
  return (
    <form onSubmit={go} className="flex flex-col gap-2">
      <label htmlFor="store-url" className="text-sm font-medium text-text-secondary">
        Store address
      </label>
      <Input
        id="store-url"
        placeholder="yourstore.com"
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        required
      />
      <Button type="submit" size="lg" disabled={loading} className="mt-1">
        {loading ? 'Saving…' : 'Continue'}
      </Button>
      {error && (
        <p className="text-sm text-rose-500" role="alert" aria-live="polite">
          {error}
        </p>
      )}
    </form>
  );
}

function InstallStep({ merchantId }: { merchantId: string }) {
  const cdnBase = process.env.NEXT_PUBLIC_WIDGET_CDN_BASE || 'https://shoppingmate-web.vercel.app';
  const snippet = `<script async src="${cdnBase}/widget/v1.js" data-id="${merchantId}"></script>`;
  const [verifying, setVerifying] = useState(false);
  const [result, setResult] = useState<'idle' | 'ok' | 'fail'>('idle');

  async function verify() {
    setVerifying(true);
    const res = await fetch('/api/install/verify', { method: 'POST' });
    const json = await res.json();
    setResult(json.ok ? 'ok' : 'fail');
    setVerifying(false);
    if (json.ok) window.location.href = '/app';
  }

  const [copied, setCopied] = useState(false);
  return (
    <div>
      <StepHeader
        title={
          <>
            Paste one line. <span className="serif-em">You&apos;re live.</span>
          </>
        }
        body="Copy this line into your site's header (on Shopify: Online Store → Themes → Edit code → theme.liquid, just before </head>). Or send it to whoever manages your site."
      />
      <Card>
        <CardContent className="flex flex-col gap-4 pt-6">
          <pre className="overflow-x-auto rounded-xl border border-white/10 bg-[#0d0d12] p-4 font-mono text-xs leading-relaxed text-white/85">{snippet}</pre>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              onClick={() => {
                navigator.clipboard.writeText(snippet);
                setCopied(true);
                setTimeout(() => setCopied(false), 1800);
              }}
            >
              {copied ? '✓ Copied' : 'Copy line'}
            </Button>
            <Button variant="outline" onClick={verify} disabled={verifying}>
              {verifying ? 'Checking your site…' : "I've pasted it"}
            </Button>
            <a href="/app" className="ml-auto self-center text-sm text-text-secondary underline-offset-4 hover:underline">
              I&apos;ll do this later
            </a>
          </div>
          {result === 'fail' && (
            <p className="text-sm text-rose-500" role="alert" aria-live="polite">
              We couldn&apos;t find the line on your site yet. Check it&apos;s saved and published, then try again.
            </p>
          )}
          <DomainsManager />
        </CardContent>
      </Card>
    </div>
  );
}

// Lets the merchant whitelist every domain the widget runs on. This matters
// because the widget reports window.location.host and the API rejects any host
// not listed — a store on a custom domain (e.g. entered myshopify.com but serves
// on yourbrand.com) would otherwise be blocked.
function DomainsManager() {
  const [domains, setDomains] = useState<string[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const r = await fetch('/api/install/domains');
        const j = await r.json();
        if (active) setDomains(Array.isArray(j.domains) ? j.domains : []);
      } catch {
        /* ignore — merchant can still add domains manually */
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  async function save(next: string[]) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/install/domains', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ domains: next }),
      });
      const j = await res.json().catch(() => ({}));
      if (res.ok && Array.isArray(j.domains)) setDomains(j.domains);
      else setError(j.error ?? 'Could not save domains.');
    } catch {
      setError('Could not save domains.');
    } finally {
      setBusy(false);
    }
  }

  function add() {
    const v = input.trim();
    if (!v) return;
    setInput('');
    void save(Array.from(new Set([...domains, v])));
  }

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border bg-surface-muted/40 p-4">
      <div>
        <p className="text-sm font-medium text-text-primary">Your web addresses</p>
        <p className="text-xs text-text-secondary">
          Add every address your store opens on — your own domain and, on Shopify, your
          .myshopify.com address too. Olivia only appears on these.
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        {domains.length === 0 && (
          <span className="text-xs text-text-muted">No domains yet — add one below.</span>
        )}
        {domains.map((d) => (
          <span
            key={d}
            className="inline-flex items-center gap-1 rounded-full bg-surface-muted px-2 py-1 text-xs font-mono text-text-primary"
          >
            {d}
            <button
              type="button"
              aria-label={`Remove ${d}`}
              className="text-text-muted hover:text-rose-500 disabled:opacity-40"
              disabled={busy || domains.length <= 1}
              onClick={() => void save(domains.filter((x) => x !== d))}
            >
              ×
            </button>
          </span>
        ))}
      </div>
      <div className="flex gap-2">
        <Input
          className="flex-1"
          aria-label="Add a web address"
          placeholder="yourstore.com"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              add();
            }
          }}
        />
        <Button type="button" variant="outline" onClick={add} disabled={busy || !input.trim()}>
          Add
        </Button>
      </div>
      {error && (
        <p className="text-sm text-rose-500" role="alert" aria-live="polite">
          {error}
        </p>
      )}
    </div>
  );
}
