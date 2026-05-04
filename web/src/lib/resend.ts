import { Resend } from 'resend';

let _resend: Resend | null = null;

function getResend(): Resend {
  if (_resend) return _resend;
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) throw new Error('RESEND_API_KEY is not set');
  _resend = new Resend(apiKey);
  return _resend;
}

export const resend = new Proxy({} as Resend, {
  get(_target, prop) {
    const c = getResend();
    const v = (c as unknown as Record<string | symbol, unknown>)[prop];
    return typeof v === 'function' ? (v as (...args: unknown[]) => unknown).bind(c) : v;
  },
});

export async function sendMagicLink(email: string, url: string) {
  await resend.emails.send({
    from: process.env.RESEND_FROM ?? 'shoppingmate <onboarding@resend.dev>',
    to: email,
    subject: 'Sign in to shoppingmate',
    html: `<p>Click to sign in:</p><p><a href="${url}">${url}</a></p><p>This link expires in 15 minutes.</p>`,
  });
}
