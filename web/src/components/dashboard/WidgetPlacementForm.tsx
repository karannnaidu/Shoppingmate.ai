'use client';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const POSITIONS = [
  { value: 'bottom-right', label: 'Bottom right (default)' },
  { value: 'bottom-left', label: 'Bottom left' },
  { value: 'bottom-center', label: 'Bottom center' },
  { value: 'center-left', label: 'Middle left' },
  { value: 'center-right', label: 'Middle right' },
  { value: 'center', label: 'Center' },
  { value: 'top-right', label: 'Top right' },
  { value: 'top-left', label: 'Top left' },
] as const;

export function WidgetPlacementForm({ initial }: { initial: string | null }) {
  const [position, setPosition] = useState<string>(initial ?? 'bottom-right');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setSaving(true);
    setSaved(false);
    setError(null);
    try {
      const res = await fetch('/api/settings/widget-position', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ position }),
      });
      const json = await res.json().catch(() => ({}));
      if (res.ok) setSaved(true);
      else setError(typeof json.error === 'string' ? json.error : 'Could not save.');
    } catch {
      setError('Could not save — please try again.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Widget placement</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <p className="text-sm text-text-secondary">
          Where the assistant launcher first appears on your store. Visitors can still drag it — their
          choice is remembered in their browser. Changes apply on the next page load.
        </p>
        <select
          value={position}
          onChange={(e) => {
            setPosition(e.target.value);
            setSaved(false);
          }}
          className="max-w-xs rounded-md border border-border bg-surface px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-violet focus:ring-2 focus:ring-violet/30 transition-colors"
        >
          {POSITIONS.map((p) => (
            <option key={p.value} value={p.value}>
              {p.label}
            </option>
          ))}
        </select>
        <div className="flex items-center gap-3">
          <Button onClick={save} disabled={saving}>
            {saving ? 'Saving…' : 'Save'}
          </Button>
          {saved && (
            <span className="text-sm text-emerald-500" role="status" aria-live="polite">
              Saved — reload your store to see it.
            </span>
          )}
          {error && (
            <span className="text-sm text-rose-500" role="alert" aria-live="polite">
              {error}
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
