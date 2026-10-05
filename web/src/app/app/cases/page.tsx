import Link from 'next/link';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { getDashboardSession } from '@/lib/session';
import { type CaseFilter, caseCounts, listCases } from '@/lib/cases-repo';
import { Button } from '@/components/ui/button';
import { timeAgo } from '@/components/site-templates-card';
import { setCaseStatus } from './actions';

// Nav PRD Phase 4 — "Customer requests": everything shoppers needed from the
// team (tracking, complaints, returns, unhappy customers, unanswered questions,
// consultations), urgent ones first, in plain language.

const TYPE: Record<string, { label: string; tone: string }> = {
  order_tracking: { label: 'Where is my order?', tone: 'bg-sky-500/15 text-sky-300' },
  complaint: { label: 'Complaint', tone: 'bg-amber-500/15 text-amber-300' },
  return_refund: { label: 'Return / refund', tone: 'bg-amber-500/15 text-amber-300' },
  bad_review: { label: 'Unhappy customer', tone: 'bg-rose-500/15 text-rose-300' },
  product_question: { label: 'Question we couldn’t answer', tone: 'bg-violet-500/15 text-violet-300' },
  consult: { label: 'Consultation', tone: 'bg-emerald-500/15 text-emerald-300' },
  other: { label: 'Request', tone: 'bg-zinc-500/15 text-zinc-300' },
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

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-2xl font-semibold tracking-tight text-text-primary">Customer requests</h1>
        <p className="mt-1 text-sm text-text-secondary">
          {counts.open === 0
            ? 'Nothing waiting — when a shopper needs your team (order tracking, a problem, a return, a question), it lands here and in your email.'
            : `${counts.open} ${counts.open === 1 ? 'customer is' : 'customers are'} waiting for your team${
                counts.urgentOpen > 0 ? ` — ${counts.urgentOpen} unhappy or urgent, reply to them first` : ''
              }.`}
        </p>
      </div>

      <nav className="flex gap-2" aria-label="Filter requests">
        {FILTERS.map((f) => (
          <Link
            key={f.key}
            href={f.key === 'open' ? '/app/cases' : `/app/cases?show=${f.key}`}
            className={`rounded-full border px-3 py-1 text-sm ${
              f.key === filter
                ? 'border-text-primary text-text-primary'
                : 'border-border text-text-secondary hover:text-text-primary'
            }`}
          >
            {f.label}
          </Link>
        ))}
      </nav>

      {rows.length === 0 ? (
        <div className="rounded-lg border border-border bg-surface/60 p-8 text-center text-text-secondary">
          {filter === 'open' ? 'All caught up.' : 'No requests here yet.'}
        </div>
      ) : (
        <ul className="flex flex-col gap-3">
          {rows.map((c) => {
            const t = TYPE[c.type] ?? (TYPE.other as { label: string; tone: string });
            const details = Object.entries(c.details ?? {});
            const resolved = c.status === 'resolved';
            return (
              <li key={c.id} className="rounded-lg border border-border bg-surface p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${t.tone}`}>{t.label}</span>
                  {c.urgency === 'high' && !resolved && (
                    <span className="rounded-full bg-rose-500/20 px-2 py-0.5 text-xs font-medium text-rose-300">Reply first</span>
                  )}
                  <span className="text-xs text-text-secondary">
                    #{c.id} · {timeAgo(c.createdAt)}
                  </span>
                </div>
                <p className="mt-2 font-medium text-text-primary">{c.summary}</p>
                {details.length > 0 && (
                  <dl className="mt-2 grid grid-cols-1 gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
                    {details.map(([k, v]) => (
                      <div key={k} className="flex gap-2">
                        <dt className="capitalize text-text-secondary">{k.replace(/_/g, ' ')}:</dt>
                        <dd className="text-text-primary">{v}</dd>
                      </div>
                    ))}
                  </dl>
                )}
                <p className="mt-2 text-sm text-text-secondary">
                  {c.contactName ? `${c.contactName} · ` : ''}
                  {[c.contactPhone, c.contactEmail].filter(Boolean).join(' · ') || 'No contact shared'}
                </p>
                <div className="mt-3 flex flex-wrap items-center gap-3">
                  <form action={setCaseStatus}>
                    <input type="hidden" name="id" value={c.id} />
                    <input type="hidden" name="status" value={resolved ? 'open' : 'resolved'} />
                    <Button type="submit" size="sm" variant={resolved ? 'outline' : 'primary'}>
                      {resolved ? 'Re-open' : 'Mark as handled'}
                    </Button>
                  </form>
                  {c.sessionId && (
                    <Link href={`/app/conversations/${c.sessionId}`} className="text-sm text-violet hover:underline">
                      Read the conversation
                    </Link>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
