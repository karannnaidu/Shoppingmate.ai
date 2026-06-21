import { and, eq } from 'drizzle-orm';
import type { IntentRecord } from '@shoppingmate/shared';
import { db } from '../client.js';
import { visitorProfiles } from '../schema/visitorProfiles.js';

export type ProfileRow = {
  id: string; merchantId: string; visitorId: string;
  identity: IntentRecord['identity'];
  topIntents: string[]; needs: string[]; objections: string[]; productsOfInterest: string[];
  lastOutcome: string | null; lastDropStage: string | null;
  sessionCount: number; lifetimeValueCents: number; lastSeen: Date;
};

type MergedFields = Omit<ProfileRow, 'id' | 'merchantId' | 'visitorId' | 'lastSeen'>;

const uniq = (a: string[]) => Array.from(new Set(a.filter(Boolean)));

export function mergeProfile(
  prev: Pick<ProfileRow, 'identity' | 'topIntents' | 'needs' | 'objections' | 'productsOfInterest' | 'sessionCount' | 'lifetimeValueCents'> | null,
  rec: IntentRecord,
  end: { outcome: string; attributedCents: number },
): MergedFields {
  return {
    identity: { ...(prev?.identity ?? {}), ...rec.identity },
    topIntents: uniq([...(prev?.topIntents ?? []), rec.intent]),
    needs: uniq([...(prev?.needs ?? []), ...rec.needs]),
    objections: uniq([...(prev?.objections ?? []), ...rec.objections]),
    productsOfInterest: uniq([...(prev?.productsOfInterest ?? []), ...(rec.preferences.products ?? [])]),
    lastOutcome: end.outcome,
    lastDropStage: rec.dropStage,
    sessionCount: (prev?.sessionCount ?? 0) + 1,
    lifetimeValueCents: (prev?.lifetimeValueCents ?? 0) + Math.max(0, end.attributedCents),
  };
}

export async function loadVisitorProfile(merchantId: string, visitorId: string): Promise<ProfileRow | null> {
  const rows = await db.select().from(visitorProfiles)
    .where(and(eq(visitorProfiles.merchantId, merchantId), eq(visitorProfiles.visitorId, visitorId))).limit(1);
  return (rows[0] as ProfileRow) ?? null;
}

export async function upsertVisitorProfile(
  merchantId: string, visitorId: string, rec: IntentRecord, end: { outcome: string; attributedCents: number },
): Promise<void> {
  const prev = await loadVisitorProfile(merchantId, visitorId);
  const merged = mergeProfile(prev, rec, end);
  const id = `${merchantId}:${visitorId}`;
  await db.insert(visitorProfiles).values({ id, merchantId, visitorId, ...merged, lastSeen: new Date() } as never)
    .onConflictDoUpdate({ target: visitorProfiles.id, set: { ...merged, lastSeen: new Date() } as never });
}
