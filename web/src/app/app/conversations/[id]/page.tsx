import { headers } from 'next/headers';
import { notFound, redirect } from 'next/navigation';
import { getDashboardSession } from '@/lib/session';
import { getConversation } from '@/lib/conversations-repo';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default async function ConversationDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const hdrs = await headers();
  const session = await getDashboardSession({ headers: hdrs });
  if (!session?.merchant) redirect('/app/onboarding?step=2');

  const convo = await getConversation({ merchantId: session.merchant.id, sessionId: id });
  if (!convo) notFound();

  const expiresAt = new Date(convo.startedAt.getTime() + 24 * 3600 * 1000);

  return (
    <div className="flex flex-col gap-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-semibold">Conversation</h1>
        <p className="text-sm text-zinc-500">
          {convo.startedAt.toLocaleString()} · {convo.durationSec}s · {convo.turns} turns · {convo.mode} · {convo.outcome}
        </p>
        <p className="text-xs text-amber-700 mt-1">
          This conversation will be deleted at {expiresAt.toLocaleString()} (24h retention).
        </p>
      </div>
      <Card>
        <CardHeader><CardTitle>Transcript</CardTitle></CardHeader>
        <CardContent className="flex flex-col gap-3">
          {convo.transcript.length === 0 ? (
            <p className="text-sm text-zinc-500">Transcript not retained.</p>
          ) : convo.transcript.map((t, i) => (
            <div key={i} className={
              t.role === 'agent' ? 'self-start max-w-md bg-zinc-100 rounded-lg px-3 py-2 text-sm' :
              t.role === 'user' ? 'self-end max-w-md bg-zinc-900 text-white rounded-lg px-3 py-2 text-sm' :
              t.role === 'card' ? 'self-start text-xs italic text-zinc-500' :
              'self-start text-xs font-mono text-zinc-400'
            }>
              {t.content}
            </div>
          ))}
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>Cost</CardTitle></CardHeader>
        <CardContent>
          <p className="text-sm text-zinc-700">
            ${(convo.llmCostCents / 100).toFixed(2)} LLM + ${(convo.voiceCostCents / 100).toFixed(2)} voice = ${((convo.llmCostCents + convo.voiceCostCents) / 100).toFixed(2)} total
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
