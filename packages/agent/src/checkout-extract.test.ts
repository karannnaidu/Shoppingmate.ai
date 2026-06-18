import { describe, expect, it, vi } from 'vitest';
import { extractCheckoutDetails } from './checkout-extract.js';

const TRANSCRIPT = `Bot: What is your full name? User: Karam... actually K A R A N
Bot: phone? User: 8105791728
Bot: email? User: t h o r i n 1435 at gmail dot com
Bot: address? User: 521 Sandeep Square, Bangalore, Karnataka, 560013`;

describe('extractCheckoutDetails', () => {
  it('parses the JSON the model returns, then validates + normalizes', async () => {
    const chat = vi.fn().mockResolvedValue({
      text: `Here you go: {"name":"Karan","phone":"+91 8105791728","email":"thorin1435@gmail.com","address":"521 Sandeep Square","city":"Bangalore","state":"Karnataka","pincode":"560013"}`,
    });
    const r = await extractCheckoutDetails(TRANSCRIPT, chat);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.details.name).toBe('Karan');
      expect(r.details.phone).toBe('8105791728'); // +91 stripped
      expect(r.details.email).toBe('thorin1435@gmail.com');
      expect(r.details.pincode).toBe('560013');
    }
  });

  it('surfaces a missing field instead of faking (e.g. blank email)', async () => {
    const chat = vi.fn().mockResolvedValue({
      text: `{"name":"Karan","phone":"8105791728","email":"","address":"521 Sandeep Square","city":"Bangalore","state":"Karnataka","pincode":"560013"}`,
    });
    const r = await extractCheckoutDetails(TRANSCRIPT, chat);
    expect(r.ok).toBe(false);
  });

  it('rejects an invalid phone from the model with a reason', async () => {
    const chat = vi.fn().mockResolvedValue({
      text: `{"name":"Karan","phone":"123","email":"a@b.com","address":"x","city":"y","state":"z","pincode":"560013"}`,
    });
    const r = await extractCheckoutDetails(TRANSCRIPT, chat);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toMatch(/10-digit/i);
  });

  it('handles unparseable model output gracefully', async () => {
    const chat = vi.fn().mockResolvedValue({ text: 'sorry I cannot' });
    const r = await extractCheckoutDetails(TRANSCRIPT, chat);
    expect(r.ok).toBe(false);
  });

  it('handles a chat throw gracefully', async () => {
    const chat = vi.fn().mockRejectedValue(new Error('network'));
    const r = await extractCheckoutDetails(TRANSCRIPT, chat);
    expect(r.ok).toBe(false);
  });
});
