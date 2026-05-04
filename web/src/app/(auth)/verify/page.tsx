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
      <div className="text-center">
        <h1 className="text-lg font-semibold">Link expired or invalid</h1>
        <p className="mt-2 text-sm text-zinc-600">Request a new sign-in link.</p>
        <a href="/login" className="mt-4 inline-block underline">Back to sign in</a>
      </div>
    );
  }
  redirect('/app');
}
