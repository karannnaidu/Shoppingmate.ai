import { describe, expect, it, vi } from 'vitest';

const { createConsultationRequest, sendConsultationEmail } = vi.hoisted(() => ({
  createConsultationRequest: vi.fn(),
  sendConsultationEmail: vi.fn(),
}));
vi.mock('../../src/repos/consultationRepo', () => ({ createConsultationRequest }));
vi.mock('../../src/notify/consultationEmail', () => ({ sendConsultationEmail }));

import { submitConsultationRequest } from '../../src/notify/submitConsultation';

const base = {
  merchantId: 'SM-2SCCLZ',
  sessionId: 's1',
  name: 'Karan',
  age: 32,
  condition: null,
  phoneCountryCode: '+91',
  phone: '9876543210',
};

describe('submitConsultationRequest', () => {
  it('persists then returns ok, and fires the email', async () => {
    createConsultationRequest.mockResolvedValue(7);
    sendConsultationEmail.mockResolvedValue(undefined);
    const r = await submitConsultationRequest(base);
    expect(r).toEqual({ ok: true });
    expect(createConsultationRequest).toHaveBeenCalledOnce();
    await vi.waitFor(() => expect(sendConsultationEmail).toHaveBeenCalledOnce());
  });
  it('still returns ok when the email throws (email is fire-and-forget)', async () => {
    createConsultationRequest.mockResolvedValue(8);
    sendConsultationEmail.mockRejectedValue(new Error('resend down'));
    const r = await submitConsultationRequest(base);
    expect(r).toEqual({ ok: true });
  });
  it('returns not ok when the insert fails', async () => {
    createConsultationRequest.mockRejectedValue(new Error('db down'));
    const r = await submitConsultationRequest(base);
    expect(r.ok).toBe(false);
  });
});
