import Link from 'next/link';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { getDashboardSession } from '@/lib/session';
import { listConsultations } from '@/lib/consultations-repo';

// Consultations is a Calmosis-only feature — keep other tenants out of the page.
const CALMOSIS_MERCHANT_ID = 'SM-2SCCLZ';

export default async function ConsultationsPage() {
  const hdrs = await headers();
  const session = await getDashboardSession({ headers: hdrs });
  if (!session?.merchant) redirect('/app/onboarding?step=2');
  if (session.merchant.id !== CALMOSIS_MERCHANT_ID) redirect('/app');

  const rows = await listConsultations({ merchantId: session.merchant.id, days: 30 });

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-2xl font-semibold tracking-tight text-text-primary">
          Consultations
        </h1>
        <p className="mt-1 text-sm text-text-secondary">
          Doctor-consultation requests the assistant captured in the last 30 days. Click a row to open
          the conversation transcript.
        </p>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-lg border border-border bg-surface/60 p-8 text-center text-text-secondary">
          No consultation requests yet. When a visitor asks to talk to a doctor, the assistant collects
          their details and they appear here.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="bg-surface-muted text-left text-text-secondary">
              <tr>
                <th className="px-4 py-2 font-medium">Date</th>
                <th className="px-4 py-2 font-medium">Name</th>
                <th className="px-4 py-2 font-medium">Age</th>
                <th className="px-4 py-2 font-medium">Condition</th>
                <th className="px-4 py-2 font-medium">Phone</th>
                <th className="px-4 py-2 font-medium">Status</th>
                <th className="px-4 py-2 font-medium">Transcript</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-t border-border hover:bg-surface-muted/50">
                  <td className="px-4 py-2 text-text-secondary">
                    {r.createdAt.toISOString().slice(0, 10)}
                  </td>
                  <td className="px-4 py-2">{r.name}</td>
                  <td className="px-4 py-2">{r.age}</td>
                  <td className="px-4 py-2 text-text-secondary">{r.condition ?? '—'}</td>
                  <td className="px-4 py-2 font-mono text-xs">
                    {r.phoneCountryCode} {r.phone}
                  </td>
                  <td className="px-4 py-2 text-xs uppercase tracking-wide">{r.status}</td>
                  <td className="px-4 py-2">
                    {r.sessionId ? (
                      <Link
                        href={`/app/conversations/${r.sessionId}`}
                        className="text-violet hover:underline"
                      >
                        View
                      </Link>
                    ) : (
                      <span className="text-text-secondary">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
