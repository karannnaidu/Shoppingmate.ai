// Plain-English "what Olivia actually did on your website" for one
// conversation, built from the real tool telemetry (agent.tool.invoked) — not
// from what the assistant said. Owners see e.g. "Added a product to the cart ✓"
// and, honestly, "Tried to fill the checkout form — didn't work".
// Read-only steps (looking at the page, searching the catalog) are folded away;
// repeats of the same step in a row collapse into "×3".

export type ToolEvent = { toolName: string; ok: boolean; ts: Date; failReason?: string | null };
export type TimelineStep = { label: string; ok: boolean; count: number; ts: Date; why?: string };

const LABELS: Record<string, string> = {
  'cart.add': 'Added a product to the cart',
  'cart.update': 'Changed a quantity in the cart',
  'cart.set_qty': 'Changed a quantity in the cart',
  'cart.remove': 'Removed a product from the cart',
  'cart.clear': 'Emptied the cart',
  'coupon.apply': 'Applied a discount code',
  'site.navigate': 'Opened a page for the shopper',
  'checkout.fill': 'Filled in the checkout form',
  'checkout.place': 'Sent the order to payment',
  'page.fill': 'Filled in a form on the page',
  'page.click': 'Tapped a button on the page',
  'case.open': 'Logged a customer request for your team',
  'consultation.request': 'Booked a consultation request',
};

// Plain words for the failure reasons the widget reports.
const WHY: Record<string, string> = {
  not_found: "the page didn't have what was needed",
  timeout: 'the page took too long to respond',
  no_effect: "the tap didn't change anything",
  invalid: 'some details were missing or invalid',
  sold_out: 'that item was sold out',
};

export function actionLabel(toolName: string): string | null {
  return LABELS[toolName] ?? null;
}

export function buildTimeline(events: ToolEvent[]): TimelineStep[] {
  const out: TimelineStep[] = [];
  for (const e of [...events].sort((a, b) => a.ts.getTime() - b.ts.getTime())) {
    const label = actionLabel(e.toolName);
    if (!label) continue;
    const why = !e.ok && e.failReason ? (WHY[e.failReason] ?? undefined) : undefined;
    const last = out[out.length - 1];
    if (last && last.label === label && last.ok === e.ok) {
      last.count += 1;
      continue;
    }
    out.push({ label, ok: e.ok, count: 1, ts: e.ts, why });
  }
  return out;
}
