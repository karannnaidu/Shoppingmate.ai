import { headers } from 'next/headers';
import { NextResponse } from 'next/server';
import { buildInsightFacts } from '@shoppingmate/db/insights';
import { hasFeature } from '@shoppingmate/db/plans';
import { db } from '@/lib/db';
import { getDashboardSession } from '@/lib/session';

// Nav PRD Phase 8.13c — "Ask about your store": answers ONLY from the store's
// own numbers (facts), in owner language, citing the numbers it used.

const SYS = `You answer a SHOP OWNER's question about their online store using ONLY the FACTS JSON.
- 2–4 short sentences, plain words, money and people (no jargon: never say conversion rate, funnel, session, bounce, LCP, CTR).
- Quote the specific numbers you used from FACTS.
- If FACTS don't contain what's needed, say "I don't have data on that yet" and suggest what you can answer.
- If there are fewer than 20 visits, say it's too early to be sure.`;

export async function POST(req: Request) {
  const session = await getDashboardSession({ headers: await headers() });
  if (!session?.merchant) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  if (!hasFeature({ id: session.merchant.id, plan: session.merchant.plan }, 'insights')) {
    return NextResponse.json({ error: 'upgrade' }, { status: 402 });
  }
  const body = (await req.json().catch(() => ({}))) as { question?: string; qa?: boolean };
  const question = String(body.question ?? '').slice(0, 300).trim();
  if (!question) return NextResponse.json({ error: 'empty' }, { status: 400 });
  const key = process.env.OPENROUTER_API_KEY?.trim();
  if (!key) return NextResponse.json({ answer: 'Answers are switching on shortly — check back soon.' });

  const facts = await buildInsightFacts(db, session.merchant.id, { days: 7, qa: body.qa === true });
  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json' },
    body: JSON.stringify({
      model: process.env.OPENROUTER_MODEL?.trim() || 'anthropic/claude-sonnet-4.6',
      max_tokens: 350,
      messages: [
        { role: 'system', content: SYS },
        { role: 'user', content: `FACTS:\n${JSON.stringify(facts)}\n\nQUESTION: ${question}` },
      ],
    }),
  });
  if (!res.ok) return NextResponse.json({ answer: 'Sorry — I could not answer that right now. Try again in a moment.' });
  const j = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
  return NextResponse.json({ answer: j.choices?.[0]?.message?.content?.trim() || "I don't have data on that yet." });
}
