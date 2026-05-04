import { Resend } from 'resend';

const apiKey = process.env.RESEND_API_KEY;
if (!apiKey) throw new Error('RESEND_API_KEY is not set');

export const resend = new Resend(apiKey);

export async function sendMagicLink(email: string, url: string) {
  await resend.emails.send({
    from: 'shoppingmate <login@shoppingmate.ai>',
    to: email,
    subject: 'Sign in to shoppingmate',
    html: `<p>Click to sign in:</p><p><a href="${url}">${url}</a></p><p>This link expires in 15 minutes.</p>`,
  });
}
