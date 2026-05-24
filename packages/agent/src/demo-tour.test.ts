import { describe, expect, it } from 'vitest';
import { createTour, type TourBeat } from './demo-tour.js';

describe('createTour()', () => {
  it('starts in idle state', () => {
    const t = createTour();
    expect(t.state).toEqual({ status: 'idle' });
  });

  it('advances through the 3 beats on each next() call', () => {
    const t = createTour();
    t.start();
    expect(t.state.status).toBe('running');
    expect((t.state as any).beat).toBe('features');
    t.completeCurrentBeat();
    expect((t.state as any).beat).toBe('persona-swap');
    t.completeCurrentBeat();
    expect((t.state as any).beat).toBe('pricing');
    t.completeCurrentBeat();
    expect(t.state.status).toBe('completed');
  });

  it('pause() suspends, resume() continues at the same beat', () => {
    const t = createTour();
    t.start();
    t.pause();
    expect(t.state.status).toBe('paused');
    t.resume();
    expect(t.state.status).toBe('running');
    expect((t.state as any).beat).toBe('features');
  });

  it('startAt(beat) jumps to a specific beat', () => {
    const t = createTour();
    t.startAt('pricing');
    expect((t.state as any).beat).toBe('pricing');
  });

  it('end() returns to idle and clears progress', () => {
    const t = createTour();
    t.start();
    t.completeCurrentBeat();
    t.end();
    expect(t.state.status).toBe('idle');
  });

  it('describeNextBeat() returns the action list for the agent to plan', () => {
    const t = createTour();
    t.start();
    const plan = t.describeCurrentBeat();
    expect(plan.beat).toBe('features');
    expect(plan.actions.length).toBeGreaterThan(0);
    expect(plan.actions[0]).toMatchObject({ tool: expect.any(String) });
  });
});
