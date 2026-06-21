import type { AudienceRow } from '@/lib/audience-repo';
import { Card, CardContent } from '@/components/ui/card';

function visitorLabel(r: AudienceRow): string {
  return r.name ?? r.visitorId.slice(0, 8);
}
function ltv(cents: number): string {
  return cents > 0 ? `₹${Math.round(cents / 100)}` : '—';
}
function shortDate(d: Date): string {
  return d.toLocaleDateString();
}

export function AudienceTable({ rows }: { rows: AudienceRow[] }) {
  if (rows.length === 0) {
    return (
      <Card>
        <CardContent className="px-6 py-8 text-center">
          <p className="text-sm text-text-secondary">No returning visitors yet.</p>
        </CardContent>
      </Card>
    );
  }
  return (
    <Card>
      <CardContent className="px-0">
        <table className="w-full text-sm">
          <thead className="text-text-muted text-xs uppercase tracking-wide">
            <tr className="border-b border-border">
              <th className="px-6 py-3 text-left font-medium">Visitor</th>
              <th className="text-left font-medium">City</th>
              <th className="text-left font-medium">Visits</th>
              <th className="text-left font-medium">Top intents</th>
              <th className="text-left font-medium">LTV</th>
              <th className="text-left font-medium">Last outcome</th>
              <th className="text-left font-medium">Last seen</th>
            </tr>
          </thead>
          <tbody className="text-text-primary">
            {rows.map((r) => (
              <tr
                key={r.visitorId}
                className="border-b border-border last:border-0 hover:bg-surface-muted transition-colors"
              >
                <td className="px-6 py-3 font-medium">{visitorLabel(r)}</td>
                <td className="text-text-secondary">{r.city ?? '—'}</td>
                <td className="tabular-nums">{r.sessionCount}</td>
                <td className="text-text-secondary">
                  {r.topIntents.slice(0, 3).join(', ') || '—'}
                </td>
                <td className="tabular-nums">{ltv(r.lifetimeValueCents)}</td>
                <td className="text-text-secondary">{r.lastOutcome ?? '—'}</td>
                <td className="text-text-secondary tabular-nums">{shortDate(r.lastSeen)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}
