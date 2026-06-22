import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import type * as React from 'react';
import { getDashboardSession } from '@/lib/session';
import { getAudienceProfile } from '@/lib/audience-repo';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full border border-border bg-surface-muted px-2.5 py-1 text-xs font-medium text-text-primary">
      {children}
    </span>
  );
}

function ChipList({ items }: { items: string[] }) {
  if (items.length === 0) return <p className="text-sm text-text-secondary">—</p>;
  return (
    <div className="flex flex-wrap gap-2">
      {items.map((i) => (
        <Chip key={i}>{i}</Chip>
      ))}
    </div>
  );
}

export default async function AudienceDetailPage({
  params,
}: {
  params: Promise<{ visitorId: string }>;
}) {
  const { visitorId } = await params;
  const hdrs = await headers();
  const session = await getDashboardSession({ headers: hdrs });
  if (!session?.merchant) redirect('/app/onboarding?step=2');

  const profile = await getAudienceProfile({ merchantId: session.merchant.id, visitorId });

  if (!profile) {
    return (
      <div className="flex flex-col gap-6 max-w-3xl">
        <Link href="/app/audience" className="text-sm text-violet hover:underline">
          ← Back to audience
        </Link>
        <Card>
          <CardHeader>
            <CardTitle>Visitor not found</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-text-secondary">
              No profile exists for this visitor.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const identity = (profile.identity ?? {}) as Record<string, unknown>;
  const identityFields: { label: string; key: string }[] = [
    { label: 'Name', key: 'name' },
    { label: 'Phone', key: 'phone' },
    { label: 'Email', key: 'email' },
    { label: 'City', key: 'city' },
    { label: 'State', key: 'state' },
    { label: 'Pincode', key: 'pincode' },
    { label: 'Age', key: 'age' },
    { label: 'Language', key: 'language' },
  ];
  const presentIdentity = identityFields
    .map((f) => ({ label: f.label, value: identity[f.key] }))
    .filter((f) => f.value != null && String(f.value).trim() !== '');

  const name = typeof identity.name === 'string' && identity.name.trim() !== ''
    ? identity.name
    : profile.visitorId;

  const ltv = profile.lifetimeValueCents > 0 ? `₹${Math.round(profile.lifetimeValueCents / 100)}` : '—';

  return (
    <div className="flex flex-col gap-6 max-w-3xl">
      <div>
        <Link href="/app/audience" className="text-sm text-violet hover:underline">
          ← Back to audience
        </Link>
        <h1 className="mt-2 font-display text-2xl font-semibold tracking-tight text-text-primary">
          {name}
        </h1>
        <p className="text-sm text-text-secondary">Visitor profile</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Identity</CardTitle>
        </CardHeader>
        <CardContent>
          {presentIdentity.length === 0 ? (
            <p className="text-sm text-text-secondary">No identity captured yet.</p>
          ) : (
            <dl className="flex flex-col gap-1 text-sm">
              {presentIdentity.map((f) => (
                <div key={f.label} className="flex gap-2">
                  <dt className="text-text-secondary">{f.label}:</dt>
                  <dd className="text-text-primary">{String(f.value)}</dd>
                </div>
              ))}
            </dl>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Behaviour</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="flex flex-col gap-1 text-sm">
            <div className="flex gap-2">
              <dt className="text-text-secondary">Visits:</dt>
              <dd className="text-text-primary tabular-nums">{profile.sessionCount}</dd>
            </div>
            <div className="flex gap-2">
              <dt className="text-text-secondary">Lifetime value:</dt>
              <dd className="text-text-primary tabular-nums">{ltv}</dd>
            </div>
            <div className="flex gap-2">
              <dt className="text-text-secondary">Last outcome:</dt>
              <dd className="text-text-primary">{profile.lastOutcome ?? '—'}</dd>
            </div>
            <div className="flex gap-2">
              <dt className="text-text-secondary">Last drop stage:</dt>
              <dd className="text-text-primary">{profile.lastDropStage ?? '—'}</dd>
            </div>
            <div className="flex gap-2">
              <dt className="text-text-secondary">Last seen:</dt>
              <dd className="text-text-primary tabular-nums">{profile.lastSeen.toLocaleString()}</dd>
            </div>
          </dl>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Intents &amp; needs</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div>
            <p className="mb-2 text-xs uppercase tracking-wide text-text-muted">Top intents</p>
            <ChipList items={profile.topIntents} />
          </div>
          <div>
            <p className="mb-2 text-xs uppercase tracking-wide text-text-muted">Needs</p>
            <ChipList items={profile.needs} />
          </div>
          <div>
            <p className="mb-2 text-xs uppercase tracking-wide text-text-muted">Objections</p>
            <ChipList items={profile.objections} />
          </div>
          <div>
            <p className="mb-2 text-xs uppercase tracking-wide text-text-muted">Products of interest</p>
            <ChipList items={profile.productsOfInterest} />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
