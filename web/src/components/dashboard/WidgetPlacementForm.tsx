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

const DEFAULT_ACCENT = '#16a34a';
const fieldClass =
  'rounded-md border border-border bg-surface px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-violet focus:ring-2 focus:ring-violet/30 transition-colors';

export function WidgetPlacementForm(props: {
  initialPosition: string | null;
  initialSize: string | null;
  initialAccent: string | null;
  initialLabel: string | null;
  initialGreeting: string | null;
}) {
  const [position, setPosition] = useState(props.initialPosition ?? 'bottom-right');
  const [size, setSize] = useState(props.initialSize ?? 'medium');
  const [accent, setAccent] = useState(props.initialAccent ?? DEFAULT_ACCENT);
  const [label, setLabel] = useState(props.initialLabel ?? '');
  const [greeting, setGreeting] = useState(props.initialGreeting ?? '');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const clearSaved = () => setSaved(false);

  async function save() {
    setSaving(true);
    setSaved(false);
    setError(null);
    try {
      const res = await fetch('/api/settings/widget-position', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ position, size, accent, label, greeting }),
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
        <div className="grid gap-5 sm:grid-cols-2">
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium text-text-primary" htmlFor="widget-position">
              Placement
            </label>
            <select id="widget-position" value={position} onChange={(e) => { setPosition(e.target.value); clearSaved(); }} className={fieldClass}>
              {POSITIONS.map((p) => (
                <option key={p.value} value={p.value}>{p.label}</option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium text-text-primary" htmlFor="widget-size">
              Size
            </label>
            <select id="widget-size" value={size} onChange={(e) => { setSize(e.target.value); clearSaved(); }} className={fieldClass}>
              {SIZES.map((s) => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <label className="text-sm font-medium text-text-primary" htmlFor="widget-accent">
            Brand accent color
          </label>
          <p className="text-xs text-text-secondary">Used for the Call button, send button, and checkout CTA.</p>
          <div className="flex items-center gap-3">
            <input
              type="color"
              aria-label="Accent color picker"
              value={/^#([0-9a-f]{6})$/i.test(accent) ? accent : DEFAULT_ACCENT}
              onChange={(e) => { setAccent(e.target.value); clearSaved(); }}
              className="h-9 w-12 cursor-pointer rounded-md border border-border bg-surface p-1"
            />
            <input
              id="widget-accent"
              type="text"
              value={accent}
              onChange={(e) => { setAccent(e.target.value); clearSaved(); }}
              placeholder="#16a34a"
              className={`${fieldClass} w-32 font-mono`}
            />
            <span
              className="inline-block h-6 w-6 rounded-full border border-border"
              style={{ background: accent || DEFAULT_ACCENT }}
              aria-hidden="true"
            />
          </div>
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium text-text-primary" htmlFor="widget-label">
              Launcher label
            </label>
            <input
              id="widget-label"
              type="text"
              maxLength={40}
              value={label}
              onChange={(e) => { setLabel(e.target.value); clearSaved(); }}
              placeholder="Talk to your assistant"
              className={fieldClass}
            />
            <p className="text-xs text-text-muted">Leave blank to use “Talk to {'{name}'}”.</p>
          </div>
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium text-text-primary" htmlFor="widget-greeting">
              Launcher caption
            </label>
            <input
              id="widget-greeting"
              type="text"
              maxLength={40}
              value={greeting}
              onChange={(e) => { setGreeting(e.target.value); clearSaved(); }}
              placeholder="AI ASSISTANT"
              className={fieldClass}
            />
            <p className="text-xs text-text-muted">Small text under the name. Blank = default.</p>
          </div>
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
