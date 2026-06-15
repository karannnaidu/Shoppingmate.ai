import { Resend } from 'resend';

export type ConsultationEmailArgs = {
  name: string;
  age: number;
  condition: string | null;
  phoneCountryCode: string;
  phone: string;
  sessionId: string | null;
};

const DASHBOARD_URL = process.env.DASHBOARD_URL ?? 'https://shoppingmate-web.vercel.app';
const TO = 'calm@calmosis.com';

export async function sendConsultationEmail(args: ConsultationEmailArgs): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn('[consultation-email] RESEND_API_KEY not set — skipping email');
    return;
  }
  const resend = new Resend(apiKey);
  const transcript = args.sessionId
    ? `<p><a href="${DASHBOARD_URL}/app/conversations/${args.sessionId}">View conversation transcript</a></p>`
    : '';
  const condition = args.condition
    ? args.condition
    : '(not shared — visitor will discuss directly with the doctor)';
  await resend.emails.send({
    from: process.env.RESEND_FROM ?? 'Calmosis <onboarding@resend.dev>',
    to: TO,
    subject: `New consultation request — ${args.name}`,
    html: `<h2>New consultation request</h2>
<ul>
<li><strong>Name:</strong> ${args.name}</li>
<li><strong>Age:</strong> ${args.age}</li>
<li><strong>Condition:</strong> ${condition}</li>
<li><strong>Phone:</strong> ${args.phoneCountryCode} ${args.phone}</li>
</ul>
${transcript}`,
  });
}
