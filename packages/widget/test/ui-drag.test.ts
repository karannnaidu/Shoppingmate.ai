import { describe, expect, it } from 'vitest';
import { clampTopLeft, quadrantAnchor } from '../src/ui/drag.js';

describe('clampTopLeft', () => {
  it('keeps a box inside the viewport with a margin', () => {
    // 100x40 box in a 1000x800 viewport, dragged far off bottom-right.
    const { x, y } = clampTopLeft(2000, 2000, 100, 40, 1000, 800, 8);
    expect(x).toBe(1000 - 100 - 8);
    expect(y).toBe(800 - 40 - 8);
  });

  it('clamps to the top-left margin when dragged off-screen negative', () => {
    const { x, y } = clampTopLeft(-50, -50, 100, 40, 1000, 800, 8);
    expect(x).toBe(8);
    expect(y).toBe(8);
  });

  it('passes through an in-bounds position unchanged', () => {
    const { x, y } = clampTopLeft(300, 200, 100, 40, 1000, 800, 8);
    expect(x).toBe(300);
    expect(y).toBe(200);
  });
});

describe('quadrantAnchor', () => {
  const vw = 1000;
  const vh = 800;

  it('anchors bottom-right when the launcher sits in the bottom-right quadrant', () => {
    const a = quadrantAnchor({ left: 860, right: 980, top: 720, bottom: 760 }, vw, vh);
    expect(a.hSide).toBe('right');
    expect(a.vSide).toBe('bottom');
    expect(a.hVal).toBe(vw - 980); // 20
    expect(a.vVal).toBe(vh - 760); // 40
  });

  it('anchors top-left when the launcher sits in the top-left quadrant', () => {
    const a = quadrantAnchor({ left: 16, right: 136, top: 24, bottom: 64 }, vw, vh);
    expect(a.hSide).toBe('left');
    expect(a.vSide).toBe('top');
    expect(a.hVal).toBe(16);
    expect(a.vVal).toBe(24);
  });

  it('never returns an offset below the margin', () => {
    const a = quadrantAnchor({ left: 0, right: 120, top: 0, bottom: 40 }, vw, vh, 8);
    expect(a.hVal).toBeGreaterThanOrEqual(8);
    expect(a.vVal).toBeGreaterThanOrEqual(8);
  });
});
