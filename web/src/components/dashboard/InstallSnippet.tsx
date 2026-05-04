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
        <pre className="bg-zinc-900 text-zinc-100 text-xs rounded-md p-4 overflow-x-auto">{snippet}</pre>
        <div className="flex gap-2 items-center">
          <Button onClick={() => navigator.clipboard.writeText(snippet)}>Copy</Button>
          <Button variant="outline" onClick={verify} disabled={verifying}>{verifying ? 'Checking…' : 'Re-verify'}</Button>
          <span className="text-xs text-zinc-500">
            Last ping: {lastPing ? new Date(lastPing).toLocaleString() : 'never'}
          </span>
        </div>
        {result === 'ok' && <p className="text-xs text-emerald-700">Widget detected.</p>}
        {result === 'fail' && <p className="text-xs text-red-700">Widget not detected.</p>}
      </CardContent>
    </Card>
  );
}
