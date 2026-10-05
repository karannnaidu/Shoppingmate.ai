import { db } from '../client.js';
import { createConsultationRequest } from '../repos/consultationRepo.js';
import { supportCases } from '../schema/supportCases.js';
import { sendConsultationEmail } from './consultationEmail.js';

export type SubmitConsultationArgs = {
  merchantId: string;
  sessionId: string | null;
  name: string;
  age: number;
  condition: string | null;
  phoneCountryCode: string;
  phone: string;
};

export async function submitConsultationRequest(
  args: SubmitConsultationArgs,
): Promise<{ ok: true } | { ok: false; reason: string }> {
  try {
    await createConsultationRequest({
      merchantId: args.merchantId,
      sessionId: args.sessionId,
      name: args.name,
      age: args.age,
      condition: args.condition,
      phoneCountryCode: args.phoneCountryCode,
      phone: args.phone,
    });
  } catch (err) {
    console.error('[consultation] insert failed', err);
    return { ok: false, reason: 'could not save the request' };
  }
  // Nav Phase 4: mirror into the unified customer-requests inbox (type consult).
  // Best-effort and email-free — the consultation email below already notifies.
  void db
    .insert(supportCases)
    .values({
      merchantId: args.merchantId,
      sessionId: args.sessionId,
      type: 'consult',
      summary: `Consultation request${args.condition ? ` — ${args.condition}` : ''}`,
      details: { age: String(args.age), ...(args.condition ? { condition: args.condition } : {}) },
      contactName: args.name,
      contactPhone: `${args.phoneCountryCode} ${args.phone}`,
      consent: true,
      urgency: 'normal',
      sentiment: 'neutral',
    })
    .catch((err) => console.error('[consultation] case mirror failed', err));
  // Fire-and-forget: a mail failure must not fail the request (row is saved).
  void sendConsultationEmail({
    name: args.name,
    age: args.age,
    condition: args.condition,
    phoneCountryCode: args.phoneCountryCode,
    phone: args.phone,
    sessionId: args.sessionId,
  }).catch((err) => console.error('[consultation] email failed', err));
  return { ok: true };
}
