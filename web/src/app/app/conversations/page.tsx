import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { getDashboardSession } from '@/lib/session';
import { listConversations } from '@/lib/conversations-repo';
import { ConversationsTable } from '@/components/dashboard/ConversationsTable';

export default async function ConversationsPage({ searchParams }: { searchParams: Promise<{ outcome?: string; mode?: string }> }) {
  const sp = await searchParams;
  const hdrs = await headers();
  const session = await getDashboardSession({ headers: hdrs });
  if (!session?.merchant) redirect('/app/onboarding?step=2');

  const rows = await listConversations({
    merchantId: session.merchant.id,
    outcome: sp.outcome === 'purchased' || sp.outcome === 'abandoned' ? sp.outcome : undefined,
    mode: sp.mode === 'voice' || sp.mode === 'text' ? sp.mode : undefined,
    limit: 50,
  });

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">Conversations</h1>
      <Filters current={sp} />
      <ConversationsTable rows={rows} />
    </div>
  );
}

function Filters({ current }: { current: { outcome?: string; mode?: string } }) {
  return (
    <form className="flex gap-2 text-sm">
      <select name="outcome" defaultValue={current.outcome ?? ''} className="border rounded px-2 py-1">
        <option value="">Any outcome</option>
        <option value="purchased">Purchased</option>
        <option value="abandoned">Abandoned</option>
      </select>
      <select name="mode" defaultValue={current.mode ?? ''} className="border rounded px-2 py-1">
        <option value="">Any mode</option>
        <option value="voice">Voice</option>
        <option value="text">Text</option>
      </select>
      <button type="submit" className="border rounded px-3 py-1 bg-zinc-900 text-white">Apply</button>
    </form>
  );
}
