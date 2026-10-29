import { describe, expect, it } from 'vitest';
import { pickTeamRecipients } from './submitCase.js';

describe('pickTeamRecipients', () => {
  it('uses the support email + owners, de-duplicated', () => {
    expect(pickTeamRecipients('Help@Brand.com', ['owner@brand.com', 'help@brand.com'], 'ops@sm.ai')).toEqual({
      to: ['help@brand.com', 'owner@brand.com'],
      fallback: false,
    });
  });
  it('falls back to our ops inbox when the store has nobody', () => {
    expect(pickTeamRecipients(null, [], 'ops@sm.ai, founder@sm.ai')).toEqual({ to: ['ops@sm.ai', 'founder@sm.ai'], fallback: true });
  });
  it('returns nobody only when ops is unset too', () => {
    expect(pickTeamRecipients('', [], undefined)).toEqual({ to: [], fallback: true });
  });
});
