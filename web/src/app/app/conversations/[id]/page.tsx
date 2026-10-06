import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { getDashboardSession } from '@/lib/session';
import type * as React from 'react';
import { getConversation, getConversationActions, type ConversationDetail } from '@/lib/conversations-repo';
import { buildTimeline, type TimelineStep } from '@/lib/action-timeline';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default async function ConversationDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const hdrs = await headers();
  const session = await getDashboardSession({ headers: hdrs });
  if (!session?.merchant) redirect('/app/onboarding?step=2');

  const [convo, actions] = await Promise.all([
    getConversation({ merchantId: session.merchant.id, sessionId: id }),
    getConversationActions({ merchantId: session.merchant.id, sessionId: id }).catch(() => []),
  ]);
  const steps = buildTimeline(actions);
  // Degrade gracefully instead of a hard 404: many older sessions predate
  // transcript recording (or weren't captured), and links to them shouldn't
  // dead-end. New conversations record automatically.
  if (!convo) {
    return (
      <div className="flex flex-col gap-6 max-w-3xl">
        <h1 className="font-display text-2xl font-semibold tracking-tight text-text-primary">Conversation</h1>
        <Card>
          <CardHeader><CardTitle>Transcript unavailable</CardTitle></CardHeader>
          <CardContent>
            <p className="text-sm text-text-secondary">
              This conversation isn&apos;t available — it predates transcript recording or wasn&apos;t captured.
              New conversations are recorded and appear here automatically.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const expiresAt = new Date(convo.startedAt.getTime() + 24 * 3600 * 1000);

  return (
    <div className="flex flex-col gap-6 max-w-3xl">
      <div>
        <h1 className="font-display text-2xl font-semibold tracking-tight text-text-primary">Conversation</h1>
        <p className="text-sm text-text-secondary">
          {convo.startedAt.toLocaleString()} · {convo.durationSec}s · {convo.turns} turns · {convo.mode} · {convo.outcome}
        </p>
        <p className="text-xs text-amber-500 mt-1">
          This conversation will be deleted at {expiresAt.toLocaleString()} (24h retention).
        </p>
      </div>
      <Card>
        <CardHeader><CardTitle>Transcript</CardTitle></CardHeader>
        <CardContent className="flex flex-col gap-3">
          {convo.transcript.length === 0 ? (
            <p className="text-sm text-text-secondary">Transcript not retained.</p>
          ) : convo.transcript.map((t, i) => (
            <div key={i} className={
              t.role === 'agent' ? 'self-start max-w-md bg-surface-muted text-text-primary rounded-2xl px-4 py-2 text-sm' :
              t.role === 'user' ? 'self-end max-w-md bg-foreground text-background rounded-2xl px-4 py-2 text-sm' :
              t.role === 'card' ? 'self-start text-xs italic text-text-secondary' :
              'self-start text-xs font-mono text-text-muted'
            }>
              {t.content}
            </div>
          ))}
        </CardContent>
      </Card>
      {steps.length > 0 && <WebsiteActionsCard steps={steps} />}
      <Card>
        <CardHeader><CardTitle>Cost</CardTitle></CardHeader>
        <CardContent>
          <p className="text-sm text-text-secondary tabular-nums">
            <span className="text-text-primary">${(convo.llmCostCents / 100).toFixed(2)}</span> LLM + <span className="text-text-primary">${(convo.voiceCostCents / 100).toFixed(2)}</span> voice = <span className="text-text-primary font-semibold">${((convo.llmCostCents + convo.voiceCostCents) / 100).toFixed(2)}</span> total
          </p>
        </CardContent>
      </Card>
      {convo.intent && <IntentCard intent={convo.intent} />}
    </div>
  );
}

/** What really happened on the storefront — from action results, not from the
 *  assistant's words — so an owner can tell "said it" from "did it". */
function WebsiteActionsCard({ steps }: { steps: TimelineStep[] }) {
  const failed = steps.filter((s) => !s.ok).length;
  return (
    <Card>
      <CardHeader>
        <CardTitle>On your website</CardTitle>
        <p className="text-sm text-text-secondary">
          What Olivia actually did on the page during this conversation
          {failed > 0 ? ` — ${failed} step${failed > 1 ? 's' : ''} didn't work` : ''}.
        </p>
      </CardHeader>
      <CardContent>
        <ol className="relative flex flex-col gap-3 border-l border-border pl-5">
          {steps.map((s, i) => (
            <li
              key={i}
              className="dash-enter relative text-sm"
              style={{ animationDelay: `${Math.min(i, 12) * 40}ms` }}
            >
              <span
                aria-hidden
                className={`absolute -left-[27px] top-0.5 grid h-4 w-4 place-items-center rounded-full text-[10px] font-bold ${
                  s.ok ? 'bg-emerald-500 text-white' : 'bg-amber-400 text-amber-950'
                }`}
              >
                {s.ok ? '✓' : '!'}
              </span>
              <span className="text-text-primary">
                {s.ok ? s.label : `Tried: ${s.label.charAt(0).toLowerCase()}${s.label.slice(1)} — didn't work`}
              </span>
              {s.count > 1 && <span className="ml-1.5 text-xs tabular-nums text-text-muted">×{s.count}</span>}
              {s.why && <span className="block text-xs text-text-secondary">Because {s.why}.</span>}
              <span className="sr-only">{s.ok ? 'worked' : 'failed'}</span>
            </li>
          ))}
        </ol>
      </CardContent>
    </Card>
  );
}

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full border border-border bg-surface-muted px-2.5 py-1 text-xs font-medium text-text-primary">
      {children}
    </span>
  );
}

function IntentCard({ intent }: { intent: NonNullable<ConversationDetail['intent']> }) {
  const id = intent.identity ?? {};
  const identityFields: { label: string; value: unknown }[] = [
    { label: 'Name', value: id.name },
    { label: 'City', value: id.city },
    { label: 'Email', value: id.email },
    { label: 'Phone', value: id.phone },
  ].filter((f) => f.value != null && String(f.value).trim() !== '');

  return (
    <Card>
      <CardHeader><CardTitle>Intent &amp; signals</CardTitle></CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex items-center gap-2 text-sm">
          <span className="font-medium text-text-primary">{intent.intent}</span>
          <span className="text-text-secondary">
            {Math.round(intent.intentConfidence * 100)}% confidence
          </span>
        </div>

        {intent.needs.length > 0 && (
          <div>
            <p className="mb-2 text-xs uppercase tracking-wide text-text-muted">Needs</p>
            <div className="flex flex-wrap gap-2">
              {intent.needs.map((n) => <Chip key={n}>{n}</Chip>)}
            </div>
          </div>
        )}

        {intent.objections.length > 0 && (
          <div>
            <p className="mb-2 text-xs uppercase tracking-wide text-text-muted">Objections</p>
            <div className="flex flex-wrap gap-2">
              {intent.objections.map((o) => <Chip key={o}>{o}</Chip>)}
            </div>
          </div>
        )}

        {identityFields.length > 0 && (
          <div>
            <p className="mb-2 text-xs uppercase tracking-wide text-text-muted">Captured identity</p>
            <dl className="flex flex-col gap-1 text-sm">
              {identityFields.map((f) => (
                <div key={f.label} className="flex gap-2">
                  <dt className="text-text-secondary">{f.label}:</dt>
                  <dd className="text-text-primary">{String(f.value)}</dd>
                </div>
              ))}
            </dl>
          </div>
        )}

        {intent.dropStage && (
          <div className="text-sm">
            <span className="text-text-secondary">Drop-off stage: </span>
            <span className="text-text-primary">{intent.dropStage}</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
