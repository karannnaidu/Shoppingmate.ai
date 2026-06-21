import { desc, eq } from 'drizzle-orm';
import { visitorProfiles } from '@shoppingmate/db/schema';
import { db } from './db';

export type AudienceRow = {
  visitorId: string;
  name: string | null;
  city: string | null;
  topIntents: string[];
  needs: string[];
  sessionCount: number;
  lifetimeValueCents: number;
  lastOutcome: string | null;
  lastSeen: Date;
};

export async function listAudience(args: { merchantId: string; limit?: number }): Promise<AudienceRow[]> {
  const rows = await db
    .select()
    .from(visitorProfiles)
    .where(eq(visitorProfiles.merchantId, args.merchantId))
    .orderBy(desc(visitorProfiles.lastSeen))
    .limit(args.limit ?? 100);
  return rows.map((r) => {
    const id = (r.identity ?? {}) as { name?: string; city?: string };
    return {
      visitorId: r.visitorId,
      name: id.name ?? null,
      city: id.city ?? null,
      topIntents: (r.topIntents as string[]) ?? [],
      needs: (r.needs as string[]) ?? [],
      sessionCount: r.sessionCount,
      lifetimeValueCents: r.lifetimeValueCents,
      lastOutcome: r.lastOutcome,
      lastSeen: r.lastSeen,
    };
  });
}
