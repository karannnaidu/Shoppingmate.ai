import { createConsultationRequest } from '../repos/consultationRepo.js';
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
