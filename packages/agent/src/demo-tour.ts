export type TourBeat = 'features' | 'persona-swap' | 'pricing';

export type TourState =
  | { status: 'idle' }
  | { status: 'running'; beat: TourBeat }
  | { status: 'paused'; beat: TourBeat }
  | { status: 'completed' };

export type BeatPlan = {
  beat: TourBeat;
  /** Human-readable narration the agent layers between actions. */
  narration: string;
  actions: Array<{ tool: string; args: Record<string, unknown> }>;
};

const BEAT_ORDER: TourBeat[] = ['features', 'persona-swap', 'pricing'];

const BEAT_PLANS: Record<TourBeat, BeatPlan> = {
  features: {
    beat: 'features',
    narration:
      "Let me show you the three things shoppingmate does. I'll walk you through each in about twenty seconds.",
    actions: [
      { tool: 'site.navigate', args: { path: '/' } },
      { tool: 'site.scroll_to', args: { intent: 'features section' } },
      { tool: 'site.highlight', args: { intent: 'voice card', duration_ms: 2500 } },
      { tool: 'site.highlight', args: { intent: 'personas card', duration_ms: 2500 } },
      { tool: 'site.highlight', args: { intent: 'install card', duration_ms: 2500 } },
    ],
  },
  'persona-swap': {
    beat: 'persona-swap',
    narration:
      "Here's the cool part — I can sound like any brand. Watch me switch personas mid-sentence.",
    actions: [],
  },
  pricing: {
    beat: 'pricing',
    narration:
      'Last stop — pricing. The Starter plan is the easiest entry. Let me show you the card and the number.',
    actions: [
      { tool: 'site.navigate', args: { path: '/pricing' } },
      { tool: 'site.scroll_to', args: { intent: 'plan grid' } },
      { tool: 'site.highlight', args: { intent: 'starter plan card', duration_ms: 3000 } },
      { tool: 'pricing.quote', args: { plan_id: 'starter' } },
    ],
  },
};

export type Tour = {
  state: TourState;
  start(): void;
  startAt(beat: TourBeat): void;
  pause(): void;
  resume(): void;
  completeCurrentBeat(): void;
  end(): void;
  describeCurrentBeat(): BeatPlan;
};

export function createTour(): Tour {
  let state: TourState = { status: 'idle' };
  const api: Tour = {
    get state() { return state; },
    start() {
      state = { status: 'running', beat: 'features' };
    },
    startAt(beat) {
      state = { status: 'running', beat };
    },
    pause() {
      if (state.status === 'running') state = { status: 'paused', beat: state.beat };
    },
    resume() {
      if (state.status === 'paused') state = { status: 'running', beat: state.beat };
    },
    completeCurrentBeat() {
      if (state.status !== 'running') return;
      const idx = BEAT_ORDER.indexOf(state.beat);
      const next = BEAT_ORDER[idx + 1];
      state = next ? { status: 'running', beat: next } : { status: 'completed' };
    },
    end() {
      state = { status: 'idle' };
    },
    describeCurrentBeat() {
      if (state.status !== 'running' && state.status !== 'paused') {
        throw new Error('describeCurrentBeat: tour is not running');
      }
      return BEAT_PLANS[state.beat];
    },
  };
  return api;
}
