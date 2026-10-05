'use client';
import { useState } from 'react';
import { Button } from '@/components/ui/button';

// "Ask about your store" — plain questions, answered only from the store's numbers.
export function AskBox({ qa }: { qa: boolean }) {
  const [q, setQ] = useState('');
  const [answer, setAnswer] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const examples = ['Why are people leaving my product pages?', 'Which product do people look at but not buy?', 'Is my site slow on phones?'];

  async function ask(question: string) {
    if (!question.trim()) return;
    setBusy(true);
    setAnswer(null);
    try {
      const r = await fetch('/api/insights/ask', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ question, qa }),
      });
      const j = (await r.json()) as { answer?: string; error?: string };
      setAnswer(j.answer ?? 'Sorry — I could not answer that right now. Try again in a moment.');
    } catch {
      setAnswer('Sorry — I could not answer that right now. Try again in a moment.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-lg border border-border bg-surface p-5">
      <h2 className="font-display text-lg font-semibold text-text-primary">Ask about your store</h2>
      <form
        className="mt-3 flex flex-col gap-2 sm:flex-row"
        onSubmit={(e) => {
          e.preventDefault();
          void ask(q);
        }}
      >
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="e.g. Why did sales drop on Tuesday?"
          className="h-10 flex-1 rounded-md border border-border bg-background px-3 text-sm text-text-primary placeholder:text-text-secondary"
        />
        <Button type="submit" disabled={busy}>
          {busy ? 'Thinking…' : 'Ask'}
        </Button>
      </form>
      <div className="mt-2 flex flex-wrap gap-2">
        {examples.map((e) => (
          <button
            key={e}
            type="button"
            onClick={() => {
              setQ(e);
              void ask(e);
            }}
            className="rounded-full border border-border px-3 py-1 text-xs text-text-secondary hover:text-text-primary"
          >
            {e}
          </button>
        ))}
      </div>
      {answer && <p className="mt-4 whitespace-pre-line text-sm leading-relaxed text-text-primary">{answer}</p>}
    </div>
  );
}
