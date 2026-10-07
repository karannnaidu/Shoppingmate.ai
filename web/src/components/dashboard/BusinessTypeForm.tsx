'use client';
import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { saveBusinessType } from '@/app/app/settings/actions';

type Option = { id: string; label: string; service: boolean };

/** Owner sets what kind of business this is; the assistant follows that
 *  category's rules (e.g. clinics: never diagnose, take appointment requests). */
export function BusinessTypeForm({
  options,
  current,
  detected,
}: {
  options: Option[];
  /** Saved choice, or '' for automatic. */
  current: string;
  detected: Option;
}) {
  const [value, setValue] = useState(current);
  const [saved, setSaved] = useState(false);
  const [pending, start] = useTransition();
  const effective = options.find((o) => o.id === value) ?? detected;
  const shops = options.filter((o) => !o.service);
  const services = options.filter((o) => o.service);

  return (
    <Card>
      <CardHeader><CardTitle>Your type of business</CardTitle></CardHeader>
      <CardContent>
        <form
          action={(fd) =>
            start(async () => {
              setSaved(false);
              await saveBusinessType(fd);
              setSaved(true);
            })
          }
          className="flex flex-col gap-4"
        >
          <p className="text-sm text-text-secondary">
            Your assistant follows the rules for this kind of business —{' '}
            {effective.service
              ? 'it takes appointment and booking requests for your team to confirm, and never confirms them itself.'
              : 'it recommends from your products and only states what your product pages say.'}
          </p>
          <label className="flex flex-col gap-1.5 text-sm text-text-primary">
            <span className="font-medium">Type of business</span>
            <select
              name="businessType"
              value={value}
              onChange={(e) => {
                setValue(e.target.value);
                setSaved(false);
              }}
              className="rounded-md border border-border bg-surface px-3 py-2 text-text-primary focus:outline-none focus:border-violet focus:ring-2 focus:ring-violet/30 transition-colors"
            >
              <option value="">Automatic — we think you’re: {detected.label}</option>
              <optgroup label="Sells products">
                {shops.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
              </optgroup>
              <optgroup label="Bookings & services">
                {services.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
              </optgroup>
            </select>
          </label>
          <div className="flex items-center gap-3">
            <Button type="submit" disabled={pending}>{pending ? 'Saving…' : 'Save'}</Button>
            {saved && <span className="text-sm text-text-secondary" role="status">Saved — your assistant uses this from the next conversation.</span>}
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
