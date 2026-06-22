import type { ProfileRow } from '@shoppingmate/db';

const money = (cents: number) => (cents > 0 ? `₹${Math.round(cents / 100)}` : null);

// Compact returning-visitor brief baked into the system prompt/instruction.
// Empty string for unknown/first-time visitors so nothing is injected.
export function buildVisitorSummary(profile: ProfileRow | null): string {
  if (!profile || profile.sessionCount < 1) return '';
  const id = profile.identity ?? {};
  const bits: string[] = [];
  const who = id.name ? `${id.name}${id.city ? ` from ${id.city}` : ''}` : 'A returning visitor';
  bits.push(`${who} (visit #${profile.sessionCount + 1}).`);
  if (profile.topIntents.length) bits.push(`Past intent: ${profile.topIntents.slice(0, 3).join(', ')}.`);
  if (profile.needs.length) bits.push(`Cares about: ${profile.needs.slice(0, 4).join(', ')}.`);
  if (profile.productsOfInterest.length) bits.push(`Looked at: ${profile.productsOfInterest.slice(0, 4).join(', ')}.`);
  if (profile.objections.length) bits.push(`Hesitations: ${profile.objections.slice(0, 3).join(', ')}.`);
  if (profile.lastOutcome) bits.push(`Last time they ${profile.lastOutcome}${profile.lastDropStage ? ` (stopped at ${profile.lastDropStage})` : ''}.`);
  const ltv = money(profile.lifetimeValueCents);
  if (ltv) bits.push(`Lifetime spend ${ltv}.`);
  // Saved checkout details from prior sessions — so the bot can REUSE them
  // (confirm, don't re-ask) at checkout instead of collecting from scratch.
  const addr = [id.address, id.city, id.state, id.pincode].filter(Boolean).join(', ');
  const saved: string[] = [];
  if (id.phone) saved.push(`phone ${id.phone}`);
  if (id.email) saved.push(`email ${id.email}`);
  if (addr) saved.push(`address ${addr}`);
  if (saved.length) {
    bits.push(`SAVED CHECKOUT DETAILS (reuse these — confirm in one line, do NOT re-ask field by field): ${saved.join('; ')}.`);
  }
  return bits.join(' ');
}
