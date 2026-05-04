import Link from 'next/link';
import { redirect } from 'next/navigation';

// Next.js 16: searchParams is a Promise (async props convention)
export default async function VerifyPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const params = await searchParams;
  if (params.error) {
    return (
      <div className="rounded-2xl border border-border bg-surface-elevated p-8 text-center shadow-[var(--shadow-sm)]">
        <h1 className="font-display text-lg font-semibold text-text-primary">
          Link expired or invalid
        </h1>
        <p className="mt-2 text-sm text-text-secondary">
          Request a new sign-in link.
        </p>
        <Link
          href="/login"
          className="mt-4 inline-flex items-center justify-center rounded-full border border-border bg-surface px-4 py-2 text-sm font-medium text-text-primary transition-colors hover:border-border-strong"
        >
          Back to sign in
        </Link>
      </div>
    );
  }
  redirect('/app');
}
