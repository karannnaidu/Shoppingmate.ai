import type { ChatFn } from './checkout-extract.js';

export type LiveSignal = {
  intent: string;
  urgency: 'low' | 'medium' | 'high';
  objection: string | null;
  need: string | null;
};

const EMPTY: LiveSignal = { intent: 'browsing', urgency: 'low', objection: null, need: null };

const SYS = `You read the LAST few turns of a live shopping chat and output ONE compact JSON object: {intent, urgency, objection, need}.
- intent: short tag for what they want right now (e.g. browsing, comparing, ready_to_buy, price_check, support).
- urgency: "low" | "medium" | "high" — high = clear buy intent OR an active objection to resolve NOW.
- objection: the single biggest blocker they're voicing right now (e.g. price, delivery_time, trust, dosage), or null.
- need: the single concrete thing they want (a product, info, or outcome), or null.
Base it ONLY on the conversation. No prose, JSON only.`;

// Cheap per-turn classifier. Self-safe: returns a low-urgency empty signal on any failure.
export async function classifyLiveSignal(transcript: string, chat: ChatFn): Promise<LiveSignal> {
  try {
    const { text } = await chat([
      { role: 'system', content: SYS },
      { role: 'user', content: `Conversation so far:\n${transcript}\n\nReturn the JSON now.` },
    ]);
    const s = text.indexOf('{');
    const e = text.lastIndexOf('}');
    if (s < 0 || e <= s) return { ...EMPTY };
    const p = JSON.parse(text.slice(s, e + 1)) as Partial<LiveSignal>;
    const urgency = p.urgency === 'high' || p.urgency === 'medium' ? p.urgency : 'low';
    return {
      intent: typeof p.intent === 'string' && p.intent ? p.intent : 'browsing',
      urgency,
      objection: typeof p.objection === 'string' && p.objection ? p.objection : null,
      need: typeof p.need === 'string' && p.need ? p.need : null,
    };
  } catch {
    return { ...EMPTY };
  }
}

// Compact one-line steer for the next turn's system prompt. '' when nothing useful.
export function signalSteerLine(sig: LiveSignal): string {
  if (sig.urgency === 'low' && !sig.objection && !sig.need) return '';
  const bits = [`intent=${sig.intent}`, `urgency=${sig.urgency}`];
  if (sig.objection) bits.push(`objection=${sig.objection}`);
  if (sig.need) bits.push(`wants=${sig.need}`);
  return bits.join(' · ');
}

export type NudgeState = { lastNudgeTurn: number };
// Decide whether to fire ONE spoken nudge this turn. Fires only on a strong signal
// (high urgency with an objection, or high-urgency ready-to-buy) and at most once
// per 3 turns. Returns the line to speak, or null.
export function nextNudge(sig: LiveSignal, currentTurn: number, state: NudgeState): string | null {
  if (currentTurn - state.lastNudgeTurn < 3) return null;
  if (sig.urgency !== 'high') return null;
  if (sig.objection) return `The visitor has a live ${sig.objection} concern — address it head-on in one warm sentence and offer the next step.`;
  if (/buy|ready|purchase|checkout|order/i.test(sig.intent)) return `The visitor is ready to buy — proactively move them toward checkout now.`;
  return null;
}
