'use client';
import { useEffect, useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

function ago(d: Date): string {
  const s = Math.floor((Date.now() - d.getTime()) / 1000);
  if (s < 90) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

export function InstallSnippet({ merchantId, lastPing }: { merchantId: string; lastPing: Date | null }) {
  const cdnBase = process.env.NEXT_PUBLIC_WIDGET_CDN_BASE || 'https://shoppingmate-web.vercel.app';
  const snippet = `<script async src="${cdnBase}/widget/v1.js" data-id="${merchantId}"></script>`;
  const [verifying, setVerifying] = useState(false);
  const [result, setResult] = useState<'ok' | 'fail' | null>(null);
  const [copied, setCopied] = useState(false);
  // Time-dependent text is computed only in the browser: formatting it during
  // SSR (server UTC vs the owner's timezone) caused a hydration mismatch that
  // re-rendered the whole document and dropped the dark theme.
  const [seen, setSeen] = useState<string | null>(null);
  useEffect(() => {
    setSeen(lastPing ? ago(new Date(lastPing)) : 'never');
  }, [lastPing]);

  async function verify() {
    setVerifying(true);
    const res = await fetch('/api/install/verify', { method: 'POST' });
    const json = await res.json();
    setResult(json.ok ? 'ok' : 'fail');
    setVerifying(false);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Your line</CardTitle>
        <p className="text-[13px] text-text-muted">
          Paste this into your site&apos;s header to put your assistant on every page. If your theme changes, paste it again.
        </p>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <pre className="overflow-x-auto rounded-xl border border-white/10 bg-[#0d0d12] p-4 font-mono text-xs leading-relaxed text-white/85">{snippet}</pre>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            onClick={() => {
              navigator.clipboard.writeText(snippet);
              setCopied(true);
              setTimeout(() => setCopied(false), 1800);
            }}
          >
            {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            {copied ? 'Copied' : 'Copy line'}
          </Button>
          <Button variant="outline" onClick={verify} disabled={verifying}>
            {verifying ? 'Checking…' : 'Check my site'}
          </Button>
          <span className="text-xs text-text-secondary">
            Last seen on your site: <span className="text-text-primary">{seen ?? '…'}</span>
          </span>
        </div>
        {result === 'ok' && <p className="text-[13px] text-signal">✓ Found it — your assistant is on your site.</p>}
        {result === 'fail' && (
          <p className="text-[13px] text-rose-500">We couldn&apos;t find the line on your site yet. Check it&apos;s pasted in the header, then try again.</p>
        )}
      </CardContent>
    </Card>
  );
}
