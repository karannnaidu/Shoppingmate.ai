import { headers } from 'next/headers';
import { NextResponse } from 'next/server';
import { buildInsightFacts } from '@shoppingmate/db/insights';
import { hasFeature } from '@shoppingmate/db/plans';
import { chat } from '@shoppingmate/shared';
import { db } from '@/lib/db';
import { getDashboardSession } from '@/lib/session';

// Nav PRD Phase 8.13c — "Ask about your store": answers ONLY from the store's
// own numbers (facts), in owner language, citing the numbers it used.

const SYS = `You answer a SHOP OWNER's question about their online store using ONLY the FACTS JSON.
- 2–4 short sentences, plain words, money and people (no jargon: never say conversion rate, funnel, session, bounce, LCP, CTR).
- Quote the specific numbers you used from FACTS.
- If FACTS don't contain what's needed, say "I don't have data on that yet" and suggest what you can answer.
- If there are fewer than 20 visits, say it's too early to be sure.
- Plain text only: no markdown, no asterisks, no bullet symbols.`;

export async function POST(req: Request) {
  const session = await getDashboardSession({ headers: await headers() });
  if (!session?.merchant) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  if (!hasFeature({ id: session.merchant.id, plan: session.merchant.plan }, 'insights')) {
    return NextResponse.json({ error: 'upgrade' }, { status: 402 });
  }
  const body = (await req.json().catch(() => ({}))) as { question?: string; qa?: boolean };
  const question = String(body.question ?? '').slice(0, 300).trim();
  if (!question) return NextResponse.json({ error: 'empty' }, { status: 400 });
  if (!process.env.OPENROUTER_API_KEY?.trim() && !process.env.GEMINI_API_KEY?.trim()) {
    return NextResponse.json({ answer: 'Answers are switching on shortly — check back soon.' });
  }

  const facts = await buildInsightFacts(db, session.merchant.id, { days: 7, qa: body.qa === true });
  // Shared client: falls back to Gemini when OpenRouter can't serve (402 etc.).
  let raw = '';
  try {
    const r = await chat({
      model: process.env.OPENROUTER_MODEL?.trim() || 'anthropic/claude-sonnet-4.6',
      maxTokens: 350,
      messages: [
        { role: 'system', content: SYS },
        { role: 'user', content: `FACTS:\n${JSON.stringify(facts)}\n\nQUESTION: ${question}` },
      ],
    });
    raw = r.text;
  } catch {
    return NextResponse.json({ answer: 'Sorry — I could not answer that right now. Try again in a moment.' });
  }
  const text = raw.replace(/\*\*|__/g, '').replace(/^#+\s*/gm, '').trim();
  return NextResponse.json({ answer: text || "I don't have data on that yet." });
}
