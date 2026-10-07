import Link from 'next/link';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { getDashboardSession } from '@/lib/session';
import { listConversations } from '@/lib/conversations-repo';
import { merchantCurrency } from '@/lib/money';
import { ConversationsTable } from '@/components/dashboard/ConversationsTable';
import { DashHeader } from '@/components/dashboard/v2';
import { cn } from '@/lib/cn';

type SP = { outcome?: string; mode?: string };

export default async function ConversationsPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const hdrs = await headers();
  const session = await getDashboardSession({ headers: hdrs });
  if (!session?.merchant) redirect('/app/onboarding?step=2');

  const outcome = sp.outcome === 'purchased' || sp.outcome === 'abandoned' ? sp.outcome : undefined;
  const mode = sp.mode === 'voice' || sp.mode === 'text' ? sp.mode : undefined;
  const [rows, currency] = await Promise.all([
    listConversations({ merchantId: session.merchant.id, outcome, mode, limit: 50 }),
    merchantCurrency(session.merchant.id).catch(() => 'USD'),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <DashHeader
        title="Conversations"
        description="Every shopper who talked or typed to your assistant. Open one to read it and see what actually happened on your site."
      />
      <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
        <ChipGroup
          label="Result"
          param="outcome"
          current={outcome}
          sp={{ outcome, mode }}
          options={[
            { value: undefined, label: 'All' },
            { value: 'purchased', label: 'Ordered' },
            { value: 'abandoned', label: 'Left without buying' },
          ]}
        />
        <ChipGroup
          label="How"
          param="mode"
          current={mode}
          sp={{ outcome, mode }}
          options={[
            { value: undefined, label: 'Any' },
            { value: 'voice', label: 'Voice' },
            { value: 'text', label: 'Chat' },
          ]}
        />
      </div>
      <ConversationsTable rows={rows} currency={currency} title={`${rows.length}${rows.length === 50 ? '+' : ''} conversation${rows.length === 1 ? '' : 's'}`} />
    </div>
  );
}

function ChipGroup({
  label,
  param,
  current,
  sp,
  options,
}: {
  label: string;
  param: keyof SP;
  current: string | undefined;
  sp: SP;
  options: { value: string | undefined; label: string }[];
}) {
  const href = (value: string | undefined) => {
    const next = { ...sp, [param]: value };
    const q = new URLSearchParams(Object.entries(next).filter(([, v]) => v) as [string, string][]).toString();
    return q ? `/app/conversations?${q}` : '/app/conversations';
  };
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs font-medium text-text-muted">{label}</span>
      <div className="inline-flex gap-1 rounded-xl border border-border bg-surface-muted/60 p-1">
        {options.map((o) => {
          const active = o.value === current;
          return (
            <Link
              key={o.label}
              href={href(o.value)}
              aria-current={active ? 'true' : undefined}
              className={cn(
                'rounded-lg px-3 py-1.5 text-sm font-medium transition-colors',
                active
                  ? 'bg-surface-elevated text-text-primary shadow-[inset_0_1px_0_var(--highlight),var(--shadow-sm)]'
                  : 'text-text-secondary hover:text-text-primary',
              )}
            >
              {o.label}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
