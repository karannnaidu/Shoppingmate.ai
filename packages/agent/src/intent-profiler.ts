import type { ChatFn } from './checkout-extract.js';

export const INTENTS = [
  'browsing', 'researching', 'comparing', 'ready_to_buy', 'price_sensitive',
  'support_issue', 'medical_consult', 'bulk_b2b', 'post_purchase',
] as const;
export type Intent = (typeof INTENTS)[number];

export type ConversationFacts = {
  cartAdds: number;
  checkoutReached: boolean;
  purchased: boolean;
  mode: 'voice' | 'text';
};

export type IntentRecord = {
  intent: Intent;
  intentConfidence: number;
  needs: string[];
  objections: string[];
  preferences: { products?: string[]; flavours?: string[]; blissClub?: boolean; coupon?: string };
  affect: { sentiment: 'positive' | 'neutral' | 'negative'; confused?: boolean };
  identity: { name?: string; phone?: string; email?: string; city?: string; pincode?: string; age?: number; language?: string };
  dropStage: string | null;
};

export type ProfileResult = { ok: true; record: IntentRecord };

const EMPTY: IntentRecord = {
  intent: 'browsing', intentConfidence: 0, needs: [], objections: [],
  preferences: {}, affect: { sentiment: 'neutral' }, identity: {}, dropStage: null,
};

const SYSTEM = `You analyze a finished shopping conversation transcript (English/Hindi/Hinglish) and output ONE JSON object with keys: intent, intentConfidence, needs, objections, preferences, affect, identity, dropStage.
- intent MUST be one of: ${INTENTS.join(', ')}.
- intentConfidence: 0..1. needs/objections: short lowercase tags. preferences: {products[],flavours[],blissClub,coupon}. affect: {sentiment: positive|neutral|negative, confused}. identity: only fields the visitor actually gave (name,phone,email,city,pincode,age,language). dropStage: where they stopped, or null.
- NEVER invent identity values. If unsure, omit.`;

export async function extractConversationProfile(
  transcript: string,
  facts: ConversationFacts,
  chat: ChatFn,
): Promise<ProfileResult> {
  let parsed: Partial<IntentRecord> = {};
  try {
    const { text } = await chat([
      { role: 'system', content: SYSTEM },
      { role: 'user', content: `Funnel facts: ${JSON.stringify(facts)}\n\nTranscript:\n${transcript}\n\nReturn the JSON now.` },
    ]);
    const s = text.indexOf('{');
    const e = text.lastIndexOf('}');
    if (s >= 0 && e > s) parsed = JSON.parse(text.slice(s, e + 1)) as Partial<IntentRecord>;
  } catch {
    return { ok: true, record: { ...EMPTY } };
  }
  const intent = (INTENTS as readonly string[]).includes(parsed.intent as string)
    ? (parsed.intent as Intent)
    : 'browsing';
  return {
    ok: true,
    record: {
      ...EMPTY,
      ...parsed,
      intent,
      intentConfidence: typeof parsed.intentConfidence === 'number' ? parsed.intentConfidence : 0,
      needs: Array.isArray(parsed.needs) ? parsed.needs.map(String) : [],
      objections: Array.isArray(parsed.objections) ? parsed.objections.map(String) : [],
      preferences: parsed.preferences ?? {},
      affect: { sentiment: parsed.affect?.sentiment ?? 'neutral', confused: parsed.affect?.confused },
      identity: parsed.identity ?? {},
      dropStage: parsed.dropStage ?? null,
    },
  };
}
