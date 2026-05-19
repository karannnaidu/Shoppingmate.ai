/** @vitest-environment happy-dom */
// Bucket B proof — runs the full pricing tour end-to-end and writes every
// observable event, frame, metric, and post-run inspection to stdout so the
// runtime log itself is the proof the feature works.
//
// Run alone with: pnpm vitest run src/demo-tour.proof.test.ts --reporter=verbose
import { describe, it } from 'vitest';
import { runTurn } from './runtime.js';
import { executeHostAction } from '../../widget/src/host/actions.js';
import type { SessionState } from './types.js';
import type { ChatToolsResult } from '@shoppingmate/shared';

describe('Bucket B proof — log capture', () => {
  it('prints the full pricing-tour runtime trace to stdout', async () => {
    document.body.innerHTML = `
      <section aria-label="Plan grid" data-tour-stop="pricing"></section>
      <div aria-label="Starter plan card" data-tour-stop="starter-plan-card"></div>
      <button aria-label="Sign up" data-tour-stop="signup">Sign up</button>
    `;
    const assignSpy = (path: string) => console.log(`[host] window.location.assign("${path}")`);
    // happy-dom assign is mutable.
    window.location.assign = assignSpy as unknown as typeof window.location.assign;

    console.log('');
    console.log('=== Bucket B proof — initial DOM ready ===');
    console.log(`  - ${document.querySelectorAll('[data-tour-stop]').length} tour stops mounted`);
    console.log(`  - window.location.origin = ${window.location.origin}`);
    console.log('');

    const loggedDispatch = async (action: unknown) => {
      console.log(`[bridge] host_action_request  ->  ${JSON.stringify(action)}`);
      const result = await executeHostAction(action as never);
      console.log(`[widget] host_action_result   <-  ${JSON.stringify(result)}`);
      return result;
    };

    const turn1: ChatToolsResult = {
      text: '',
      toolCalls: [
        { id: 't1', name: 'site.navigate', argumentsJson: JSON.stringify({ path: '/pricing' }) },
        { id: 't2', name: 'site.scroll_to', argumentsJson: JSON.stringify({ intent: 'plan grid' }) },
        { id: 't3', name: 'site.highlight', argumentsJson: JSON.stringify({ intent: 'starter plan card' }) },
        { id: 't4', name: 'pricing.quote', argumentsJson: JSON.stringify({ plan_id: 'starter' }) },
      ],
      stopReason: 'tool_calls',
      inputTokens: 100,
      outputTokens: 50,
    };
    const turn2: ChatToolsResult = {
      // Note: this is the model's RAW text BEFORE stripPrices. The canonical
      // pricing speech is here verbatim because the model is instructed to
      // repeat pricing.quote.speech exactly. stripPrices then bypasses it via
      // the allowedSpeechTokens allow-list.
      text: 'Starter is thirty dollars per month for one hundred conversations. Want me to sign you up?',
      toolCalls: [],
      stopReason: 'stop',
      inputTokens: 120,
      outputTokens: 30,
    };
    const queue = [turn1, turn2];
    let turnIdx = 0;
    const fakeChatTools = async () => {
      const r = queue[turnIdx++]!;
      console.log(
        `[chat-model] returning turn ${turnIdx}: stopReason=${r.stopReason} toolCalls=${r.toolCalls.length} text="${r.text.slice(0, 80)}${r.text.length > 80 ? '...' : ''}"`,
      );
      return r;
    };

    const session: SessionState = {
      sessionId: 's_proof',
      merchantId: 'SM-XPK2EN',
      cartToken: null,
      history: [],
      turnCount: 0,
      voiceMs: 0,
      totalMs: 0,
      startedAt: Date.now(),
      lastTurnAt: Date.now(),
      mode: 'voice',
      allowedSpeechTokens: [],
    };
    const merchant = {
      id: 'SM-XPK2EN',
      name: 'shoppingmate',
      domain: 'shoppingmate.ai',
    } as never;

    let lastSaved: SessionState | null = null;
    const metrics: Array<{ name: string; tags: Record<string, unknown>; value?: number }> = [];

    console.log('=== Driving runTurn(user="show me pricing") ===');
    console.log('');

    for await (const ev of runTurn(
      {
        loadAdapter: () => ({}) as never,
        saveSession: async (s) => {
          lastSaved = s;
        },
        recordMetric: async (name, tags, value) => {
          metrics.push({ name, tags, value });
          console.log(
            `[metric] ${name}  ${JSON.stringify(tags)}${value !== undefined ? ` value=${value}` : ''}`,
          );
        },
        chatToolsImpl: fakeChatTools as unknown as typeof import('@shoppingmate/shared').chatTools,
        dispatchHostAction: loggedDispatch as never,
      },
      merchant,
      session,
      { type: 'user_text', sessionId: 's_proof', text: 'show me pricing', mode: 'voice' },
    )) {
      if (ev.type === 'say') {
        console.log(`[agent-event] say          text="${ev.text}"`);
      } else if (ev.type === 'tool_result') {
        console.log(`[agent-event] tool_result  toolName=${ev.toolName} ok=${ev.ok}`);
      } else {
        console.log(`[agent-event] ${ev.type}`);
      }
    }

    console.log('');
    console.log('=== Post-run inspection ===');
    console.log(`[session] allowedSpeechTokens (${lastSaved?.allowedSpeechTokens.length ?? 0}):`);
    for (const t of lastSaved?.allowedSpeechTokens ?? []) console.log(`   * "${t}"`);
    console.log('');
    console.log(
      `[dom] pulse-ring present: ${document.querySelector('[data-shoppingmate-pulse-ring]') !== null}`,
    );
    console.log(
      `[dom] tour-stops still mounted: ${document.querySelectorAll('[data-tour-stop]').length}`,
    );
    console.log('');
    console.log('=== Proof summary ===');
    const canonical = 'Starter is thirty dollars per month for one hundred conversations.';
    console.log(
      `  * pricing.quote.called metric fired: ${metrics.some((m) => m.name === 'pricing.quote.called')}`,
    );
    console.log(
      `  * pricing.quote tool dispatched (count): ${metrics.filter((m) => m.name === 'agent.tool.invoked' && m.tags.toolName === 'pricing.quote').length}`,
    );
    console.log(
      `  * site.* tool dispatches: ${metrics.filter((m) => m.name === 'agent.tool.invoked' && String(m.tags.toolName).startsWith('site.')).length}`,
    );
    console.log(
      `  * allowedSpeechTokens contains canonical speech: ${lastSaved?.allowedSpeechTokens.includes(canonical) ?? false}`,
    );
    console.log(
      `  * pulse-ring mounted by site.highlight: ${document.querySelector('[data-shoppingmate-pulse-ring]') !== null}`,
    );
  });
});
