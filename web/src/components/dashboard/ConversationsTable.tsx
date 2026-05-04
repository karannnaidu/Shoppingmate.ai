import Link from 'next/link';
import type { ConversationRow } from '@/lib/conversations-repo';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

function formatDuration(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}m ${s}s`;
}
function relTime(d: Date): string {
  const diff = Math.floor((Date.now() - d.getTime()) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)} min ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} h ago`;
  return d.toLocaleDateString();
}

export function ConversationsTable({ rows }: { rows: ConversationRow[] }) {
  return (
    <Card>
      <CardHeader><CardTitle>Recent conversations</CardTitle></CardHeader>
      <CardContent className="px-0">
        {rows.length === 0 ? (
          <p className="text-sm text-zinc-500 px-6 py-8 text-center">No conversations yet — install your widget and traffic will show up here.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="text-zinc-500 text-xs uppercase">
              <tr className="border-b">
                <th className="px-6 py-2 text-left font-medium">Started</th>
                <th className="text-left font-medium">Duration</th>
                <th className="text-left font-medium">Turns</th>
                <th className="text-left font-medium">Mode</th>
                <th className="text-left font-medium">Outcome</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b last:border-0 hover:bg-zinc-50">
                  <td className="px-6 py-2">
                    <Link href={`/app/conversations/${r.id}`} className="hover:underline">{relTime(r.startedAt)}</Link>
                  </td>
                  <td>{formatDuration(r.durationSec)}</td>
                  <td>{r.turns}</td>
                  <td>{r.mode}</td>
                  <td>{r.outcome}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </CardContent>
    </Card>
  );
}
