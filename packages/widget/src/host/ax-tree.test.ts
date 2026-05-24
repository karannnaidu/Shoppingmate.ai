/** @vitest-environment happy-dom */
import { describe, expect, it, beforeEach } from 'vitest';
import { resolveIntent } from './ax-tree.js';

function mount(html: string): void {
  document.body.innerHTML = html;
}

describe('resolveIntent()', () => {
  beforeEach(() => { document.body.innerHTML = ''; });

  it('returns the element whose aria-label exactly matches the intent tokens', () => {
    mount(`
      <button aria-label="Sign up" data-tour-stop="signup">Sign up</button>
      <button aria-label="Sign in" data-tour-stop="signin">Sign in</button>
    `);
    const el = resolveIntent('signup button');
    expect(el).not.toBeNull();
    expect(el?.getAttribute('data-tour-stop')).toBe('signup');
  });

  it('returns the section whose data-tour-stop matches the intent verbatim', () => {
    mount(`
      <section aria-label="Plan grid" data-tour-stop="pricing"></section>
      <section aria-label="Features" data-tour-stop="features"></section>
    `);
    expect(resolveIntent('plan grid')?.getAttribute('data-tour-stop')).toBe('pricing');
    expect(resolveIntent('features section')?.getAttribute('data-tour-stop')).toBe('features');
  });

  it('returns null when best score is below threshold 0.4', () => {
    mount(`<button aria-label="Submit form">Submit</button>`);
    expect(resolveIntent('starter plan card')).toBeNull();
  });

  it('prefers visible elements over hidden ones', () => {
    mount(`
      <div aria-label="Starter plan card" style="display:none" data-tour-stop="starter-hidden"></div>
      <div aria-label="Starter plan card" data-tour-stop="starter-visible"></div>
    `);
    expect(resolveIntent('starter plan card')?.getAttribute('data-tour-stop')).toBe(
      'starter-visible',
    );
  });

  it('falls back to text content when no aria-label is present', () => {
    mount(`<a href="/pricing">Pricing</a>`);
    const el = resolveIntent('pricing link');
    expect(el?.tagName).toBe('A');
  });

  it('scores token overlap via Jaccard similarity, stopwords filtered', () => {
    mount(`
      <button aria-label="Sign up now">Sign up now</button>
      <button aria-label="Sign in">Sign in</button>
    `);
    const el = resolveIntent('the sign up button');
    expect(el?.textContent).toContain('Sign up');
  });
});

describe('resolveIntent() with hints', () => {
  it('uses hint selector first when intent matches a hint key', () => {
    document.body.innerHTML = `
      <button id="signup-hint" aria-label="Sign up">Sign up</button>
      <button id="signup-other" aria-label="Sign up here">Sign up here</button>
    `;
    const hints = new Map([['sign up', '#signup-hint']]);
    const el = resolveIntent('sign up', hints);
    expect(el?.id).toBe('signup-hint');
  });

  it('falls back to AX-tree when hint selector matches nothing', () => {
    document.body.innerHTML = `<button id="signup" aria-label="Sign up">Sign up</button>`;
    const hints = new Map([['sign up', '#nonexistent']]);
    const el = resolveIntent('sign up', hints);
    expect(el?.id).toBe('signup'); // AX-tree fallback found it
  });

  it('falls back to AX-tree when hint element is invisible', () => {
    document.body.innerHTML = `
      <button id="hidden-btn" style="display:none" aria-label="Sign up">Sign up</button>
      <button id="visible-btn" aria-label="Sign up">Sign up</button>
    `;
    const hints = new Map([['sign up', '#hidden-btn']]);
    const el = resolveIntent('sign up', hints);
    expect(el?.id).toBe('visible-btn');
  });

  it('matches hint key case-insensitively with trim', () => {
    document.body.innerHTML = `<button id="atc">Add to cart</button>`;
    const hints = new Map([['add to cart', '#atc']]);
    const el = resolveIntent('  Add To Cart  ', hints);
    expect(el?.id).toBe('atc');
  });
});
