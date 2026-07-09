'use client';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
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

const STEPS = ['Account', 'Pay', 'Connect store', 'Install snippet'];

export function OnboardingWizard({ step, merchant }: { step: number; merchant: Merchant | null }) {
  return (
    <div className="max-w-2xl mx-auto py-8">
      <Progress current={step} />
      {step === 2 && <PayStep />}
      {step === 3 && merchant && <ConnectStep merchantId={merchant.id} status={merchant.status} />}
      {step === 4 && merchant && <InstallStep merchantId={merchant.id} />}
    </div>
  );
}

function Progress({ current }: { current: number }) {
  return (
    <div className="flex items-center gap-2 mb-6">
      <p className="text-sm text-text-secondary tabular-nums">{`Step ${current} of 4`}</p>
      <div className="flex flex-1 gap-1 ml-4">
        {STEPS.map((label, i) => {
          const idx = i + 1;
          return (
            <div
              key={label}
              className={cn('h-1.5 flex-1 rounded-full transition-colors', idx <= current ? 'bg-foreground' : 'bg-border')}
            />
          );
        })}
      </div>
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
    <Card>
      <CardHeader>
        <CardTitle>Start your $30/mo Starter plan</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <ul className="text-sm text-text-secondary list-disc pl-5 space-y-1 marker:text-violet">
          <li>100 conversations / month included</li>
          <li>Cross-platform widget (Shopify, Woo, Magento, BC, Wix, Squarespace, custom)</li>
          <li>Brand Knowledge base + persona settings</li>
          <li>Lead webhook + Stripe Customer Portal billing</li>
        </ul>
        <Button size="lg" onClick={go} disabled={loading}>
          {loading ? 'Redirecting…' : 'Start Starter plan'}
        </Button>
      </CardContent>
    </Card>
  );
}

function ConnectStep({ merchantId, status }: { merchantId: string; status: string }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Connect your store</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <p className="text-sm text-text-secondary">
          Works on <strong>Shopify</strong>, WooCommerce, Magento, BigCommerce, Wix, Squarespace, or
          any website. Enter your store URL — we auto-detect the platform, sync your catalog, and
          scope the assistant to your domain.
        </p>
        <UrlForm merchantId={merchantId} />
        <p className="text-xs text-text-muted">
          On Shopify you finish by pasting a one-line snippet into your theme (next step). No app
          install or access token required.
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
      <input
        className="rounded-md border border-border bg-surface px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-violet focus:ring-2 focus:ring-violet/30 transition-colors"
        placeholder="https://yourstore.com"
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        required
      />
      <Button type="submit" disabled={loading}>
        {loading ? 'Working…' : 'Continue to install'}
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

  return (
    <Card>
      <CardHeader>
        <CardTitle>Install your widget</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <pre className="bg-foreground text-background text-xs font-mono rounded-md p-4 overflow-x-auto border border-border">{snippet}</pre>
        <div className="flex gap-2 flex-wrap items-center">
          <Button onClick={() => navigator.clipboard.writeText(snippet)}>Copy</Button>
          <Button variant="outline" onClick={verify} disabled={verifying}>
            {verifying ? 'Checking…' : "I've pasted it"}
          </Button>
          <a href="/app" className="ml-auto text-sm text-text-secondary underline-offset-4 hover:underline self-center">
            I&apos;ll do this later
          </a>
        </div>
        {result === 'fail' && (
          <p className="text-sm text-rose-500" role="alert" aria-live="polite">
            We couldn&apos;t find the script tag yet. Make sure it&apos;s deployed and try again.
          </p>
        )}
        <DomainsManager />
      </CardContent>
    </Card>
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
    <div className="rounded-md border border-border p-4 flex flex-col gap-3">
      <div>
        <p className="text-sm font-medium text-text-primary">Allowed domains</p>
        <p className="text-xs text-text-secondary">
          Every domain your storefront runs on (add your custom domain AND your
          .myshopify.com). The assistant only loads on these.
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
        <input
          className="flex-1 rounded-md border border-border bg-surface px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-violet focus:ring-2 focus:ring-violet/30 transition-colors"
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
