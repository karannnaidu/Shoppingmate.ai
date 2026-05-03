import { metricNames } from '@shoppingmate/db';
import { describe, expect, it } from 'vitest';

describe('metricNames registry — DOM adapter + selector resolver keys', () => {
  it('exposes the DOM adapter metrics', () => {
    expect(metricNames.domAction).toBe('dom.action');
    expect(metricNames.domActionFailed).toBe('dom.action.failed');
    expect(metricNames.domAdapterDegradedToSuggest).toBe('dom.adapter.degraded_to_suggest');
    expect(metricNames.domSessionActionCap).toBe('dom.session.action_cap');
  });

  it('exposes the selector resolver metrics', () => {
    expect(metricNames.selectorResolverHit).toBe('selector.resolver.hit');
    expect(metricNames.selectorResolverMiss).toBe('selector.resolver.miss');
    expect(metricNames.selectorResolverHealed).toBe('selector.resolver.healed');
    expect(metricNames.selectorResolverGaveUp).toBe('selector.resolver.gave_up');
    expect(metricNames.selectorOverrideFailing).toBe('selector.override.failing');
  });

  it('values stable for downstream metric consumers', () => {
    const values = Object.values(metricNames);
    expect(values).toContain('dom.action');
    expect(values).toContain('selector.resolver.healed');
  });
});
