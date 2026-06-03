import { defineWidget } from './widget.js';

declare const process: { env: { SHOPPINGMATE_API_BASE: string } };

function init(): void {
  const script =
    document.currentScript instanceof HTMLScriptElement ? document.currentScript : null;
  const merchantId = script?.dataset.id;
  if (!merchantId) {
    console.warn('[shoppingmate] data-id missing on script tag');
    return;
  }
  const apiOverride = script?.dataset.api;
  // Trim defensively — env vars baked at build time can carry trailing whitespace
  // from secret stores, which corrupts the API base used by bootstrap.
  const apiBase = (apiOverride ?? process.env.SHOPPINGMATE_API_BASE).trim();

  // If a <shoppingmate-widget> is already in the DOM (host pre-rendered or
  // server-rendered the element), patch data-id/data-api BEFORE defining the
  // custom element. defineWidget() fires connectedCallback synchronously for
  // any matching node, and connectedCallback reads data-api at that moment —
  // so missing attributes here strand apiBase as '' and the widget posts to
  // the relative '/v1/install' on the host origin.
  const preExisting = document.querySelector('shoppingmate-widget');
  if (preExisting) {
    if (!preExisting.getAttribute('data-api')) preExisting.setAttribute('data-api', apiBase);
    if (!preExisting.getAttribute('data-id')) preExisting.setAttribute('data-id', merchantId);
  }

  // Register the element so any matching node already in the DOM upgrades
  // immediately, and any node the HTML parser appends later upgrades as it's
  // inserted.
  defineWidget();

  const mount = () => {
    // Defer the "is one already in the DOM?" check until the parser has seen
    // the full body. Host pages may pre-render <shoppingmate-widget> at the
    // end of body; if we ran querySelector during the async-script callback
    // we'd race the parser and wrongly create a duplicate.
    const existing = document.querySelector('shoppingmate-widget');
    if (existing) {
      if (!existing.getAttribute('data-api')) existing.setAttribute('data-api', apiBase);
      if (!existing.getAttribute('data-id')) existing.setAttribute('data-id', merchantId);
      return;
    }
    const el = document.createElement('shoppingmate-widget');
    el.setAttribute('data-id', merchantId);
    el.setAttribute('data-api', apiBase);
    document.body.appendChild(el);
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mount, { once: true });
  } else {
    mount();
  }
}

init();
