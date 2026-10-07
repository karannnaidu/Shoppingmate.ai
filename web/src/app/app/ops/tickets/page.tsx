import { headers } from 'next/headers';
import { notFound, redirect } from 'next/navigation';
import { getDashboardSession } from '@/lib/session';
import { isOpsAdmin, listAllTickets } from '@/lib/support-tools';
import { KIND_LABEL, TicketStatusBadge } from '@/components/dashboard/TicketBits';
import { DashHeader, Badge } from '@/components/dashboard/v2';
import { LocalTime } from '@/components/dashboard/LocalTime';
import { Button } from '@/components/ui/button';
import { updateTicket } from '../../help/actions';

const WHEN: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' };

// Internal: every brand's tickets for the shoppingmate team (OPS_ADMIN_EMAILS).
export default async function OpsTicketsPage() {
  const session = await getDashboardSession({ headers: await headers() });
  if (!session) redirect('/login');
  if (!isOpsAdmin(session.user.email)) notFound();
  const rows = await listAllTickets();
  const open = rows.filter((r) => r.t.status === 'open').length;

  return (
    <div className="flex flex-col gap-6">
      <DashHeader
        eyebrow="Internal · shoppingmate team"
        title="Brand tickets"
        description={`${rows.length} ticket${rows.length === 1 ? '' : 's'} from brands — ${open} waiting for a first response. Status and notes are shown to the brand on their Help page.`}
      />
      <ul className="flex flex-col gap-3">
        {rows.map(({ t, store }) => (
          <li key={t.id} id={`t${t.id}`} className="card-v2 p-5">
            <div className="flex flex-wrap items-center gap-2">
              <TicketStatusBadge status={t.status} />
              <Badge>{KIND_LABEL[t.kind] ?? t.kind}</Badge>
              {t.priority === 'high' && <Badge tone="rose">High</Badge>}
              <span className="text-xs text-text-muted">
                #{t.id} · {store} · {t.userEmail ?? 'unknown'} · <LocalTime iso={t.createdAt.toISOString()} options={WHEN} />
              </span>
            </div>
            <p className="mt-2 font-medium text-text-primary">{t.title}</p>
            {t.details && <p className="mt-1 whitespace-pre-wrap text-sm text-text-secondary">{t.details}</p>}
            {t.transcript.length > 0 && (
              <details className="mt-2 text-sm">
                <summary className="cursor-pointer text-text-muted">Conversation ({t.transcript.length})</summary>
                <div className="mt-2 flex flex-col gap-1.5 rounded-xl bg-surface-muted/60 p-3">
                  {t.transcript.map((m, i) => (
                    <p key={i} className="text-[13px]">
                      <span className="font-medium text-text-primary">{m.role === 'user' ? 'Owner' : 'Assistant'}: </span>
                      <span className="text-text-secondary">{m.text}</span>
                    </p>
                  ))}
                </div>
              </details>
            )}
            <form action={updateTicket} className="mt-4 flex flex-wrap items-end gap-2 border-t border-border pt-4">
              <input type="hidden" name="id" value={t.id} />
              <select
                name="status"
                defaultValue={t.status}
                aria-label="Status"
                className="h-9 rounded-lg border border-border bg-surface-elevated px-2 text-sm"
              >
                <option value="open">Received</option>
                <option value="in_progress">Being worked on</option>
                <option value="done">Done</option>
                <option value="wont_do">Not planned</option>
              </select>
              <input
                name="note"
                defaultValue={t.opsNote ?? ''}
                placeholder="Note for the brand (optional)"
                aria-label="Note for the brand"
                className="h-9 min-w-[16rem] flex-1 rounded-lg border border-border bg-surface-elevated px-3 text-sm"
              />
              <Button type="submit" size="sm">
                Update
              </Button>
            </form>
          </li>
        ))}
      </ul>
    </div>
  );
}
