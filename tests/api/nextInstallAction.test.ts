import { describe, expect, it } from 'vitest';
import { nextInstallAction } from '../../apps/api/src/lib/nextInstallAction.js';

const NOW = new Date('2026-04-30T12:00:00Z');
const ONE_HOUR = 60 * 60 * 1000;

describe('nextInstallAction', () => {
  it('enqueues when status=pending', () => {
    expect(nextInstallAction({ status: 'pending', lastInstallAt: null }, NOW)).toEqual({
      kind: 'enqueue',
    });
  });

  it('enqueues when status=failed', () => {
    expect(
      nextInstallAction(
        { status: 'failed', lastInstallAt: new Date(NOW.getTime() - ONE_HOUR) },
        NOW,
      ),
    ).toEqual({ kind: 'enqueue' });
  });

  it('noops when status=onboarding and last install <24h ago', () => {
    expect(
      nextInstallAction(
        { status: 'onboarding', lastInstallAt: new Date(NOW.getTime() - ONE_HOUR) },
        NOW,
      ),
    ).toEqual({ kind: 'noop' });
  });

  it('noops when status=onboarding and lastInstallAt is null (just transitioned)', () => {
    expect(nextInstallAction({ status: 'onboarding', lastInstallAt: null }, NOW)).toEqual({
      kind: 'noop',
    });
  });

  it('re-enqueues when status=onboarding and last install >24h ago', () => {
    expect(
      nextInstallAction(
        { status: 'onboarding', lastInstallAt: new Date(NOW.getTime() - 25 * ONE_HOUR) },
        NOW,
      ),
    ).toEqual({ kind: 'enqueue' });
  });

  it('noops when status=live', () => {
    expect(
      nextInstallAction({ status: 'live', lastInstallAt: new Date(NOW.getTime() - ONE_HOUR) }, NOW),
    ).toEqual({ kind: 'noop' });
  });

  it('noops when status=rejected (terminal)', () => {
    expect(
      nextInstallAction(
        { status: 'rejected', lastInstallAt: new Date(NOW.getTime() - ONE_HOUR) },
        NOW,
      ),
    ).toEqual({ kind: 'noop' });
  });
});
