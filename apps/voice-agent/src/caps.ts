// Caps are a cost-control backstop, sized so a real transactional flow (a voice
// checkout where the visitor dictates name + phone + email spelled out + address
// + corrections + confirmation) can COMPLETE. The old 16-turn / 180-second limits
// tripped mid-checkout and the visitor lost everything on reload.
const TURN_WARN_AT = 26;
const TURN_TRIP_AT = 30;
const VOICE_SECONDS_TRIP = 360; // 6 minutes of actual speech
const WALL_CLOCK_TRIP_MS = 30 * 60 * 1000;

export type CapTrip = { cap: 'turns' | 'voice_seconds' | 'wall_clock' };
export type CapWarn = { cap: 'turns'; remaining: number };

export type SessionCaps = {
  start: () => void;
  recordTurn: () => void;
  recordVoiceSeconds: (s: number) => void;
  tick: () => void;
};

export function createSessionCaps(opts: {
  onWarn: (w: CapWarn) => void;
  onTrip: (t: CapTrip) => void;
  now?: () => number;
}): SessionCaps {
  const now = opts.now ?? (() => Date.now());
  let turns = 0;
  let voiceSeconds = 0;
  let startedAt = 0;
  let tripped = false;

  const trip = (cap: CapTrip['cap']) => {
    if (tripped) return;
    tripped = true;
    opts.onTrip({ cap });
  };

  return {
    start() {
      startedAt = now();
    },
    recordTurn() {
      turns++;
      if (turns === TURN_WARN_AT) {
        opts.onWarn({ cap: 'turns', remaining: TURN_TRIP_AT - turns });
      }
      if (turns >= TURN_TRIP_AT) trip('turns');
    },
    recordVoiceSeconds(s) {
      voiceSeconds += s;
      if (voiceSeconds >= VOICE_SECONDS_TRIP) trip('voice_seconds');
    },
    tick() {
      if (startedAt && now() - startedAt >= WALL_CLOCK_TRIP_MS) trip('wall_clock');
    },
  };
}
