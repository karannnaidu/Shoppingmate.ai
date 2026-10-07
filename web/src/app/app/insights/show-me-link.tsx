'use client';
import Link, { useLinkStatus } from 'next/link';

function Label() {
  const { pending } = useLinkStatus();
  return (
    <span aria-live="polite" className={pending ? 'animate-pulse' : ''}>
      {pending ? 'Opening the page…' : 'Show me on the page'}
    </span>
  );
}

/** The Insights page re-renders on the server (~3–4s) before jumping to the
 *  page view; without feedback owners thought the button was broken. */
export function ShowMeLink({ href }: { href: string }) {
  return (
    <Link href={href} className="text-sm text-violet hover:underline">
      <Label />
    </Link>
  );
}
