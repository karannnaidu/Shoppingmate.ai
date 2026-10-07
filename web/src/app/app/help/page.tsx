import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { LifeBuoy } from 'lucide-react';
import { getDashboardSession } from '@/lib/session';
import { listTickets } from '@/lib/support-tools';
import { SupportAssistant } from '@/components/dashboard/SupportAssistant';
import { KIND_LABEL, TicketStatusBadge } from '@/components/dashboard/TicketBits';
import { DashHeader, EmptyState } from '@/components/dashboard/v2';
import { Button } from '@/components/ui/button';
import { LocalTime } from '@/components/dashboard/LocalTime';
import { submitTicket } from './actions';

const DATE_FMT: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' };

export default async function HelpPage() {
  const session = await getDashboardSession({ headers: await headers() });
  if (!session?.merchant) redirect('/app/onboarding?step=2');
  const tickets = await listTickets(session.merchant.id);
  const brand = session.merchant.name ?? session.merchant.domain ?? 'your store';

  return (
    <div className="flex flex-col gap-6">
      <DashHeader
        title="Help & requests"
        description="Ask the support assistant anything — by voice or text. It can check your setup and send bugs, ideas and billing questions straight to our team. You'll see every request and its status here."
      />
      <div className="grid items-start gap-5 lg:grid-cols-[1.15fr_1fr]">
        <SupportAssistant brand={brand} />

        <div className="flex flex-col gap-5">
          <section className="card-v2 p-5">
            <h2 className="font-display text-[17px] font-semibold tracking-[-0.015em]">Your requests</h2>
            {tickets.length === 0 ? (
              <EmptyState icon={LifeBuoy} title="No requests yet" body="Anything you send to the team — from the assistant or the form below — shows up here with its status." />
            ) : (
              <ul className="mt-3 flex flex-col divide-y divide-border">
                {tickets.map((t) => (
                  <li key={t.id} className="py-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <TicketStatusBadge status={t.status} />
                      <span className="text-xs text-text-muted">
                        #{t.id} · {KIND_LABEL[t.kind] ?? t.kind} · <LocalTime iso={t.createdAt.toISOString()} options={DATE_FMT} />
                      </span>
                    </div>
                    <p className="mt-1.5 text-sm font-medium text-text-primary">{t.title}</p>
                    {t.opsNote && (
                      <p className="mt-1.5 rounded-lg bg-signal-soft px-3 py-2 text-[13px] text-text-primary">
                        <span className="font-medium text-signal">From the team: </span>
                        {t.opsNote}
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="card-v2 p-5">
            <h2 className="font-display text-[17px] font-semibold tracking-[-0.015em]">Send a request</h2>
            <p className="mt-0.5 text-[13px] text-text-muted">Prefer writing it yourself? It goes to the same team.</p>
            <form action={submitTicket} className="mt-4 flex flex-col gap-3">
              <label className="text-sm font-medium text-text-secondary" htmlFor="kind">
                What is it about?
              </label>
              <select
                id="kind"
                name="kind"
                defaultValue="bug"
                className="h-11 rounded-xl border border-border bg-surface-elevated px-3 text-[14px] focus:border-violet focus:outline-none focus:ring-4 focus:ring-violet/15"
              >
                <option value="bug">Something isn't working</option>
                <option value="feature">An idea / feature request</option>
                <option value="setup">Help with setup</option>
                <option value="billing">Billing</option>
                <option value="question">A question</option>
              </select>
              <input
                name="title"
                required
                minLength={5}
                maxLength={140}
                placeholder="One line — e.g. Add WhatsApp to customer requests"
                aria-label="Title"
                className="h-11 rounded-xl border border-border bg-surface-elevated px-3.5 text-[14px] placeholder:text-text-muted focus:border-violet focus:outline-none focus:ring-4 focus:ring-violet/15"
              />
              <textarea
                name="details"
                rows={4}
                placeholder="Details — what happened, where, what you expected"
                aria-label="Details"
                className="rounded-xl border border-border bg-surface-elevated px-3.5 py-2.5 text-[14px] placeholder:text-text-muted focus:border-violet focus:outline-none focus:ring-4 focus:ring-violet/15"
              />
              <Button type="submit">Send to the team</Button>
            </form>
          </section>
        </div>
      </div>
    </div>
  );
}
