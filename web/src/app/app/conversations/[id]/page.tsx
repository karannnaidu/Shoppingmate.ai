import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { getDashboardSession } from '@/lib/session';
import type * as React from 'react';
import { getConversation, getConversationActions, type ConversationDetail } from '@/lib/conversations-repo';
import { buildTimeline, type TimelineStep } from '@/lib/action-timeline';
import Link from 'next/link';
import { ChevronLeft, MessageCircle, Mic } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge, DashHeader } from '@/components/dashboard/v2';
import { LocalTime } from '@/components/dashboard/LocalTime';

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
  const back = (
    <Link href="/app/conversations" className="inline-flex items-center gap-1 text-sm font-medium text-text-secondary hover:text-text-primary">
      <ChevronLeft className="h-4 w-4" /> All conversations
    </Link>
  );

  if (!convo) {
    return (
      <div className="flex max-w-3xl flex-col gap-6">
        {back}
        <DashHeader title="Conversation" description="The transcript for this conversation wasn't recorded — older sessions predate recording. New conversations appear here automatically." />
        {steps.length > 0 && <WebsiteActionsCard steps={steps} />}
      </div>
    );
  }

  const expiresAt = new Date(convo.startedAt.getTime() + 24 * 3600 * 1000);
  const outcome = OUTCOME[convo.outcome] ?? OUTCOME.in_progress;
  const mins = Math.floor(convo.durationSec / 60);
  const length = mins > 0 ? `${mins}m ${convo.durationSec % 60}s` : `${convo.durationSec}s`;

  return (
    <div className="flex flex-col gap-6">
      {back}
      <DashHeader
        title={<LocalTime iso={convo.startedAt.toISOString()} options={TITLE_FMT} />}
        description={
          <span className="inline-flex flex-wrap items-center gap-2">
            <Badge tone={outcome.tone}>{outcome.label}</Badge>
            <Badge>
              {convo.mode === 'voice' ? <Mic className="h-3 w-3" /> : <MessageCircle className="h-3 w-3" />}
              {convo.mode === 'voice' ? 'Voice call' : 'Chat'}
            </Badge>
            <Badge>{length}</Badge>
          </span>
        }
      />

      <div className="grid items-start gap-5 lg:grid-cols-[1.5fr_1fr]">
        <section className="card-v2 p-5 md:p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-display text-[17px] font-semibold tracking-[-0.015em]">What was said</h2>
            <span className="text-[11.5px] text-text-muted">
              Auto-deletes <LocalTime iso={expiresAt.toISOString()} options={SHORT_FMT} />
            </span>
          </div>
          {convo.transcript.length === 0 ? (
            <p className="text-sm text-text-secondary">This transcript wasn&apos;t kept.</p>
          ) : (
            <div className="flex flex-col gap-2.5">
              {convo.transcript.map((t, i) =>
                t.role === 'agent' || t.role === 'user' ? (
                  <div key={i} className={t.role === 'user' ? 'flex flex-col items-end' : 'flex flex-col items-start'}>
                    {(i === 0 || convo.transcript[i - 1]?.role !== t.role) && (
                      <span className="mb-1 px-1 text-[11px] font-medium uppercase tracking-wider text-text-muted">
                        {t.role === 'user' ? 'Shopper' : 'Your assistant'}
                      </span>
                    )}
                    <div
                      className={
                        t.role === 'user'
                          ? 'max-w-[85%] rounded-2xl rounded-br-md bg-foreground px-4 py-2.5 text-[14px] leading-relaxed text-background'
                          : 'max-w-[85%] rounded-2xl rounded-bl-md border border-border bg-surface-muted px-4 py-2.5 text-[14px] leading-relaxed text-text-primary'
                      }
                    >
                      {t.content}
                    </div>
                  </div>
                ) : (
                  <p key={i} className="self-center rounded-full bg-surface-muted px-3 py-1 text-[11.5px] text-text-muted">
                    {t.role === 'card' ? `Showed: ${t.content}` : t.content}
                  </p>
                ),
              )}
            </div>
          )}
        </section>

        <div className="flex flex-col gap-5">
          {steps.length > 0 && <WebsiteActionsCard steps={steps} />}
          {convo.intent && <IntentCard intent={convo.intent} />}
          <p className="px-1 text-[12px] text-text-muted">This conversation used 1 of your monthly conversations.</p>
        </div>
      </div>
    </div>
  );
}

const TITLE_FMT: Intl.DateTimeFormatOptions = { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' };
const SHORT_FMT: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' };

const OUTCOME = {
  purchased: { label: 'Ordered', tone: 'signal' as const },
  abandoned: { label: 'Left without buying', tone: 'neutral' as const },
  in_progress: { label: 'Still browsing', tone: 'violet' as const },
};

/** What really happened on the storefront — from action results, not from the
 *  assistant's words — so an owner can tell "said it" from "did it". */
function WebsiteActionsCard({ steps }: { steps: TimelineStep[] }) {
  const failed = steps.filter((s) => !s.ok).length;
  return (
    <Card>
      <CardHeader>
        <CardTitle>On your website</CardTitle>
        <p className="text-sm text-text-secondary">
          What your assistant actually did on the page during this conversation
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
      <CardHeader><CardTitle>What they wanted</CardTitle></CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="text-sm">
          <span className="font-medium capitalize text-text-primary">{intent.intent.replace(/_/g, ' ')}</span>
          {intent.intentConfidence < 0.6 && <span className="ml-2 text-text-muted">(best guess)</span>}
        </div>

        {intent.needs.length > 0 && (
          <div>
            <p className="mb-2 text-xs uppercase tracking-wide text-text-muted">Looking for</p>
            <div className="flex flex-wrap gap-2">
              {intent.needs.map((n) => <Chip key={n}>{n}</Chip>)}
            </div>
          </div>
        )}

        {intent.objections.length > 0 && (
          <div>
            <p className="mb-2 text-xs uppercase tracking-wide text-text-muted">What held them back</p>
            <div className="flex flex-wrap gap-2">
              {intent.objections.map((o) => <Chip key={o}>{o}</Chip>)}
            </div>
          </div>
        )}

        {identityFields.length > 0 && (
          <div>
            <p className="mb-2 text-xs uppercase tracking-wide text-text-muted">Details they shared</p>
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
            <span className="text-text-secondary">Where they stopped: </span>
            <span className="capitalize text-text-primary">{intent.dropStage.replace(/_/g, ' ')}</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
