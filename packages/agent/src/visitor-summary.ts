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
  return bits.join(' ');
}
