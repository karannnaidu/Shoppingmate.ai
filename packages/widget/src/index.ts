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
  if (document.querySelector('shoppingmate-widget')) return;
  defineWidget();
  const el = document.createElement('shoppingmate-widget');
  el.setAttribute('data-id', merchantId);
  const apiOverride = script?.dataset.api;
  el.setAttribute('data-api', apiOverride ?? process.env.SHOPPINGMATE_API_BASE);
  if (document.body) document.body.appendChild(el);
  else
    document.addEventListener('DOMContentLoaded', () => document.body.appendChild(el), {
      once: true,
    });
}

init();
