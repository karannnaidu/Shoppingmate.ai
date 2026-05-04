'use client';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export function InstallSnippet({ merchantId, lastPing }: { merchantId: string; lastPing: Date | null }) {
  const snippet = `<script async src="https://cdn.shoppingmate.ai/widget/v1.js" data-id="${merchantId}"></script>`;
  const [verifying, setVerifying] = useState(false);
  const [result, setResult] = useState<'ok' | 'fail' | null>(null);

  async function verify() {
    setVerifying(true);
    const res = await fetch('/api/install/verify', { method: 'POST' });
    const json = await res.json();
    setResult(json.ok ? 'ok' : 'fail');
    setVerifying(false);
  }

  return (
    <Card>
      <CardHeader><CardTitle>Install snippet</CardTitle></CardHeader>
      <CardContent className="flex flex-col gap-3">
        <pre className="bg-foreground text-background text-xs font-mono rounded-md p-4 overflow-x-auto border border-border">{snippet}</pre>
        <div className="flex gap-2 items-center flex-wrap">
          <Button onClick={() => navigator.clipboard.writeText(snippet)}>Copy</Button>
          <Button variant="outline" onClick={verify} disabled={verifying}>{verifying ? 'Checking…' : 'Re-verify'}</Button>
          <span className="text-xs text-text-secondary">
            Last ping: <span className="text-text-primary">{lastPing ? new Date(lastPing).toLocaleString() : 'never'}</span>
          </span>
        </div>
        {result === 'ok' && <p className="text-xs text-emerald-500">Widget detected.</p>}
        {result === 'fail' && <p className="text-xs text-rose-500">Widget not detected.</p>}
      </CardContent>
    </Card>
  );
}
