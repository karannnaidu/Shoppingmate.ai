import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { magicLink } from 'better-auth/plugins';
import { db, schema } from './db';
import { sendMagicLink } from './resend';

type AuthInstance = ReturnType<typeof betterAuth>;

let _auth: AuthInstance | null = null;

function getAuth(): AuthInstance {
  if (_auth) return _auth;
  const googleClientId = process.env.GOOGLE_CLIENT_ID;
  const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET;
  _auth = betterAuth({
    database: drizzleAdapter(db, {
      provider: 'pg',
      schema: {
        user: schema.users,
        session: schema.sessions,
        verification: schema.verifications,
        account: schema.accounts,
      },
    }),
    baseURL: process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000',
    secret: process.env.BETTER_AUTH_SECRET,
    emailAndPassword: { enabled: false },
    socialProviders:
      googleClientId && googleClientSecret
        ? {
            google: {
              clientId: googleClientId,
              clientSecret: googleClientSecret,
            },
          }
        : undefined,
    plugins: [
      magicLink({
        sendMagicLink: async ({ email, url }) => {
          await sendMagicLink(email, url);
        },
        expiresIn: 60 * 15,
      }),
    ],
    rateLimit: {
      window: 15 * 60,
      max: 5,
    },
  });
  return _auth;
}

export const auth = new Proxy({} as AuthInstance, {
  get(_target, prop) {
    const c = getAuth();
    const v = (c as unknown as Record<string | symbol, unknown>)[prop];
    return typeof v === 'function' ? (v as (...args: unknown[]) => unknown).bind(c) : v;
  },
});

export type Session = AuthInstance['$Infer']['Session'];
