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
      <p className="text-sm text-zinc-500">Step {current} of 4</p>
      <div className="flex flex-1 gap-1 ml-4">
        {STEPS.map((label, i) => {
          const idx = i + 1;
          return (
            <div
              key={label}
              className={cn('h-1.5 flex-1 rounded-full', idx <= current ? 'bg-zinc-900' : 'bg-zinc-200')}
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
        <ul className="text-sm text-zinc-700 list-disc pl-5 space-y-1">
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
  async function connectShopify() {
    setLoading(true);
    const res = await fetch('/api/composio/connect-shopify', { method: 'POST' });
    const json = await res.json();
    if (json.auth_url) window.location.href = json.auth_url;
  }
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Connect Shopify</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-zinc-600 mb-4">Fastest, 30 seconds.</p>
          <Button onClick={connectShopify} disabled={loading}>
            {loading ? 'Connecting…' : 'Connect'}
          </Button>
          {!['pending', 'onboarding'].includes(status) && (
            <p className="text-xs text-zinc-500 mt-3">
              Status: <code>{status}</code>
            </p>
          )}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Use any other store URL</CardTitle>
        </CardHeader>
        <CardContent>
          <UrlForm merchantId={merchantId} />
        </CardContent>
      </Card>
    </div>
  );
}

function UrlForm({ merchantId }: { merchantId: string }) {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  async function go(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    await fetch('/api/install/start-url', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ merchantId, url }),
    });
    window.location.reload();
  }
  return (
    <form onSubmit={go} className="flex flex-col gap-2">
      <input
        className="border border-zinc-200 rounded-md px-3 py-2 text-sm"
        placeholder="https://yourstore.com"
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        required
      />
      <Button type="submit" variant="outline" disabled={loading}>
        {loading ? 'Working…' : 'Submit'}
      </Button>
    </form>
  );
}

function InstallStep({ merchantId }: { merchantId: string }) {
  const snippet = `<script async src="https://cdn.shoppingmate.ai/widget/v1.js" data-id="${merchantId}"></script>`;
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
        <pre className="bg-zinc-900 text-zinc-100 text-xs rounded-md p-4 overflow-x-auto">{snippet}</pre>
        <div className="flex gap-2">
          <Button onClick={() => navigator.clipboard.writeText(snippet)}>Copy</Button>
          <Button variant="outline" onClick={verify} disabled={verifying}>
            {verifying ? 'Checking…' : "I've pasted it"}
          </Button>
          <a href="/app" className="ml-auto text-sm text-zinc-500 underline self-center">
            I&apos;ll do this later
          </a>
        </div>
        {result === 'fail' && (
          <p className="text-sm text-red-600">
            We couldn&apos;t find the script tag yet. Make sure it&apos;s deployed and try again.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
