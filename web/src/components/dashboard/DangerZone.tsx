'use client';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';

export function DangerZone({ merchantId }: { merchantId: string }) {
  const [confirmText, setConfirmText] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function deleteAccount() {
    setSubmitting(true);
    const res = await fetch('/api/account/delete', { method: 'POST' });
    if (res.ok) window.location.href = '/';
    setSubmitting(false);
  }

  return (
    <Card className="border-rose-500/30">
      <CardHeader><CardTitle className="text-rose-500">Danger zone</CardTitle></CardHeader>
      <CardContent className="flex flex-col gap-3">
        <p className="text-sm text-text-secondary">Cancels Stripe subscription, revokes Composio connections, soft-deletes your merchant. Type <code className="rounded bg-surface-muted px-1 py-0.5 font-mono text-xs text-text-primary">{merchantId}</code> to confirm.</p>
        <Input value={confirmText} onChange={(e) => setConfirmText(e.target.value)} placeholder={merchantId} />
        <Button variant="destructive" disabled={confirmText !== merchantId || submitting} onClick={deleteAccount}>
          {submitting ? 'Deleting…' : 'Delete account'}
        </Button>
      </CardContent>
    </Card>
  );
}
