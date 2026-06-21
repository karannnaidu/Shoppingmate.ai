import { describe, expect, it } from 'vitest';
import { aggregateIntents, type IntentTagRow } from './intent-insights';

const rows: IntentTagRow[] = [
  {
    intent: 'ready_to_buy',
    outcome: 'purchased',
    needs: ['sleep', 'stress'],
    objections: ['price'],
    dropStage: null,
  },
  {
    intent: 'ready_to_buy',
    outcome: 'abandoned',
    needs: ['sleep'],
    objections: ['price', 'shipping'],
    dropStage: 'checkout',
  },
  {
    intent: 'researching',
    outcome: 'abandoned',
    needs: ['stress'],
    objections: [],
    dropStage: 'cart',
  },
  {
    intent: null,
    outcome: 'in_progress',
    needs: [],
    objections: ['price'],
    dropStage: null,
  },
];

describe('aggregateIntents', () => {
  it('counts total rows', () => {
    expect(aggregateIntents(rows).total).toBe(4);
  });

  it('builds distribution sorted desc with unknown for null intent', () => {
    const { distribution } = aggregateIntents(rows);
    expect(distribution[0]).toEqual({ key: 'ready_to_buy', count: 2 });
    expect(distribution).toContainEqual({ key: 'researching', count: 1 });
    expect(distribution).toContainEqual({ key: 'unknown', count: 1 });
    // sorted descending by count
    for (let i = 1; i < distribution.length; i++) {
      expect(distribution[i - 1].count).toBeGreaterThanOrEqual(distribution[i].count);
    }
  });

  it('tallies topNeeds', () => {
    const { topNeeds } = aggregateIntents(rows);
    expect(topNeeds[0]).toEqual({ key: 'sleep', count: 2 });
    expect(topNeeds).toContainEqual({ key: 'stress', count: 2 });
  });

  it('tallies topObjections', () => {
    const { topObjections } = aggregateIntents(rows);
    expect(topObjections[0]).toEqual({ key: 'price', count: 3 });
    expect(topObjections).toContainEqual({ key: 'shipping', count: 1 });
  });

  it('counts dropStages only for abandoned rows with a non-empty dropStage', () => {
    const { dropStages } = aggregateIntents(rows);
    expect(dropStages).toContainEqual({ key: 'checkout', count: 1 });
    expect(dropStages).toContainEqual({ key: 'cart', count: 1 });
    // purchased + in_progress rows must not contribute
    const totalDrop = dropStages.reduce((s, d) => s + d.count, 0);
    expect(totalDrop).toBe(2);
  });
});
