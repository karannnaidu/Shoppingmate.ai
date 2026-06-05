// Generates a static, openable preview of all five launcher phases using the
// REAL shadow CSS + icons + pill renderer. Run: `tsx scripts/gen-preview.ts`.
// Output: examples/states-preview.html — open it in any browser to eyeball the
// redesign without booting the API.
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { Window } from 'happy-dom';
import { SHADOW_CSS } from '../src/styles/shadow.css.js';
import { renderCall } from '../src/ui/call.js';
import { renderPill } from '../src/ui/pill.js';

const win = new Window();
const doc = win.document;
// renderPill/renderCall reach for the global document + instanceof HTMLElement.
const g = globalThis as unknown as Record<string, unknown>;
g.document = doc;
g.HTMLElement = win.HTMLElement;
g.HTMLInputElement = win.HTMLInputElement;
g.HTMLButtonElement = win.HTMLButtonElement;

const base = {
  callable: true,
  connection: 'connected' as const,
  voiceError: null,
  invited: false,
  personaName: 'Olivia',
  personaInitial: 'O',
  personaAvatarUrl: 'https://shoppingmate-web.vercel.app/widget/personas/concierge.png',
  onCall: () => {},
  onMute: () => {},
  onEnd: () => {},
  onChat: () => {},
  onClose: () => {},
};

function pill(props: Parameters<typeof renderPill>[1]): string {
  const host = doc.createElement('div');
  renderPill(host as unknown as HTMLElement, props);
  return host.innerHTML;
}

function call(props: Parameters<typeof renderCall>[1]): string {
  const host = doc.createElement('div');
  renderCall(host as unknown as HTMLElement, props);
  return host.innerHTML;
}

const phases: Array<{ title: string; html: string }> = [
  {
    title: '1 · Resting launcher',
    html: pill({ ...base, mode: 'pill', voiceState: 'idle' }),
  },
  {
    title: '2 · Incoming call',
    html: pill({ ...base, mode: 'pill', voiceState: 'idle', invited: true }),
  },
  {
    title: '3 · Connecting / requesting mic',
    html: pill({ ...base, mode: 'call', voiceState: 'connecting' }),
  },
  {
    title: '4 · Mic blocked / failed',
    html:
      call({
        ...base,
        muted: false,
        transcript: [],
        checkoutUrl: null,
        voiceState: 'idle',
        voiceError: { code: 'mic_denied', message: 'denied' },
      }) + pill({ ...base, mode: 'call', voiceState: 'idle', voiceError: { code: 'mic_denied', message: 'denied' } }),
  },
  {
    title: '5 · Connected (live)',
    html:
      call({
        ...base,
        muted: false,
        transcript: [],
        checkoutUrl: null,
        voiceState: 'listening',
      }) + pill({ ...base, mode: 'call', voiceState: 'listening' }),
  },
];

const cards = phases
  .map(
    (p) => `
    <section class="case">
      <h2>${p.title}</h2>
      <div class="stage">${p.html}</div>
    </section>`,
  )
  .join('\n');

const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Olivia — launcher states preview</title>
<style>
  body { margin:0; background:#111317; color:#e7e7ea; font-family: system-ui, sans-serif; padding:40px; }
  h1 { font-weight:600; letter-spacing:-0.02em; }
  p.note { color:#8a8a93; max-width:60ch; }
  .grid { display:grid; gap:24px; grid-template-columns: repeat(auto-fill, minmax(360px, 1fr)); margin-top:28px; }
  .case { background:#0a0a0a; border:1px solid rgba(255,255,255,0.08); border-radius:20px; padding:22px; }
  .case h2 { font-size:12px; text-transform:uppercase; letter-spacing:0.16em; color:#8a8a93; margin:0 0 18px; font-family: ui-monospace, monospace; }
  .stage { display:flex; flex-direction:column; align-items:flex-start; gap:14px; min-height:120px; justify-content:center; }
  /* The real widget styles, scoped under .stage instead of :host */
  ${SHADOW_CSS.replace(':host { all: initial; }', '')}
</style>
</head>
<body>
  <h1>Olivia — launcher states</h1>
  <p class="note">Generated from the live widget renderer (<code>renderPill</code> / <code>renderCall</code>) and shadow CSS. The Call button starts the call; the mic only mutes once a call is live.</p>
  <div class="grid">
    ${cards}
  </div>
</body>
</html>`;

const out = resolve(import.meta.dirname, '../examples/states-preview.html');
writeFileSync(out, html, 'utf8');
console.log(`[preview] wrote ${out}`);
