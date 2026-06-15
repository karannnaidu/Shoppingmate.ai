export type ConsultationRequest = {
  name: string;
  age: number;
  condition: string | null;
  phoneCountryCode: string;
  phone: string;
};

export type ConsultationValidation =
  | { ok: true; value: ConsultationRequest }
  | { ok: false; reason: string };

export function validateConsultationRequest(args: Record<string, unknown>): ConsultationValidation {
  const name = typeof args.name === 'string' ? args.name.trim() : '';
  if (name.length === 0) return { ok: false, reason: 'name is required' };

  const ageNum = typeof args.age === 'number' ? args.age : Number(args.age);
  if (!Number.isInteger(ageNum) || ageNum < 1 || ageNum > 120) {
    return { ok: false, reason: 'age must be a whole number between 1 and 120' };
  }

  const rawPhone = typeof args.phone === 'string' ? args.phone : String(args.phone ?? '');
  const phone = rawPhone.replace(/\D/g, '');
  if (phone.length !== 10) return { ok: false, reason: 'phone must be exactly 10 digits' };

  const rawCc = typeof args.phone_country_code === 'string' ? args.phone_country_code.trim() : '';
  const phoneCountryCode =
    rawCc.length === 0 ? '+91' : rawCc.startsWith('+') ? rawCc : `+${rawCc.replace(/\D/g, '')}`;

  const condRaw = typeof args.condition === 'string' ? args.condition.trim() : '';
  const condition = condRaw.length === 0 ? null : condRaw;

  return { ok: true, value: { name, age: ageNum, condition, phoneCountryCode, phone } };
}
