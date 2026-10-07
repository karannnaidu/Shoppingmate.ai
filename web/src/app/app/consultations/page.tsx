import Link from 'next/link';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { getDashboardSession } from '@/lib/session';
import { listConsultations } from '@/lib/consultations-repo';
import { Stethoscope } from 'lucide-react';
import { DashHeader, EmptyState } from '@/components/dashboard/v2';

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
      <DashHeader
        title="Consultations"
        description="Doctor-consultation requests your assistant took in the last 30 days, with the shopper's details. Open one to read the conversation."
      />

      {rows.length === 0 ? (
        <div className="card-v2">
          <EmptyState
            icon={Stethoscope}
            title="No consultation requests yet"
            body="When a shopper asks to talk to a doctor, your assistant takes their details and the request appears here."
          />
        </div>
      ) : (
        <div className="card-v2 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-surface-muted/50 text-left text-[11.5px] uppercase tracking-wider text-text-muted">
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
                <tr key={r.id} className="border-t border-border transition-colors hover:bg-surface-muted/50">
                  <td className="whitespace-nowrap px-4 py-3 text-text-secondary">
                    {r.createdAt.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}
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
