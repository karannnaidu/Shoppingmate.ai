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

const SIZES = [
  { value: 'small', label: 'Small' },
  { value: 'medium', label: 'Medium (default)' },
  { value: 'large', label: 'Large' },
] as const;

const selectClass =
  'max-w-xs rounded-md border border-border bg-surface px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-violet focus:ring-2 focus:ring-violet/30 transition-colors';

export function WidgetPlacementForm({
  initialPosition,
  initialSize,
}: {
  initialPosition: string | null;
  initialSize: string | null;
}) {
  const [position, setPosition] = useState<string>(initialPosition ?? 'bottom-right');
  const [size, setSize] = useState<string>(initialSize ?? 'medium');
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
        body: JSON.stringify({ position, size }),
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
        <CardTitle>Widget appearance</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        <div className="flex flex-col gap-2">
          <label className="text-sm font-medium text-text-primary" htmlFor="widget-position">
            Placement
          </label>
          <p className="text-xs text-text-secondary">
            Where the assistant launcher first appears. Visitors can still drag it; on mobile it
            auto-shrinks. Changes apply on the next page load.
          </p>
          <select
            id="widget-position"
            value={position}
            onChange={(e) => {
              setPosition(e.target.value);
              setSaved(false);
            }}
            className={selectClass}
          >
            {POSITIONS.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-2">
          <label className="text-sm font-medium text-text-primary" htmlFor="widget-size">
            Size
          </label>
          <p className="text-xs text-text-secondary">
            How large the launcher is on desktop. Mobile is always compact.
          </p>
          <select
            id="widget-size"
            value={size}
            onChange={(e) => {
              setSize(e.target.value);
              setSaved(false);
            }}
            className={selectClass}
          >
            {SIZES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </div>

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
