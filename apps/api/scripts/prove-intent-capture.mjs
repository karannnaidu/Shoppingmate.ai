// Phase 1 (intent capture) end-to-end proof — runs the EXACT session-end path
// headlessly against the real DB + real OpenRouter, with no mic/browser needed:
//   1. real LLM extraction over a transcript  -> IntentRecord
//   2. conversationCompleted metric row with tags.intent (the dashboard record)
//   3. two sessions for ONE visitor -> upsert + merge -> visitor_profiles row
// Prints every artifact so we can SEE it worked.
import 'dotenv/config';
import { db, schema } from '@shoppingmate/db';
import { upsertVisitorProfile, loadVisitorProfile } from '@shoppingmate/db';
import { extractConversationProfile } from '@shoppingmate/agent';
import { chat } from '@shoppingmate/shared';
import { eq, and, desc } from 'drizzle-orm';

const MERCHANT = process.env.PROVE_MERCHANT_ID ?? 'SM-XPK2EN'; // Calmosis dogfood tenant
const VISITOR = `prove_${Date.now()}`;

const profileChat = (messages) =>
  chat({
    model: process.env.OPENROUTER_CHECKOUT_MODEL ?? process.env.OPENROUTER_MODEL ?? 'anthropic/claude-sonnet-4.6',
    messages,
    responseFormat: 'json',
    maxTokens: 512,
  });

// A realistic finished Calmosis conversation: returning-ish buyer, sleep need,
// price objection, gave identity, reached checkout, abandoned at address.
const transcript = [
  'user: Hi, I keep waking up at 3am and can\'t fall back asleep. Do you have something natural?',
  'agent: Our Sleep Mantra is made for exactly that — it calms the nervous system without grogginess. Want me to tell you how it works?',
  'user: Yeah. But honestly it feels a bit pricey for me.',
  'agent: I hear you. It lasts about 30 nights, and there\'s a first-order discount. Should I apply it?',
  'user: Ok add it to cart. My name is Karan, phone 9876543210, I\'m in Mumbai.',
  'agent: Added Sleep Mantra and applied the discount. Taking you to checkout now.',
  'user: Actually let me think about the delivery, I\'ll come back later.',
].join('\n');

const facts = { cartAdds: 1, checkoutReached: true, purchased: false, mode: 'voice' };

console.log('=== STEP 1: real LLM extraction (session-end profiler) ===');
const { record } = await extractConversationProfile(transcript, facts, profileChat);
console.log(JSON.stringify(record, null, 2));

console.log('\n=== STEP 2: conversationCompleted metric row WITH tags.intent ===');
const tags = {
  session_id: VISITOR + '_s1',
  mode: 'voice',
  duration_sec: 92,
  turns: 7,
  outcome: 'abandoned',
  attributed_cents: 0,
  cart_adds: 1,
  checkout_reached: true,
  transcript: transcript.split('\n').map((line, i) => {
    const [role, ...rest] = line.split(': ');
    return { role: role === 'user' ? 'user' : 'agent', content: rest.join(': '), timestamp: i * 1000 };
  }),
  intent: record,
};
await db.insert(schema.metricEvents).values({ merchantId: MERCHANT, metricName: 'conversationCompleted', tags });
const [row] = await db
  .select()
  .from(schema.metricEvents)
  .where(and(eq(schema.metricEvents.merchantId, MERCHANT), eq(schema.metricEvents.metricName, 'conversationCompleted')))
  .orderBy(desc(schema.metricEvents.ts))
  .limit(1);
console.log('stored metricEvent.tags.intent =', JSON.stringify(row?.tags?.intent, null, 2));

console.log('\n=== STEP 3: visitor profile upsert + cross-session merge ===');
await upsertVisitorProfile(MERCHANT, VISITOR, record, { outcome: tags.outcome, attributedCents: tags.attributed_cents });
const after1 = await loadVisitorProfile(MERCHANT, VISITOR);
console.log('after session 1:', JSON.stringify(
  { sessionCount: after1.sessionCount, topIntents: after1.topIntents, needs: after1.needs, objections: after1.objections, identity: after1.identity, ltv: after1.lifetimeValueCents }, null, 2));

// Session 2: same visitor returns and BUYS — proves merge (accumulate + sum LTV + bump count + latest-wins identity)
const record2 = {
  ...record,
  intent: 'ready_to_buy',
  needs: ['sleep', 'stress'],
  objections: [],
  identity: { ...record.identity, email: 'karan@example.com' },
  preferences: { products: ['sleep-mantra'] },
};
await upsertVisitorProfile(MERCHANT, VISITOR, record2, { outcome: 'purchased', attributedCents: 149900 });
const after2 = await loadVisitorProfile(MERCHANT, VISITOR);
console.log('after session 2 (merged):', JSON.stringify(
  { sessionCount: after2.sessionCount, topIntents: after2.topIntents, needs: after2.needs, objections: after2.objections, identity: after2.identity, lastOutcome: after2.lastOutcome, ltv: after2.lifetimeValueCents }, null, 2));

console.log('\n=== PROOF SUMMARY ===');
console.log('intent captured           :', record.intent, `(conf ${record.intentConfidence})`);
console.log('conversationCompleted.intent present :', !!row?.tags?.intent);
console.log('visitor sessionCount 1->2 :', after1.sessionCount, '->', after2.sessionCount);
console.log('LTV summed (cents)        :', after2.lifetimeValueCents, '(149900 expected)');
console.log('identity latest-wins+merge:', after2.identity.name, after2.identity.email, after2.identity.city);
console.log('needs accumulated         :', after2.needs.join(', '));

await db.$client?.end?.();
process.exit(0);
