'use client';
import { useState } from 'react';
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
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function connectShopify() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/composio/connect-shopify', { method: 'POST' });
      const json = await res.json().catch(() => ({}));
      if (res.ok && json.auth_url) {
        window.location.href = json.auth_url;
        return;
      }
      // No auth_url (Composio not configured / errored): don't hang on
      // "Connecting…" — surface it and steer to the reliable store-URL path.
      setError(
        json.error === 'no merchant'
          ? 'Finish the earlier steps first, then try again.'
          : "Auto-connect is unavailable right now. Use “Any other site” on the right — paste your store URL (it works for Shopify too).",
      );
    } catch {
      setError('Auto-connect failed. Use the store-URL option on the right instead.');
    } finally {
      setLoading(false);
    }
  }
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Connect Shopify</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-text-secondary mb-4">
            Fastest path — auto-syncs your catalog and verifies install in one click.
          </p>
          <Button onClick={connectShopify} disabled={loading}>
            {loading ? 'Connecting…' : 'Connect Shopify'}
          </Button>
          {error && (
            <p className="text-sm text-rose-500 mt-3" role="alert" aria-live="polite">
              {error}
            </p>
          )}
          {!['pending', 'onboarding'].includes(status) && (
            <p className="text-xs text-text-secondary mt-3">
              Status: <code className="rounded bg-surface-muted px-1 py-0.5 font-mono text-text-primary">{status}</code>
            </p>
          )}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Any other site</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <p className="text-sm text-text-secondary">
            Works on Woo, Magento, BigCommerce, Wix, Squarespace, or a plain HTML site. We need your
            store URL to ingest your catalog and scope the agent to your domain.
          </p>
          <UrlForm merchantId={merchantId} />
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
      </CardContent>
    </Card>
  );
}
