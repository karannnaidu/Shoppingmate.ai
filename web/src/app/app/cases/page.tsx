import Link from 'next/link';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { Camera, Inbox, MessageCircle, Package, Phone } from 'lucide-react';
import { getDashboardSession } from '@/lib/session';
import { type CaseFilter, caseCounts, caseExtras, listCases } from '@/lib/cases-repo';
import { ReplyForm } from './reply-form';
import { CaseStatusButton } from './case-status-button';
import { timeAgo } from '@/components/site-templates-card';
import { setCaseStatus } from './actions';
import { Badge, DashHeader, EmptyState } from '@/components/dashboard/v2';
import { cn } from '@/lib/cn';

// Nav PRD Phase 4 — "Customer requests": everything shoppers needed from the
// team (tracking, complaints, returns, unhappy customers, unanswered questions,
// consultations), urgent ones first, in plain language.

type Tone = 'neutral' | 'signal' | 'amber' | 'rose' | 'violet';
const TYPE: Record<string, { label: string; tone: Tone }> = {
  order_tracking: { label: 'Where is my order?', tone: 'violet' },
  complaint: { label: 'Complaint', tone: 'amber' },
  return_refund: { label: 'Return / refund', tone: 'amber' },
  cancellation_request: { label: 'Cancellation request', tone: 'amber' },
  feedback: { label: 'Feedback', tone: 'signal' },
  bad_review: { label: 'Unhappy customer', tone: 'rose' },
  product_question: { label: 'Question we couldn’t answer', tone: 'violet' },
  consult: { label: 'Consultation', tone: 'signal' },
  booking: { label: 'Booking request', tone: 'signal' },
  quote: { label: 'Quote / callback', tone: 'violet' },
  other: { label: 'Request', tone: 'neutral' },
};

const FILTERS: Array<{ key: CaseFilter; label: string }> = [
  { key: 'open', label: 'To do' },
  { key: 'handled', label: 'Handled' },
  { key: 'all', label: 'All' },
];

export default async function CasesPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const hdrs = await headers();
  const session = await getDashboardSession({ headers: hdrs });
  if (!session?.merchant) redirect('/app/onboarding?step=2');
  const sp = (await searchParams) ?? {};
  const filter: CaseFilter = sp.show === 'handled' ? 'handled' : sp.show === 'all' ? 'all' : 'open';
  const [rows, counts] = await Promise.all([
    listCases({ merchantId: session.merchant.id, filter }),
    caseCounts(session.merchant.id),
  ]);
  const extras = await caseExtras(session.merchant.id, rows.map((r) => r.id));
  const NEEDS_APPROVAL = new Set(['return_refund', 'cancellation_request']);

  return (
    <div className="flex flex-col gap-6">
      <DashHeader
        title="Customer requests"
        description={
          counts.open === 0
            ? 'Nothing waiting. When a customer needs your team — a booking, a price quote, order tracking, a problem, a return, a question — it lands here and in your email.'
            : `${counts.open} ${counts.open === 1 ? 'customer is' : 'customers are'} waiting for your team${
                counts.urgentOpen > 0 ? ` — ${counts.urgentOpen} unhappy or urgent, reply to them first` : ''
              }.`
        }
      />

      <nav className="inline-flex w-fit gap-1 rounded-xl border border-border bg-surface-muted/60 p-1" aria-label="Filter requests">
        {FILTERS.map((f) => (
          <Link
            key={f.key}
            href={f.key === 'open' ? '/app/cases' : `/app/cases?show=${f.key}`}
            aria-current={f.key === filter ? 'page' : undefined}
            className={cn(
              'rounded-lg px-3.5 py-1.5 text-sm font-medium transition-colors',
              f.key === filter
                ? 'bg-surface-elevated text-text-primary shadow-[inset_0_1px_0_var(--highlight),var(--shadow-sm)]'
                : 'text-text-secondary hover:text-text-primary',
            )}
          >
            {f.label}
            {f.key === 'open' && counts.open > 0 && (
              <span className="ml-1.5 rounded-full bg-amber-500 px-1.5 text-[11px] font-semibold text-black">{counts.open}</span>
            )}
          </Link>
        ))}
      </nav>

      {rows.length === 0 ? (
        <div className="card-v2">
          <EmptyState
            icon={Inbox}
            title={filter === 'open' ? 'All caught up' : 'No requests here yet'}
            body={
              filter === 'open'
                ? 'No customer is waiting on you. New requests appear here the moment a shopper asks for help.'
                : 'Requests your team has handled will be listed here.'
            }
          />
        </div>
      ) : (
        <ul className="flex flex-col gap-3">
          {rows.map((c) => {
            const t = TYPE[c.type] ?? (TYPE.other as { label: string; tone: Tone });
            const details = Object.entries(c.details ?? {});
            const resolved = c.status === 'resolved';
            const contact = [c.contactPhone, c.contactEmail].filter(Boolean).join(' · ');
            const photos = extras.photos.get(c.id) ?? [];
            const timeline = (extras.events.get(c.id) ?? []).filter((e) => e.kind === 'reply_to_customer' || e.kind === 'note');
            const inProgress = c.status === 'in_progress';
            return (
              <li
                key={c.id}
                className={cn(
                  'card-v2 relative overflow-hidden p-5',
                  c.urgency === 'high' && !resolved && 'ring-1 ring-rose-500/30',
                  resolved && 'opacity-75',
                )}
              >
                {c.urgency === 'high' && !resolved && <span className="absolute inset-y-0 left-0 w-1 bg-rose-500" aria-hidden />}
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone={t.tone}>{t.label}</Badge>
                  {c.urgency === 'high' && !resolved && <Badge tone="rose">Reply first</Badge>}
                  {resolved && <Badge tone="signal">Handled</Badge>}
                  {inProgress && <Badge tone="violet">In progress</Badge>}
                  {NEEDS_APPROVAL.has(c.type) && !resolved && <Badge tone="neutral">Needs your approval</Badge>}
                  <span className="text-xs text-text-muted">
                    #{c.id} · {timeAgo(c.createdAt)}
                  </span>
                </div>
                <p className="mt-3 text-[15px] font-medium leading-snug text-text-primary">{c.summary}</p>
                {c.orderId && (
                  <p className="mt-2 inline-flex items-center gap-1.5 text-sm text-text-secondary">
                    <Package className="h-3.5 w-3.5 text-text-muted" />
                    Order <span className="font-medium text-text-primary">#{c.orderId}</span>
                  </p>
                )}
                {details.length > 0 && (
                  <dl className="mt-3 grid grid-cols-1 gap-x-6 gap-y-1.5 rounded-xl bg-surface-muted/60 p-3 text-sm sm:grid-cols-2">
                    {details.map(([k, v]) => (
                      <div key={k} className="flex gap-2">
                        <dt className="capitalize text-text-muted">{k.replace(/_/g, ' ')}</dt>
                        <dd className="text-text-primary">{v}</dd>
                      </div>
                    ))}
                  </dl>
                )}
                <div className="mt-3 flex items-center gap-2 text-sm text-text-secondary">
                  <Phone className="h-3.5 w-3.5 text-text-muted" />
                  {c.contactName ? <span className="font-medium text-text-primary">{c.contactName}</span> : null}
                  {c.contactName && contact ? <span className="text-text-muted">·</span> : null}
                  <span>{contact || (c.contactName ? '' : 'No contact shared')}</span>
                </div>
                {photos.length > 0 && (
                  <div className="mt-3">
                    <p className="mb-2 inline-flex items-center gap-1.5 text-xs text-text-muted">
                      <Camera className="h-3.5 w-3.5" /> {photos.length} {photos.length === 1 ? 'photo' : 'photos'} from the customer
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {photos.map((pid) => (
                        <a key={pid} href={`/app/cases/photo/${pid}`} target="_blank" rel="noopener" className="block overflow-hidden rounded-lg border border-border">
                          {/* eslint-disable-next-line @next/next/no-img-element -- private signed redirect, not optimisable */}
                          <img src={`/app/cases/photo/${pid}`} alt={`Customer photo for request ${c.id}`} className="h-24 w-24 object-cover" loading="lazy" />
                        </a>
                      ))}
                    </div>
                  </div>
                )}
                {timeline.length > 0 && (
                  <ul className="mt-3 flex flex-col gap-2 border-l-2 border-border pl-3">
                    {timeline.map((e, i) => (
                      <li key={i} className="text-sm">
                        <span className="text-xs text-text-muted">
                          {e.kind === 'reply_to_customer' ? 'Replied to customer' : 'Note'} · {timeAgo(e.createdAt)}
                        </span>
                        <p className="whitespace-pre-line text-text-secondary">{e.body}</p>
                      </li>
                    ))}
                  </ul>
                )}
                <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-border pt-4">
                  <form action={setCaseStatus}>
                    <input type="hidden" name="id" value={c.id} />
                    <input type="hidden" name="status" value={resolved ? 'open' : 'resolved'} />
                    <CaseStatusButton to={resolved ? 'open' : 'resolved'} />
                  </form>
                  {c.status === 'open' && (
                    <form action={setCaseStatus}>
                      <input type="hidden" name="id" value={c.id} />
                      <input type="hidden" name="status" value="in_progress" />
                      <CaseStatusButton to="in_progress" />
                    </form>
                  )}
                  {c.sessionId && (
                    <Link
                      href={`/app/conversations/${c.sessionId}`}
                      className="inline-flex items-center gap-1.5 text-sm font-medium text-text-secondary transition-colors hover:text-text-primary"
                    >
                      <MessageCircle className="h-3.5 w-3.5" />
                      Read the conversation
                    </Link>
                  )}
                  {!resolved && <ReplyForm caseId={c.id} toEmail={c.contactEmail} />}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
