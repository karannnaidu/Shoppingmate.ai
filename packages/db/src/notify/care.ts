import { and, desc, eq, gt, isNull } from 'drizzle-orm';
import { Resend } from 'resend';
import { db } from '../client.js';
import { caseAttachments, caseEvents } from '../schema/care.js';
import { merchants } from '../schema/merchants.js';
import { supportCases } from '../schema/supportCases.js';

// Customer Care PRD 2026-10-28: shopper-facing emails + photo linking.

const DASHBOARD_URL = process.env.DASHBOARD_URL ?? 'https://shoppingmate-web.vercel.app';

function esc(s: string): string {
  return s.replace(/[&<>"]/g, (c) => (c === '&' ? '&amp;' : c === '<' ? '&lt;' : c === '>' ? '&gt;' : '&quot;'));
}

/** "<Brand> Care <care@our-domain>" — our verified sending domain, the brand's name. */
export function careFrom(brand: string): string {
  const base = process.env.RESEND_FROM ?? 'shoppingmate <onboarding@resend.dev>';
  const addr = /<([^>]+)>/.exec(base)?.[1] ?? base;
  const domain = addr.split('@')[1] ?? 'resend.dev';
  const local = process.env.CARE_FROM_LOCAL ?? (domain === 'resend.dev' ? 'onboarding' : 'care');
  const name = `${brand} Care`.replace(/["<>]/g, '');
  return `${name} <${local}@${domain}>`;
}

const SHOPPER_LINE: Record<string, string> = {
  order_tracking: "We're checking on your order and will update you.",
  complaint: "We're sorry about this. Someone from the team will look into it and get back to you.",
  return_refund: 'Someone from the team will review your return request and contact you with the next steps.',
  cancellation_request: 'Someone from the team will review your cancellation request and contact you. Your order is not cancelled until they confirm.',
  feedback: 'Thank you for taking the time to share this with us.',
};

/** Shopper confirmation email. Exported for tests. */
export function shopperCaseEmail(c: {
  id: number;
  type: string;
  summary: string;
  contactName: string | null;
  orderId: string | null;
  photos: number;
}, brand: string): { subject: string; html: string } {
  const hi = c.contactName ? `Hi ${esc(c.contactName.split(' ')[0] ?? c.contactName)},` : 'Hi,';
  const line = SHOPPER_LINE[c.type] ?? 'Someone from the team will get back to you soon.';
  return {
    subject: c.type === 'feedback' ? `Thanks for your feedback — ${brand}` : `We've got your request #${c.id} — ${brand}`,
    html: `<p>${hi}</p>
<p>${esc(line)}</p>
<table style="border-collapse:collapse;margin:12px 0">
<tr><td style="padding:4px 12px 4px 0;color:#666">Request</td><td>#${c.id}</td></tr>
${c.orderId ? `<tr><td style="padding:4px 12px 4px 0;color:#666">Order</td><td>${esc(c.orderId)}</td></tr>` : ''}
<tr><td style="padding:4px 12px 4px 0;color:#666">What you told us</td><td>${esc(c.summary)}</td></tr>
${c.photos ? `<tr><td style="padding:4px 12px 4px 0;color:#666">Photos</td><td>${c.photos} attached</td></tr>` : ''}
</table>
<p>You can reply to this email if you have anything to add.</p>
<p>— ${esc(brand)}</p>`,
  };
}

/** Where shopper replies should go: the brand's support email, else an owner. */
export async function brandReplyTo(merchantId: string, owners: string[]): Promise<string | undefined> {
  const [m] = await db.select({ supportEmail: merchants.supportEmail }).from(merchants).where(eq(merchants.id, merchantId));
  return m?.supportEmail ?? owners[0];
}

/** Photos uploaded in this conversation before the request was opened → link them. */
export async function linkSessionPhotos(caseId: number, merchantId: string, sessionId: string | null | undefined): Promise<number> {
  if (!sessionId) return 0;
  const since = new Date(Date.now() - 60 * 60_000);
  const rows = await db
    .update(caseAttachments)
    .set({ caseId })
    .where(
      and(
        eq(caseAttachments.merchantId, merchantId),
        eq(caseAttachments.sessionId, sessionId),
        isNull(caseAttachments.caseId),
        gt(caseAttachments.createdAt, since),
      ),
    )
    .returning({ id: caseAttachments.id });
  return rows.length;
}

/** A photo arriving after the request was opened: the session's latest request (last hour). */
export async function latestSessionCase(merchantId: string, sessionId: string): Promise<{ id: number } | null> {
  const since = new Date(Date.now() - 60 * 60_000);
  const [row] = await db
    .select({ id: supportCases.id })
    .from(supportCases)
    .where(and(eq(supportCases.merchantId, merchantId), eq(supportCases.sessionId, sessionId), gt(supportCases.createdAt, since)))
    .orderBy(desc(supportCases.createdAt))
    .limit(1);
  return row ?? null;
}

export async function recordCaseEvent(caseId: number, kind: (typeof caseEvents.$inferInsert)['kind'], body: string | null, actor: string): Promise<void> {
  await db.insert(caseEvents).values({ caseId, kind, body, actor });
}

export async function sendCareEmail(opts: { to: string | string[]; from: string; replyTo?: string; subject: string; html: string }): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return false;
  const r = await new Resend(apiKey).emails.send({
    from: opts.from,
    to: opts.to,
    subject: opts.subject,
    html: opts.html,
    ...(opts.replyTo ? { replyTo: opts.replyTo } : {}),
  });
  if (r.error) {
    console.error('[care] email failed', r.error);
    return false;
  }
  return true;
}

export const caseLink = (id: number) => `${DASHBOARD_URL}/app/cases#case-${id}`;

/** Owner → shopper reply email. Exported for tests. */
export function caseReplyEmail(c: { id: number; contactName: string | null; orderId: string | null }, brand: string, message: string): { subject: string; html: string } {
  const hi = c.contactName ? `Hi ${esc(c.contactName.split(' ')[0] ?? c.contactName)},` : 'Hi,';
  const body = esc(message.trim()).replace(/\n/g, '<br>');
  return {
    subject: `Re: your request #${c.id}${c.orderId ? ` (order ${c.orderId})` : ''} — ${brand}`,
    html: `<p>${hi}</p><p>${body}</p><p style="color:#666;font-size:13px">Reply to this email to continue the conversation.</p><p>— ${esc(brand)}</p>`,
  };
}

/**
 * The owner replies to a request from the dashboard: logged on the request's
 * timeline and emailed to the shopper (from "<Brand> Care", replies to the brand).
 * Returns 'no_email' when the shopper left no email address.
 */
export async function sendCaseReply(args: { merchantId: string; caseId: number; message: string; actor: string }): Promise<'sent' | 'no_email' | 'not_found' | 'failed'> {
  const message = args.message.trim().slice(0, 4000);
  if (!message) return 'failed';
  const [c] = await db
    .select()
    .from(supportCases)
    .where(and(eq(supportCases.id, args.caseId), eq(supportCases.merchantId, args.merchantId)))
    .limit(1);
  if (!c) return 'not_found';
  if (!c.contactEmail) {
    await recordCaseEvent(c.id, 'note', message, args.actor);
    return 'no_email';
  }
  const [m] = await db.select({ name: merchants.name, domain: merchants.domain }).from(merchants).where(eq(merchants.id, args.merchantId)).limit(1);
  const brand = m?.name ?? m?.domain ?? 'the store';
  const { subject, html } = caseReplyEmail(c, brand, message);
  const replyTo = await brandReplyTo(args.merchantId, [args.actor].filter((a) => a.includes('@')));
  const ok = await sendCareEmail({ from: careFrom(brand), to: c.contactEmail, replyTo, subject, html });
  if (!ok) return 'failed';
  await recordCaseEvent(c.id, 'reply_to_customer', message, args.actor);
  if (c.status === 'open') {
    await db.update(supportCases).set({ status: 'in_progress', updatedAt: new Date() }).where(eq(supportCases.id, c.id));
  }
  return 'sent';
}
