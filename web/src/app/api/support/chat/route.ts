import { headers } from 'next/headers';
import { NextResponse } from 'next/server';
import { chatTools } from '@shoppingmate/shared';
import { getDashboardSession } from '@/lib/session';
import { SUPPORT_GUIDE } from '@/lib/support-guide';
import { createTicket, storeStatus, validateTicket } from '@/lib/support-tools';

// Brand support assistant (multi-segment PRD Phase 3). Owners ask "how do I…",
// "why isn't…", or tell us what to build; it answers from the help guide and
// their live setup, and files tickets to our team when they want.

type Msg = { role: 'user' | 'assistant'; text: string };

const SYS = (brand: string) => `You are the shoppingmate support assistant inside ${brand}'s dashboard. You help the store owner (not shoppers) use shoppingmate, fix setup problems, and send their bugs, feature requests and billing questions to the shoppingmate team.

RULES
- Answer from the HELP GUIDE and from store_status (call it whenever their question depends on their own setup: install, products, pages, plan, usage, requests). Quote what you found in plain words ("your assistant was last seen on your site 3 days ago").
- Short, friendly, plain English; no jargon; 1–4 sentences unless they ask for steps. Plain text, no markdown symbols.
- If you can't fix it from the guide, or they report a bug, ask for a feature, or have a billing question: offer to send it to the team. Before calling create_ticket, read back a one-line title and ask "shall I send this?"; only call it after they say yes. Choose kind: bug (something broken), feature (something to build or improve), question, billing, setup (install/products/pages help).
- After filing, tell them the ticket number and that they'll see its status on this page.
- Never promise dates, refunds or features — the team decides. Never invent settings or pages that aren't in the guide.

HELP GUIDE
${SUPPORT_GUIDE}`;

const TOOLS = [
  {
    type: 'function' as const,
    function: {
      name: 'store_status',
      description: "Look up this store's live setup: install, web addresses, products, pages read, knowledge, plan & usage, requests, alerts.",
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'create_ticket',
      description: 'Send a bug report, feature request, question, billing or setup request to the shoppingmate team. Only after the owner confirmed.',
      parameters: {
        type: 'object',
        properties: {
          kind: { type: 'string', enum: ['bug', 'feature', 'question', 'billing', 'setup', 'other'] },
          title: { type: 'string', description: 'One line, in the owner’s words' },
          details: { type: 'string', description: 'What happened / what they want, steps, page, expected vs actual' },
          priority: { type: 'string', enum: ['low', 'normal', 'high'], description: 'high only if their store is broken or losing sales now' },
        },
        required: ['kind', 'title', 'details'],
      },
    },
  },
];

export async function POST(req: Request) {
  const session = await getDashboardSession({ headers: await headers() });
  if (!session?.merchant) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const body = (await req.json().catch(() => ({}))) as { messages?: Msg[] };
  const history = (body.messages ?? [])
    .filter((m) => (m.role === 'user' || m.role === 'assistant') && typeof m.text === 'string')
    .slice(-16)
    .map((m) => ({ role: m.role, text: m.text.slice(0, 2000) }));
  if (history.length === 0 || history[history.length - 1]!.role !== 'user') {
    return NextResponse.json({ error: 'empty' }, { status: 400 });
  }
  const merchantId = session.merchant.id;
  const brand = session.merchant.name ?? session.merchant.domain ?? 'your store';

  type Wire = Parameters<typeof chatTools>[0]['messages'][number];
  const messages: Wire[] = [
    { role: 'system', content: SYS(brand) },
    ...history.map((m) => ({ role: m.role, content: m.text }) as Wire),
  ];
  let ticketId: number | null = null;
  try {
    for (let round = 0; round < 4; round++) {
      const r = await chatTools({
        model: process.env.OPENROUTER_MODEL?.trim() || 'anthropic/claude-sonnet-4.6',
        messages,
        tools: TOOLS,
        maxTokens: 600,
        timeoutMs: 45_000,
      });
      if (r.toolCalls.length === 0) {
        const reply = r.text.replace(/\*\*|__/g, '').replace(/^#+\s*/gm, '').trim();
        return NextResponse.json({ reply: reply || 'Sorry — could you say that another way?', ticketId });
      }
      messages.push({
        role: 'assistant',
        content: r.text || null,
        tool_calls: r.toolCalls.map((c) => ({ id: c.id, type: 'function', function: { name: c.name, arguments: c.argumentsJson } })),
      } as Wire);
      for (const call of r.toolCalls) {
        let result: unknown;
        if (call.name === 'store_status') {
          result = await storeStatus(merchantId);
        } else if (call.name === 'create_ticket') {
          let args: Record<string, unknown> = {};
          try {
            args = JSON.parse(call.argumentsJson);
          } catch {
            /* invalid json → validation error below */
          }
          const v = validateTicket(args);
          if (!v.ok) result = { ok: false, reason: v.reason };
          else {
            const t = await createTicket({
              merchantId,
              userEmail: session.user.email,
              ticket: v.value,
              transcript: history.map((m) => ({ role: m.role, text: m.text })),
            });
            ticketId = t.id;
            result = { ok: true, ticketNumber: t.id };
          }
        } else {
          result = { ok: false, reason: 'unknown tool' };
        }
        messages.push({ role: 'tool', tool_call_id: call.id, content: JSON.stringify(result) } as Wire);
      }
    }
    return NextResponse.json({ reply: ticketId ? `Done — I've sent that to the team as ticket #${ticketId}.` : 'Sorry — I got stuck. Could you try again?', ticketId });
  } catch (err) {
    console.error('[support] chat failed', err);
    return NextResponse.json(
      { reply: "Sorry — I can't answer right now. You can still send a request with the form below and the team will pick it up.", ticketId, degraded: true },
      { status: 200 },
    );
  }
}
