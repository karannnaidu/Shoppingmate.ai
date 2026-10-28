'use client';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { saveCareSettings } from '@/app/app/settings/actions';

// Customer Care PRD: complaints, returns, cancellations, tracking and feedback.
export function CustomerCareForm({ initialEmail, ownerEmail, brand }: { initialEmail: string | null; ownerEmail: string; brand: string }) {
  const [email, setEmail] = useState(initialEmail ?? '');
  const [saved, setSaved] = useState(false);
  return (
    <Card id="customer-care">
      <CardHeader><CardTitle>Customer care</CardTitle></CardHeader>
      <CardContent>
        <form
          action={async (fd) => {
            await saveCareSettings(fd);
            setSaved(true);
          }}
          className="flex flex-col gap-3"
        >
          <label className="text-sm font-medium" htmlFor="supportEmail">Support email</label>
          <Input
            id="supportEmail"
            name="supportEmail"
            type="email"
            placeholder={ownerEmail}
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              setSaved(false);
            }}
          />
          <p className="text-xs text-text-secondary">
            When a customer raises a complaint, return, cancellation or tracking request, we email them a confirmation from
            “{brand} Care”. Their replies come to this address{email ? '' : ` (empty = ${ownerEmail})`}.
          </p>
          <div className="flex items-center gap-3">
            <Button type="submit">Save</Button>
            {saved && <span className="text-sm text-emerald-500">Saved</span>}
          </div>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-text-secondary">
            <li>Returns and cancellations are requests: your team approves them and contacts the customer.</li>
            <li>Customers can attach up to 3 photos as proof. Photos are private to your team and deleted after 180 days.</li>
          </ul>
        </form>
      </CardContent>
    </Card>
  );
}
