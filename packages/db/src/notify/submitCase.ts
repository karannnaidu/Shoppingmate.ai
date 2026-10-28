import { eq } from 'drizzle-orm';
import { Resend } from 'resend';
import { db } from '../client.js';
import { users } from '../schema/auth.js';
import { merchantOwners } from '../schema/dashboard.js';
import { merchants } from '../schema/merchants.js';
import { type NewSupportCase, supportCases } from '../schema/supportCases.js';
import { brandReplyTo, careFrom, caseLink, linkSessionPhotos, recordCaseEvent, sendCareEmail, shopperCaseEmail } from './care.js';

// Nav PRD Phase 4 — save a customer case and tell the merchant.

export type SubmitCaseArgs = Omit<
  NewSupportCase,
  'id' | 'status' | 'createdAt' | 'updatedAt' | 'resolvedAt'
>;

const DASHBOARD_URL = process.env.DASHBOARD_URL ?? 'https://shoppingmate-web.vercel.app';

const TYPE_LABEL: Record<string, string> = {
  order_tracking: 'Order tracking request',
  complaint: 'Complaint',
  return_refund: 'Return / refund request',
  cancellation_request: 'Cancellation request',
  feedback: 'Customer feedback',
  bad_review: 'Unhappy customer',
  product_question: 'Question the assistant could not answer',
  consult: 'Consultation request',
  booking: 'Booking request',
  quote: 'Quote / callback request',
  other: 'Customer request',
};

function esc(s: string): string {
  return s.replace(/[&<>"]/g, (c) =>
    c === '&' ? '&amp;' : c === '<' ? '&lt;' : c === '>' ? '&gt;' : '&quot;',
  );
}

/** Email subject + HTML for a case, in plain owner language. Exported for tests. */
export function caseEmail(args: SubmitCaseArgs, brand: string, extra: { id?: number; photos?: number } = {}): { subject: string; html: string } {
  const label = TYPE_LABEL[args.type] ?? 'Customer request';
  const urgent = args.urgency === 'high' ? '[Urgent] ' : '';
  const who = args.contactName ? ` — ${args.contactName}` : '';
  const details = Object.entries(args.details ?? {})
    .map(([k, v]) => `<li><strong>${esc(k.replace(/_/g, ' '))}:</strong> ${esc(String(v))}</li>`)
    .join('');
  const contact = [args.contactPhone, args.contactEmail]
    .filter(Boolean)
    .map((c) => esc(String(c)))
    .join(' · ');
  const transcript = args.sessionId
    ? `<p><a href="${DASHBOARD_URL}/app/conversations/${encodeURIComponent(args.sessionId)}">Read the conversation</a> · <a href="${DASHBOARD_URL}/app/cases">Open all customer requests</a></p>`
    : `<p><a href="${DASHBOARD_URL}/app/cases">Open all customer requests</a></p>`;
  const order = args.orderId ? `<p><strong>Order:</strong> ${esc(String(args.orderId))}</p>` : '';
  const photos = extra.photos
    ? `<p><strong>${extra.photos} photo${extra.photos > 1 ? 's' : ''} attached</strong> — <a href="${extra.id ? caseLink(extra.id) : `${DASHBOARD_URL}/app/cases`}">view in your dashboard</a></p>`
    : '';
  const approval =
    args.type === 'cancellation_request' || args.type === 'return_refund'
      ? '<p><strong>Needs your approval:</strong> the customer was told a person will review this and contact them.</p>'
      : '';
  return {
    subject: `${urgent}${label}${who}${extra.id ? ` #${extra.id}` : ''} (${brand})`,
    html: `<h2>${esc(label)}</h2>
<p>${esc(args.summary)}</p>${order}${photos}${approval}
<ul>${details}</ul>
<p><strong>How to reach them:</strong> ${contact || 'not shared'}${args.consent ? ' (they agreed to be contacted)' : ''}</p>
${args.sentiment === 'angry' || args.sentiment === 'negative' ? '<p><strong>Heads up:</strong> this customer is unhappy — a quick, personal reply goes a long way.</p>' : ''}
${transcript}`,
  };
}

export async function ownerEmails(merchantId: string): Promise<string[]> {
  const rows = await db
    .select({ email: users.email })
    .from(merchantOwners)
    .innerJoin(users, eq(merchantOwners.userId, users.id))
    .where(eq(merchantOwners.merchantId, merchantId));
  return rows.map((r) => r.email).filter(Boolean);
}

export async function submitSupportCase(
  args: SubmitCaseArgs,
): Promise<{ ok: true; id: number } | { ok: false; reason: string }> {
  let id: number;
  try {
    const [row] = await db.insert(supportCases).values(args).returning({ id: supportCases.id });
    if (!row) return { ok: false, reason: 'could not save the request' };
    id = row.id;
  } catch (err) {
    console.error('[case] insert failed', err);
    return { ok: false, reason: 'could not save the request' };
  }
  // Photos the shopper added earlier in this conversation belong to it.
  const photos = await linkSessionPhotos(id, args.merchantId, args.sessionId).catch(() => 0);
  // Fire-and-forget: a mail failure must not fail the case (row is saved).
  void (async () => {
    if (!process.env.RESEND_API_KEY) return;
    const [m] = await db
      .select({ name: merchants.name, domain: merchants.domain })
      .from(merchants)
      .where(eq(merchants.id, args.merchantId));
    const brand = m?.name ?? m?.domain ?? 'your store';
    const owners = await ownerEmails(args.merchantId);
    if (owners.length > 0) {
      const { subject, html } = caseEmail(args, brand, { id, photos });
      await sendCareEmail({ from: process.env.RESEND_FROM ?? 'shoppingmate <onboarding@resend.dev>', to: owners, subject, html });
    }
    // Customer Care PRD: the shopper gets a copy with the reference number.
    if (args.contactEmail) {
      const mail = shopperCaseEmail(
        { id, type: args.type, summary: args.summary, contactName: args.contactName ?? null, orderId: args.orderId ?? null, photos },
        brand,
      );
      const sent = await sendCareEmail({
        from: careFrom(brand),
        to: args.contactEmail,
        replyTo: await brandReplyTo(args.merchantId, owners),
        ...mail,
      });
      if (sent) await recordCaseEvent(id, 'customer_email', mail.subject, 'assistant');
    }
  })().catch((err) => console.error('[case] email failed', err));
  return { ok: true, id };
}

/** Email OUR team (brand support tickets). Recipients: OPS_TICKET_EMAILS
 *  (comma-separated). Returns how many it was sent to (0 when unconfigured). */
export async function emailTeam(subject: string, html: string): Promise<number> {
  const apiKey = process.env.RESEND_API_KEY;
  const to = (process.env.OPS_TICKET_EMAILS ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  if (!apiKey || to.length === 0) return 0;
  await new Resend(apiKey).emails.send({
    from: process.env.RESEND_FROM ?? 'shoppingmate <onboarding@resend.dev>',
    to,
    subject,
    html,
  });
  return to.length;
}

/** Nav Phase 8: email a merchant's owners (insights digest, anomaly alerts). */
export async function emailOwners(merchantId: string, subject: string, html: string): Promise<number> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return 0;
  const to = await ownerEmails(merchantId);
  if (to.length === 0) return 0;
  await new Resend(apiKey).emails.send({
    from: process.env.RESEND_FROM ?? 'shoppingmate <onboarding@resend.dev>',
    to,
    subject,
    html,
  });
  return to.length;
}