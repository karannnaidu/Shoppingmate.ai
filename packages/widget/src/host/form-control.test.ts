// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from 'vitest';
import { setReactValue, formFill, formRead, resolveFieldCached } from './form-control.js';
import { resolveField } from './ax-tree.js';

beforeEach(() => {
  document.body.innerHTML = '';
  try { localStorage.clear(); } catch { /* ignore */ }
});

describe('resolveFieldCached (learn-once + heal)', () => {
  it('learns a durable selector on first resolve, then re-uses it without crawling', () => {
    document.body.innerHTML = '<label for="em">Email address</label><input id="em" />';
    expect(resolveFieldCached('Email')?.id).toBe('em');
    const cache = JSON.parse(localStorage.getItem('sm_selector_cache_v1') ?? '{}');
    expect(cache[`${location.pathname}::Email`]).toBe('#em');
    // Remove the label so the ax-tree heuristic would FAIL — the cached `#em`
    // still resolves it directly (proves no re-crawl needed after learning).
    document.body.innerHTML = '<input id="em" />';
    expect(resolveFieldCached('Email')?.id).toBe('em');
  });

  it('heals when the cached selector no longer matches (layout changed)', () => {
    document.body.innerHTML = '<input id="em" name="email" />';
    resolveFieldCached('Email'); // learns #em
    document.body.innerHTML = '<label for="e2">Email address</label><input id="e2" />';
    expect(resolveFieldCached('Email')?.id).toBe('e2'); // re-resolved + re-learned
    const cache = JSON.parse(localStorage.getItem('sm_selector_cache_v1') ?? '{}');
    expect(cache[`${location.pathname}::Email`]).toBe('#e2');
  });

  it('prefers a data-sm-field anchor as the durable selector', () => {
    document.body.innerHTML = '<input data-sm-field="phone" id="p" />';
    resolveFieldCached('phone');
    const cache = JSON.parse(localStorage.getItem('sm_selector_cache_v1') ?? '{}');
    expect(cache[`${location.pathname}::phone`]).toBe('[data-sm-field="phone"]');
  });
});

describe('setReactValue', () => {
  it('sets the value and dispatches an input event', () => {
    document.body.innerHTML = '<input id="x" />';
    const el = document.getElementById('x') as HTMLInputElement;
    let fired = false;
    el.addEventListener('input', () => {
      fired = true;
    });
    setReactValue(el, 'hello');
    expect(el.value).toBe('hello');
    expect(fired).toBe(true);
  });
});

describe('resolveField', () => {
  it('matches an input by its <label for> text', () => {
    document.body.innerHTML = '<label for="em">Email address</label><input id="em" />';
    expect(resolveField('Email')?.id).toBe('em');
  });
  it('matches an input by placeholder when unlabelled', () => {
    document.body.innerHTML = '<input id="pc" placeholder="Pincode" />';
    expect(resolveField('pincode')?.id).toBe('pc');
  });
  it('returns null when nothing matches', () => {
    document.body.innerHTML = '<div>no inputs</div>';
    expect(resolveField('Email')).toBeNull();
  });
  it('matches "Phone" to a "10-digit mobile number" placeholder via synonyms', () => {
    document.body.innerHTML = '<input id="mob" placeholder="10-digit mobile number" />';
    expect(resolveField('Phone')?.id).toBe('mob');
  });
  it('matches "Pincode" to an "Enter 6-digit PIN code" placeholder via synonyms', () => {
    document.body.innerHTML = '<input id="pin" placeholder="Enter 6-digit PIN code" />';
    expect(resolveField('Pincode')?.id).toBe('pin');
  });
});

describe('formFill', () => {
  it('fills fields and returns read-back values', () => {
    document.body.innerHTML =
      '<label for="n">Full name</label><input id="n" />' +
      '<label for="e">Email</label><input id="e" />';
    const r = formFill([
      { field: 'Full name', value: 'Karan' },
      { field: 'Email', value: 'k@x.com' },
    ]);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.values?.['Full name']).toBe('Karan');
      expect(r.values?.['Email']).toBe('k@x.com');
    }
    expect((document.getElementById('n') as HTMLInputElement).value).toBe('Karan');
  });
  it('reports not_found when no field resolves', () => {
    document.body.innerHTML = '<div>nothing</div>';
    const r = formFill([{ field: 'Email', value: 'x' }]);
    expect(r.ok).toBe(false);
  });
});

describe('formRead', () => {
  it('reads named field values back', () => {
    document.body.innerHTML = '<label for="e">Email</label><input id="e" value="a@b.com" />';
    const r = formRead(['Email']);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.values?.['Email']).toBe('a@b.com');
  });
});
