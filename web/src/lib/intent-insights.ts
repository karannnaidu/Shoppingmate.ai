export type IntentTagRow = {
  intent: string | null;
  outcome: string | null;
  needs: string[];
  objections: string[];
  dropStage: string | null;
};
export type Counted = { key: string; count: number };
export type IntentInsights = {
  total: number;
  distribution: Counted[];
  topNeeds: Counted[];
  topObjections: Counted[];
  dropStages: Counted[];
};

const tally = (items: string[]): Counted[] => {
  const m = new Map<string, number>();
  for (const raw of items) {
    const k = (raw ?? '').trim();
    if (!k) continue;
    m.set(k, (m.get(k) ?? 0) + 1);
  }
  return [...m.entries()].map(([key, count]) => ({ key, count })).sort((a, b) => b.count - a.count);
};

export function aggregateIntents(rows: IntentTagRow[]): IntentInsights {
  return {
    total: rows.length,
    distribution: tally(rows.map((r) => r.intent ?? 'unknown')),
    topNeeds: tally(rows.flatMap((r) => r.needs ?? [])),
    topObjections: tally(rows.flatMap((r) => r.objections ?? [])),
    dropStages: tally(rows.filter((r) => r.outcome === 'abandoned').map((r) => r.dropStage ?? '').filter(Boolean)),
  };
}
