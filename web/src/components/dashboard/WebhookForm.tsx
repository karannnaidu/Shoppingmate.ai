'use client';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { saveWebhook } from '@/app/app/settings/actions';

export function WebhookForm({ initial }: { initial: string | null }) {
  const [url, setUrl] = useState(initial ?? '');
  const [testResult, setTestResult] = useState<string | null>(null);

  async function testFire() {
    setTestResult(null);
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ event: 'test', email: 'test@example.com', merchant_id: 'TEST' }),
      });
      setTestResult(`Response: ${res.status} ${res.statusText}`);
    } catch (err) {
      setTestResult(`Error: ${(err as Error).message}`);
    }
  }

  return (
    <Card>
      <CardHeader><CardTitle>Lead webhook</CardTitle></CardHeader>
      <CardContent>
        <form action={saveWebhook} className="flex flex-col gap-3">
          <Input name="leadWebhookUrl" type="url" placeholder="https://your-crm.com/webhooks/shoppingmate" value={url} onChange={(e) => setUrl(e.target.value)} />
          <p className="text-xs text-zinc-500">We POST a JSON body when a conversation captures a lead.</p>
          <div className="flex gap-2">
            <Button type="submit">Save</Button>
            <Button type="button" variant="outline" onClick={testFire} disabled={!url}>Test fire</Button>
          </div>
          {testResult && <p className="text-xs text-zinc-700">{testResult}</p>}
        </form>
      </CardContent>
    </Card>
  );
}
