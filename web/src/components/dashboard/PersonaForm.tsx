'use client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { savePersona } from '@/app/app/settings/actions';

const VOICES = [
  { id: 'warm-brit', label: 'Warm Brit' },
  { id: 'energetic-nyc', label: 'Energetic NYC' },
  { id: 'calm-indian', label: 'Calm Indian' },
  { id: 'crisp-aussie', label: 'Crisp Aussie' },
  { id: 'friendly-texan', label: 'Friendly Texan' },
  { id: 'soft-french', label: 'Soft French' },
  { id: 'bright-tokyo', label: 'Bright Tokyo' },
  { id: 'deep-johannesburg', label: 'Deep Johannesburg' },
];

const TONE_LABELS = ['Formal', 'Professional', 'Neutral', 'Casual', 'Playful'];

type Persona = { voiceDescriptorId: string; brandVoiceNotes: string; toneValue: number };

export function PersonaForm({ initial }: { initial: Persona | null }) {
  return (
    <Card>
      <CardHeader><CardTitle>Persona</CardTitle></CardHeader>
      <CardContent>
        <form action={savePersona} className="flex flex-col gap-4">
          <label className="flex flex-col gap-1 text-sm">
            <span>Voice descriptor</span>
            <select name="voiceDescriptorId" defaultValue={initial?.voiceDescriptorId ?? VOICES[0].id} className="border rounded px-3 py-2">
              {VOICES.map((v) => <option key={v.id} value={v.id}>{v.label}</option>)}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span>Brand voice notes</span>
            <textarea name="brandVoiceNotes" maxLength={500} defaultValue={initial?.brandVoiceNotes ?? ''}
              className="border rounded px-3 py-2 min-h-24"
              placeholder="Speak warmly, never use exclamation marks. Address customers by their first name when known." />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span>Tone</span>
            <input type="range" name="toneValue" min={1} max={5} step={1} defaultValue={initial?.toneValue ?? 3} />
            <div className="flex justify-between text-xs text-zinc-500">
              {TONE_LABELS.map((t) => <span key={t}>{t}</span>)}
            </div>
          </label>
          <Button type="submit" className="self-start">Save persona</Button>
        </form>
      </CardContent>
    </Card>
  );
}
