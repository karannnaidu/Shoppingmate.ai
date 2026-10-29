import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { MagicLinkForm } from '@/components/auth/MagicLinkForm';
import { auth } from '@/lib/auth';

// Only same-site paths, so ?next= can't send someone to another website.
function safeNext(next: string | undefined): string {
  return next && next.startsWith('/') && !next.startsWith('//') ? next : '/app';
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = (await searchParams) ?? {};
  const next = safeNext(typeof sp.next === 'string' ? sp.next : undefined);
  // Already signed in (e.g. the sign-in link was opened twice — the first click
  // worked, the second reports INVALID_TOKEN): go straight to the dashboard.
  const session = await auth.api.getSession({ headers: await headers() }).catch(() => null);
  if (session) redirect(next);

  const error = typeof sp.error === 'string' ? sp.error : undefined;
  const notice =
    error === 'INVALID_TOKEN' || error === 'EXPIRED_TOKEN'
      ? 'That sign-in link has already been used or has expired. Links work once and last 15 minutes — enter your email for a fresh one.'
      : error
        ? 'Something went wrong signing you in. Please request a new link.'
        : null;
  return (
    <>
      {notice && (
        <p role="alert" className="mb-6 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-text-primary">
          {notice}
        </p>
      )}
      <MagicLinkForm mode="login" callbackURL={next} />
    </>
  );
}
