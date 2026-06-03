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
  const apiBase = apiOverride ?? process.env.SHOPPINGMATE_API_BASE;
  // If the host React tree pre-rendered the element (so it survives soft-nav
  // reconciliation), back-fill the data-api attribute from the script-tag
  // build-time default before upgrading. Otherwise bootstrap would hit an
  // empty apiBase, fail silently, and fall back to the default persona.
  const existing = document.querySelector('shoppingmate-widget');
  if (existing) {
    if (!existing.getAttribute('data-api')) existing.setAttribute('data-api', apiBase);
    if (!existing.getAttribute('data-id')) existing.setAttribute('data-id', merchantId);
  }
  defineWidget();
  if (existing) return;
  const el = document.createElement('shoppingmate-widget');
  el.setAttribute('data-id', merchantId);
  el.setAttribute('data-api', apiBase);
  if (document.body) document.body.appendChild(el);
  else
    document.addEventListener('DOMContentLoaded', () => document.body.appendChild(el), {
      once: true,
    });
}

init();
