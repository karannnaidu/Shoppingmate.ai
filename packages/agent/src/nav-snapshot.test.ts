import type { Merchant } from '@shoppingmate/db';
import { afterEach, describe, expect, it } from 'vitest';
import { decodeWidgetMessage } from './events.js';
import { buildSystemPrompt } from './prompts/system.js';
import { toHostAction } from './runtime.js';
import { buildToolSurface, navSnapshotEnabled } from './tools.js';

// Nav PRD Phase 1 — snapshot page control behind NAV_SNAPSHOT_V2.

const calmosis = {
  id: 'SM-2SCCLZ',
  adapterType: 'dom',
  siteGraphEnabled: true,
} as unknown as Merchant;
const shopify = {
  id: 'M-SHOP',
  adapterType: 'shopify',
  platform: 'shopify',
  siteGraphEnabled: true,
} as unknown as Merchant;
const other = { id: 'M-OTHER', adapterType: 'dom', siteGraphEnabled: true } as unknown as Merchant;

const toolParams = (m: Merchant, name: string) =>
  buildToolSurface(m).find((t) => t.function.name === name)?.function.parameters as
    | { properties?: Record<string, unknown> }
    | undefined;

afterEach(() => {
  delete process.env.NAV_SNAPSHOT_V2;
});

describe('navSnapshotEnabled()', () => {
  it('is off by default, on for "*" or an allowlisted id', () => {
    expect(navSnapshotEnabled(calmosis)).toBe(false);
    process.env.NAV_SNAPSHOT_V2 = '*';
    expect(navSnapshotEnabled(other)).toBe(true);
    process.env.NAV_SNAPSHOT_V2 = 'M-A, SM-2SCCLZ';
    expect(navSnapshotEnabled(calmosis)).toBe(true);
    expect(navSnapshotEnabled(other)).toBe(false);
  });
});

describe('buildToolSurface() with NAV_SNAPSHOT_V2', () => {
  it('flag off: legacy surface unchanged (Shopify/other get no page.*)', () => {
    expect(toolParams(calmosis, 'page.click')?.properties).not.toHaveProperty('ref');
    expect(buildToolSurface(shopify).map((t) => t.function.name)).not.toContain('page.read');
    expect(buildToolSurface(other).map((t) => t.function.name)).not.toContain('page.read');
  });

  it('flag on: Calmosis gets ref-capable page tools; Shopify + other site-graph merchants get page.*', () => {
    process.env.NAV_SNAPSHOT_V2 = '*';
    expect(toolParams(calmosis, 'page.click')?.properties).toHaveProperty('ref');
    for (const m of [shopify, other]) {
      const names = buildToolSurface(m).map((t) => t.function.name);
      expect(names).toEqual(expect.arrayContaining(['page.read', 'page.click', 'page.fill']));
    }
    // still exactly one of each page tool on Calmosis
    const calmNames = buildToolSurface(calmosis).map((t) => t.function.name);
    expect(calmNames.filter((n) => n === 'page.read')).toHaveLength(1);
  });

  it('flag on but site graph off: no page tools', () => {
    process.env.NAV_SNAPSHOT_V2 = '*';
    const noGraph = { ...other, siteGraphEnabled: false } as Merchant;
    expect(buildToolSurface(noGraph).map((t) => t.function.name)).not.toContain('page.read');
  });
});

describe('toHostAction() snapshot mapping', () => {
  it('bare page.read → page_snapshot only in snapshot mode', () => {
    expect(toHostAction('page.read', {}, { snapshot: true })).toEqual({ type: 'page_snapshot' });
    expect(toHostAction('page.read', {})).toEqual({ type: 'form_read', fields: undefined });
    expect(toHostAction('page.read', { fields: ['Email'] }, { snapshot: true })).toEqual({
      type: 'form_read',
      fields: ['Email'],
    });
  });

  it('page.click carries the ref; page.fill carries per-field refs', () => {
    expect(toHostAction('page.click', { ref: ' e12 ', intent: 'Add to cart' })).toEqual({
      type: 'click',
      intent: 'Add to cart',
      ref: 'e12',
    });
    expect(toHostAction('page.click', { intent: 'Add to cart' })).toEqual({
      type: 'click',
      intent: 'Add to cart',
    });
    expect(
      toHostAction('page.fill', {
        fields: [
          { field: 'Email', value: 'a@b.com', ref: 'e4' },
          { field: 'Pin', value: '1' },
        ],
      }),
    ).toEqual({
      type: 'form_fill',
      fields: [
        { field: 'Email', value: 'a@b.com', ref: 'e4' },
        { field: 'Pin', value: '1' },
      ],
    });
  });
});

describe('host_action_result decoding', () => {
  it('preserves verified + observed from the widget', () => {
    const msg = decodeWidgetMessage(
      JSON.stringify({
        type: 'host_action_result',
        callId: 'c1',
        result: { ok: true, verified: false, observed: 'nothing changed on the page' },
      }),
    );
    expect(msg).toEqual({
      type: 'host_action_result',
      callId: 'c1',
      result: { ok: true, verified: false, observed: 'nothing changed on the page' },
    });
  });
});

describe('system prompt', () => {
  it('adds the page-control guidance only when the flag is on', () => {
    expect(buildSystemPrompt(other)).not.toContain('SEEING + USING THE PAGE');
    process.env.NAV_SNAPSHOT_V2 = '*';
    expect(buildSystemPrompt(other)).toContain('SEEING + USING THE PAGE');
  });
});
