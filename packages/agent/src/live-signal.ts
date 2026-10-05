import type { ChatFn } from './checkout-extract.js';

// Conversation modes (nav PRD Phase 5) — what the visitor is doing right now,
// which decides HOW the assistant behaves (pace, tone, selling or not).
export const MODES = ['browse', 'compare', 'buy', 'support', 'complaint', 'consult'] as const;
export type ConversationMode = (typeof MODES)[number];

export type LiveSignal = {
  intent: string;
  urgency: 'low' | 'medium' | 'high';
  objection: string | null;
  need: string | null;
  // Phase 5 (optional for back-compat with older callers/tests).
  mode?: ConversationMode;
  sentiment?: 'positive' | 'neutral' | 'negative' | 'angry';
};

const EMPTY: LiveSignal = { intent: 'browsing', urgency: 'low', objection: null, need: null };

const SYS = `You read the LAST few turns of a live shopping chat and output ONE compact JSON object: {intent, urgency, objection, need, mode, sentiment}.
- intent: short tag for what they want right now (e.g. browsing, comparing, ready_to_buy, price_check, support).
- urgency: "low" | "medium" | "high" — high = clear buy intent OR an active objection/problem to resolve NOW.
- objection: the single biggest blocker they're voicing right now (e.g. price, delivery_time, trust, dosage), or null.
- need: the single concrete thing they want (a product, info, or outcome), or null.
- mode: one of browse | compare | buy | support | complaint | consult — browse = exploring; compare = weighing options; buy = ready to purchase / checking out; support = order status, delivery, account, how-to; complaint = something went wrong / unhappy; consult = health/suitability/dosage advice.
- sentiment: positive | neutral | negative | angry.
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
    const mode = (MODES as readonly string[]).includes(String(p.mode))
      ? (p.mode as ConversationMode)
      : undefined;
    const sentiment =
      p.sentiment === 'positive' ||
      p.sentiment === 'negative' ||
      p.sentiment === 'angry' ||
      p.sentiment === 'neutral'
        ? p.sentiment
        : undefined;
    return {
      intent: typeof p.intent === 'string' && p.intent ? p.intent : 'browsing',
      urgency,
      objection: typeof p.objection === 'string' && p.objection ? p.objection : null,
      need: typeof p.need === 'string' && p.need ? p.need : null,
      ...(mode ? { mode } : {}),
      ...(sentiment ? { sentiment } : {}),
    };
  } catch {
    return { ...EMPTY };
  }
}

// Compact one-line steer for the next turn's system prompt. '' when nothing useful.
export function signalSteerLine(sig: LiveSignal): string {
  const unhappy =
    sig.sentiment === 'angry' || sig.sentiment === 'negative' || sig.mode === 'complaint';
  const informative = sig.mode && sig.mode !== 'browse';
  if (sig.urgency === 'low' && !sig.objection && !sig.need && !unhappy && !informative) return '';
  const bits = [];
  if (sig.mode) bits.push(`mode=${sig.mode}`);
  bits.push(`intent=${sig.intent}`, `urgency=${sig.urgency}`);
  if (sig.sentiment && sig.sentiment !== 'neutral') bits.push(`sentiment=${sig.sentiment}`);
  if (sig.objection) bits.push(`objection=${sig.objection}`);
  if (sig.need) bits.push(`wants=${sig.need}`);
  return bits.join(' · ');
}

// Same-turn fast path (no LLM, no latency): the classifier above lags one turn,
// so obvious "something went wrong" / support / ready-to-buy cues in the CURRENT
// message set the mode immediately. Returns null when nothing is clear.
const COMPLAINT_RE =
  /\b(broken|damaged|leak(ing|ed)?|wrong (item|product)|never (arrived|came)|refund|worst|terrible|awful|scam|fraud|complain|angry|furious|disappointed|useless|1[- ]?star|one star|rip[- ]?off)\b/i;
const SUPPORT_RE =
  /\b(where('?s| is) my order|track(ing)?|order (status|number|#?\d{3,})|deliver(y|ed)|shipping status|cancel (my )?order|return)\b/i;
const BUY_RE =
  /\b(check ?out|buy (it|now|this)|place (the|my) order|i'?ll take|add (it|this|one|two|\d) to (my )?cart|pay now)\b/i;

export function quickMode(text: string): { mode: ConversationMode; sentiment?: 'negative' } | null {
  if (COMPLAINT_RE.test(text)) return { mode: 'complaint', sentiment: 'negative' };
  if (SUPPORT_RE.test(text)) return { mode: 'support' };
  if (BUY_RE.test(text)) return { mode: 'buy' };
  return null;
}

export type NudgeState = { lastNudgeTurn: number };
// Decide whether to fire ONE spoken nudge this turn. Fires only on a strong signal
// (high urgency with an objection, or high-urgency ready-to-buy) and at most once
// per 3 turns. Returns the line to speak, or null. Never nudges toward a sale
// when the visitor is unhappy.
export function nextNudge(sig: LiveSignal, currentTurn: number, state: NudgeState): string | null {
  if (currentTurn - state.lastNudgeTurn < 3) return null;
  if (sig.urgency !== 'high') return null;
  if (sig.mode === 'complaint' || sig.sentiment === 'angry') {
    return 'The visitor is unhappy — acknowledge it sincerely in one sentence, do not sell anything, and offer to get the team to help.';
  }
  if (sig.objection)
    return `The visitor has a live ${sig.objection} concern — address it head-on in one warm sentence and offer the next step.`;
  if (/buy|ready|purchase|checkout|order/i.test(sig.intent))
    return `The visitor is ready to buy — proactively move them toward checkout now.`;
  return null;
}
