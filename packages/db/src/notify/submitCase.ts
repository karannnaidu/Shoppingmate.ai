import { eq } from 'drizzle-orm';
import { Resend } from 'resend';
import { db } from '../client.js';
import { users } from '../schema/auth.js';
import { merchantOwners } from '../schema/dashboard.js';
import { merchants } from '../schema/merchants.js';
import { type NewSupportCase, supportCases } from '../schema/supportCases.js';

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
export function caseEmail(args: SubmitCaseArgs, brand: string): { subject: string; html: string } {
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
  return {
    subject: `${urgent}${label}${who} (${brand})`,
    html: `<h2>${esc(label)}</h2>
<p>${esc(args.summary)}</p>
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
  // Fire-and-forget: a mail failure must not fail the case (row is saved).
  void (async () => {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) return;
    const [m] = await db
      .select({ name: merchants.name, domain: merchants.domain })
      .from(merchants)
      .where(eq(merchants.id, args.merchantId));
    const to = await ownerEmails(args.merchantId);
    if (to.length === 0) return;
    const { subject, html } = caseEmail(args, m?.name ?? m?.domain ?? 'your store');
    await new Resend(apiKey).emails.send({
      from: process.env.RESEND_FROM ?? 'shoppingmate <onboarding@resend.dev>',
      to,
      subject,
      html,
    });
  })().catch((err) => console.error('[case] email failed', err));
  return { ok: true, id };
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