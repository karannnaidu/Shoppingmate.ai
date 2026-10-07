import { and, count, desc, eq, isNull, ne, notLike, sql } from 'drizzle-orm';
import {
  alerts,
  brandKbDocuments,
  brandTickets,
  merchants,
  products,
  siteCrawls,
  supportCases,
  type TicketKind,
  ticketKinds,
} from '@shoppingmate/db/schema';
import { emailTeam } from '@shoppingmate/db';
import { db } from './db';
import { conversationsSince } from './kpi-repo';
import { planCredits } from './plan-credits';

// Tools behind the dashboard support assistant: look at the brand's own setup,
// and file a ticket (bug / feature / question / billing / setup) to our team.

const ago = (d: Date | null | undefined): string => {
  if (!d) return 'never';
  const h = Math.round((Date.now() - new Date(d).getTime()) / 3600_000);
  if (h < 1) return 'less than an hour ago';
  if (h < 48) return `${h} hours ago`;
  return `${Math.round(h / 24)} days ago`;
};

/** Plain-English snapshot of the brand's setup for the assistant to reason over. */
export async function storeStatus(merchantId: string): Promise<Record<string, unknown>> {
  const m = await db.query.merchants.findFirst({ where: eq(merchants.id, merchantId) });
  if (!m) return { error: 'store not found' };
  const [[prod], [docs], [openReq], lastCrawl, alert, used] = await Promise.all([
    db.select({ n: count() }).from(products).where(eq(products.merchantId, merchantId)),
    db.select({ n: count() }).from(brandKbDocuments).where(eq(brandKbDocuments.merchantId, merchantId)),
    db
      .select({ n: count() })
      .from(supportCases)
      .where(and(eq(supportCases.merchantId, merchantId), ne(supportCases.status, 'resolved'))),
    db
      .select({ status: siteCrawls.status, pageCount: siteCrawls.pageCount, finishedAt: siteCrawls.finishedAt })
      .from(siteCrawls)
      .where(eq(siteCrawls.merchantId, merchantId))
      .orderBy(desc(siteCrawls.startedAt))
      .limit(1),
    db
      .select({ kind: alerts.kind, createdAt: alerts.createdAt })
      .from(alerts)
      .where(and(eq(alerts.merchantId, merchantId), isNull(alerts.resolvedAt), notLike(alerts.kind, 'qa.%')))
      .orderBy(desc(alerts.createdAt))
      .limit(1),
    conversationsSince({ merchantId, days: 30 }).catch(() => 0),
  ]);
  const allowance = planCredits(m.plan).credits + (m.topupBalance ?? 0);
  return {
    store: m.name ?? m.domain,
    website: m.domain,
    yourWebAddresses: m.allowedDomains ?? [],
    platform: m.platform ?? 'unknown',
    setupStatus: m.status,
    setupProblem: m.lastError ?? null,
    assistantLastSeenOnSite: ago(m.lastWidgetPing),
    productsLoaded: prod?.n ?? 0,
    productsLastRefreshed: ago(m.catalogSyncedAt),
    pagesRead: lastCrawl[0] ? `${lastCrawl[0].pageCount} pages, ${lastCrawl[0].status}, ${ago(lastCrawl[0].finishedAt)}` : 'not read yet',
    knowledgeDocuments: docs?.n ?? 0,
    plan: m.plan,
    billing: m.billingStatus,
    conversationsUsedLast30Days: used,
    conversationsIncluded: allowance,
    openCustomerRequests: openReq?.n ?? 0,
    activeAlert: alert[0] ? alert[0].kind : null,
  };
}

export type NewTicket = {
  kind: TicketKind;
  title: string;
  details: string;
  priority?: 'low' | 'normal' | 'high';
};

export function validateTicket(args: Record<string, unknown>): { ok: true; value: NewTicket } | { ok: false; reason: string } {
  const kind = (ticketKinds as readonly string[]).includes(String(args.kind)) ? (String(args.kind) as TicketKind) : null;
  if (!kind) return { ok: false, reason: `kind must be one of ${ticketKinds.join(', ')}` };
  const title = String(args.title ?? '').trim().slice(0, 140);
  if (title.length < 5) return { ok: false, reason: 'write a one-line title for the request' };
  const details = String(args.details ?? '').trim().slice(0, 4000);
  const priority = args.priority === 'high' || args.priority === 'low' ? args.priority : 'normal';
  return { ok: true, value: { kind, title, details, priority } };
}

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

export async function createTicket(args: {
  merchantId: string;
  userEmail: string | null;
  ticket: NewTicket;
  transcript: Array<{ role: string; text: string }>;
}): Promise<{ id: number }> {
  const [row] = await db
    .insert(brandTickets)
    .values({
      merchantId: args.merchantId,
      userEmail: args.userEmail,
      kind: args.ticket.kind,
      title: args.ticket.title,
      details: args.ticket.details,
      priority: args.ticket.priority ?? 'normal',
      transcript: args.transcript.slice(-30),
    })
    .returning({ id: brandTickets.id });
  const id = row!.id;
  const store = await db.query.merchants.findFirst({ where: eq(merchants.id, args.merchantId) });
  const base = process.env.DASHBOARD_URL ?? 'https://shoppingmate-web.vercel.app';
  await emailTeam(
    `[${args.ticket.kind}${args.ticket.priority === 'high' ? ' · HIGH' : ''}] ${args.ticket.title} — ${store?.name ?? args.merchantId}`,
    `<p><b>${esc(store?.name ?? args.merchantId)}</b> (${esc(args.merchantId)}) · ${esc(args.userEmail ?? 'unknown user')}</p>
     <p><b>${esc(args.ticket.title)}</b></p><p>${esc(args.ticket.details).replace(/\n/g, '<br>')}</p>
     <p><a href="${base}/app/ops/tickets#t${id}">Open ticket #${id}</a></p>`,
  ).catch((err) => console.error('[ticket] team email failed', err));
  return { id };
}

export async function listTickets(merchantId: string) {
  return db
    .select()
    .from(brandTickets)
    .where(eq(brandTickets.merchantId, merchantId))
    .orderBy(desc(brandTickets.createdAt))
    .limit(50);
}

/** Our team's view: every brand's tickets, open first. */
export async function listAllTickets() {
  return db
    .select({
      t: brandTickets,
      store: sql<string>`coalesce(${merchants.name}, ${merchants.domain})`,
    })
    .from(brandTickets)
    .innerJoin(merchants, eq(merchants.id, brandTickets.merchantId))
    .orderBy(sql`case ${brandTickets.status} when 'open' then 0 when 'in_progress' then 1 else 2 end`, desc(brandTickets.createdAt))
    .limit(200);
}

export function isOpsAdmin(email: string | null | undefined): boolean {
  if (!email) return false;
  const admins = (process.env.OPS_ADMIN_EMAILS ?? '')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  return admins.includes(email.toLowerCase());
}
