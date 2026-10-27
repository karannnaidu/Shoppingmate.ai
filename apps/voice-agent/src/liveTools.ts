// "One brain" voice: Gemini Live calls the shop's tools itself (search, cart,
// navigate, checkout fill, consultation…) instead of a second model guessing
// from transcripts. Tools are the same ToolDefs + executor the text chat uses.

type ToolDef = { type: 'function'; function: { name: string; description: string; parameters: Record<string, unknown> } };
type Envelope = { ok: true; value: unknown } | { ok: false; kind?: string; reason?: string };

/** Gemini function names can't contain dots: products.search → products_search. */
export function liveToolDeclarations(tools: ToolDef[]): {
  declarations: { functionDeclarations: { name: string; description: string; parametersJsonSchema: unknown }[] }[];
  toCanonical: (wire: string) => string | null;
} {
  const map = new Map<string, string>();
  const functionDeclarations = tools.map((t) => {
    const wire = t.function.name.replace(/\./g, '_');
    map.set(wire, t.function.name);
    return { name: wire, description: t.function.description, parametersJsonSchema: t.function.parameters };
  });
  return { declarations: [{ functionDeclarations }], toCanonical: (wire) => map.get(wire) ?? null };
}

const MAX_RESULT_CHARS = 4_000;

/** Compact tool result for the voice model: what happened, in few tokens. */
export function summarizeForLive(name: string, env: Envelope): Record<string, unknown> {
  if (!env.ok) return { ok: false, reason: env.reason ?? env.kind ?? 'failed' };
  if (name === 'products.search' || name === 'products.get') {
    const list = Array.isArray(env.value) ? env.value : [env.value];
    const shown = list
      .slice(0, 6)
      .map((p) => {
        const o = (p ?? {}) as Record<string, unknown>;
        return { title: String(o.title ?? o.name ?? ''), sku: String(o.sku ?? o.handle ?? '') };
      })
      .filter((p) => p.title);
    return {
      ok: true,
      shown,
      note: 'These now show as cards on the visitor\'s screen with prices. Mention them by name; point to the card for the price instead of saying numbers.',
    };
  }
  const text = JSON.stringify(env.value ?? null);
  return { ok: true, result: text.length > MAX_RESULT_CHARS ? `${text.slice(0, MAX_RESULT_CHARS)}…` : env.value };
}

/** Extra instruction when the voice model drives the tools itself. */
export const ONE_BRAIN_RULE = `TOOLS (you act directly)
You can act on the store yourself with your tools: search and show products, add to or change the cart, apply a coupon, open pages, read and fill the checkout or contact page, and book a consultation. When the visitor asks for something a tool does, CALL THE TOOL — don't just talk about it. While a tool runs, say at most one short line ("adding that now"). Only say something is added, filled, booked or done after the tool result says ok; if it fails, say so honestly and offer to try again. Wherever the rules above mention a "separate layer" or a "SYSTEM message" with the outcome, that is now YOUR tool call and its result. Use exact product SKUs from search results. Never read tool names, SKUs or JSON aloud.`;
