export const SHADOW_CSS = `
:host { all: initial; }
* { box-sizing: border-box; }

.root {
  position: fixed;
  bottom: 20px;
  right: 20px;
  z-index: 2147483647;
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  font-size: 14px;
  color: #fff;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 12px;
  pointer-events: none;
}
.root > * { pointer-events: auto; }

/* ---- Pill (collapsed launcher) ---- */
.pill {
  position: relative;
  display: inline-flex;
  align-items: center;
  gap: 10px;
  background: #09090b;
  border: 1px solid rgba(255,255,255,0.1);
  border-radius: 9999px;
  padding: 6px 8px 6px 6px;
  box-shadow:
    0 18px 40px -12px rgba(124,58,237,0.45),
    0 8px 20px -8px rgba(0,0,0,0.5);
  transition: transform 200ms cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 200ms ease-out;
  animation: pill-in 280ms cubic-bezier(0.34, 1.56, 0.64, 1) both;
}
.pill::before {
  content: "";
  position: absolute;
  inset: -2px;
  border-radius: 9999px;
  padding: 1px;
  background: linear-gradient(120deg, rgba(124,58,237,0.6), rgba(217,70,239,0.6), rgba(6,182,212,0.6));
  -webkit-mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);
  -webkit-mask-composite: xor;
          mask-composite: exclude;
  opacity: 0;
  transition: opacity 200ms ease-out;
  pointer-events: none;
}
.pill:hover {
  transform: translateY(-1px);
  box-shadow:
    0 24px 48px -12px rgba(124,58,237,0.55),
    0 10px 24px -8px rgba(0,0,0,0.55);
}
.pill:hover::before { opacity: 1; }

@keyframes pill-in {
  0% { opacity: 0; transform: translateY(8px) scale(0.96); }
  100% { opacity: 1; transform: translateY(0) scale(1); }
}

.avatar {
  width: 40px; height: 40px; border-radius: 9999px; display: grid; place-items: center;
  background: linear-gradient(135deg, #7c3aed, #d946ef, #06b6d4);
  font-weight: 600; font-size: 14px; letter-spacing: 0.02em;
  position: relative;
  border: none; color: #fff; cursor: pointer;
  transition: transform 200ms cubic-bezier(0.34, 1.56, 0.64, 1);
}
.avatar:hover { transform: scale(1.04); }
.avatar:active { transform: scale(0.96); }
.avatar::after {
  content: ""; position: absolute; bottom: 0; right: 0;
  width: 12px; height: 12px; border-radius: 9999px;
  background: #34d399;
  box-shadow: 0 0 0 2px #09090b, 0 0 12px rgba(52,211,153,0.7);
  animation: pulse 2.4s ease-in-out infinite;
}
@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.55; }
}

.pill .label { display: flex; flex-direction: column; line-height: 1.1; padding-right: 4px; text-align: left; }
.pill .label-main { font-size: 13px; font-weight: 500; color: #fafafa; }
.pill .label-sub {
  font-size: 9.5px; text-transform: uppercase; letter-spacing: 0.18em;
  color: rgba(255,255,255,0.55);
  font-family: 'JetBrains Mono', ui-monospace, monospace;
}

.actions { display: flex; align-items: center; gap: 4px; margin-left: 4px; }

/* ---- Buttons ---- */
.btn {
  border: none; cursor: pointer; font: inherit; color: #fff;
  display: inline-flex; align-items: center; gap: 6px;
  border-radius: 9999px; padding: 8px 16px; font-size: 12px; font-weight: 600;
  letter-spacing: 0.04em;
  background: linear-gradient(90deg, #7c3aed, #d946ef, #06b6d4);
  box-shadow: 0 6px 18px -4px rgba(217,70,239,0.55);
  transition: transform 150ms ease-out, box-shadow 200ms ease-out, opacity 150ms ease-out;
}
.btn:hover { transform: translateY(-1px); box-shadow: 0 10px 24px -6px rgba(217,70,239,0.65); }
.btn:active { transform: translateY(0) scale(0.98); }
.btn-end {
  background: #f43f5e;
  box-shadow: 0 6px 18px -4px rgba(244,63,94,0.55);
}
.btn-end:hover { box-shadow: 0 10px 24px -6px rgba(244,63,94,0.65); }
.btn-icon {
  background: rgba(255,255,255,0.06);
  width: 36px; height: 36px; padding: 0; justify-content: center;
  box-shadow: none;
}
.btn-icon:hover { background: rgba(255,255,255,0.12); transform: none; box-shadow: none; }

.btn :where(svg) { width: 14px; height: 14px; }
.btn-icon :where(svg) { width: 16px; height: 16px; }

/* ---- Focus-visible (a11y) ---- */
.avatar:focus-visible,
.btn:focus-visible,
.ctrl:focus-visible,
.send:focus-visible,
.input-row input:focus-visible,
.card:focus-visible {
  outline: 2px solid #d946ef;
  outline-offset: 2px;
}
.btn-icon:focus-visible,
.ctrl:focus-visible {
  outline-offset: 3px;
}

/* ---- Panel (expanded surfaces) ---- */
.panel {
  width: min(380px, calc(100vw - 40px));
  background: #fff; color: #18181b;
  border: 1px solid #e4e4e7; border-radius: 22px;
  overflow: hidden;
  box-shadow:
    0 32px 64px -16px rgba(0,0,0,0.28),
    0 12px 28px -10px rgba(124,58,237,0.18);
  display: flex; flex-direction: column;
  position: relative;
  animation: panel-in 320ms cubic-bezier(0.34, 1.56, 0.64, 1) both;
}
.panel::before {
  content: "";
  position: absolute;
  inset: -40% -20% auto auto;
  width: 320px; height: 320px;
  background: radial-gradient(circle, rgba(124,58,237,0.16), rgba(217,70,239,0.1) 35%, transparent 70%);
  filter: blur(24px);
  pointer-events: none;
  z-index: 0;
}
.panel::after {
  content: "";
  position: absolute;
  inset: auto auto -30% -20%;
  width: 280px; height: 280px;
  background: radial-gradient(circle, rgba(6,182,212,0.14), transparent 65%);
  filter: blur(28px);
  pointer-events: none;
  z-index: 0;
}
.panel > * { position: relative; z-index: 1; }

@keyframes panel-in {
  0% { opacity: 0; transform: translateY(12px) scale(0.97); }
  100% { opacity: 1; transform: translateY(0) scale(1); }
}

.panel-header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 14px 20px;
  border-bottom: 1px solid rgba(228,228,231,0.7);
}
.panel-header .who { display: flex; align-items: center; gap: 10px; }
.panel-header .who .avatar { width: 36px; height: 36px; font-size: 13px; cursor: default; }
.panel-header .who .avatar::after { display: none; }
.panel-header .who .name { font-size: 14px; font-weight: 600; color: #18181b; }
.panel-header .who .sub {
  font-size: 10px; text-transform: uppercase; letter-spacing: 0.16em;
  color: #71717a; font-family: 'JetBrains Mono', ui-monospace, monospace;
}
.elapsed {
  font-family: 'JetBrains Mono', ui-monospace, monospace;
  font-size: 11px; color: #71717a;
}

/* ---- Waveform ---- */
.waveform {
  display: flex; align-items: center; justify-content: center; gap: 4px;
  height: 80px; padding: 24px 20px 4px;
}
.waveform .bar {
  width: 3px; border-radius: 2px;
  background: linear-gradient(180deg, #7c3aed, #d946ef, #06b6d4);
  height: 12%;
  transition: height 200ms ease-out;
}
.waveform.active .bar {
  animation: bar 0.9s ease-in-out infinite;
  animation-delay: var(--delay, 0ms);
}
@keyframes bar {
  0%, 100% { height: 14%; }
  50% { height: var(--peak, 60%); }
}
/* Per-bar peak + delay for organic motion */
.waveform .bar:nth-child(1)  { --peak: 36%; --delay: 0ms; }
.waveform .bar:nth-child(2)  { --peak: 64%; --delay: 60ms; }
.waveform .bar:nth-child(3)  { --peak: 48%; --delay: 30ms; }
.waveform .bar:nth-child(4)  { --peak: 82%; --delay: 90ms; }
.waveform .bar:nth-child(5)  { --peak: 56%; --delay: 50ms; }
.waveform .bar:nth-child(6)  { --peak: 72%; --delay: 110ms; }
.waveform .bar:nth-child(7)  { --peak: 40%; --delay: 20ms; }
.waveform .bar:nth-child(8)  { --peak: 88%; --delay: 130ms; }
.waveform .bar:nth-child(9)  { --peak: 52%; --delay: 70ms; }
.waveform .bar:nth-child(10) { --peak: 76%; --delay: 100ms; }
.waveform .bar:nth-child(11) { --peak: 44%; --delay: 40ms; }
.waveform .bar:nth-child(12) { --peak: 90%; --delay: 150ms; }
.waveform .bar:nth-child(13) { --peak: 60%; --delay: 80ms; }
.waveform .bar:nth-child(14) { --peak: 72%; --delay: 120ms; }
.waveform .bar:nth-child(15) { --peak: 38%; --delay: 30ms; }
.waveform .bar:nth-child(16) { --peak: 84%; --delay: 140ms; }
.waveform .bar:nth-child(17) { --peak: 50%; --delay: 60ms; }
.waveform .bar:nth-child(18) { --peak: 68%; --delay: 100ms; }
.waveform .bar:nth-child(19) { --peak: 42%; --delay: 20ms; }
.waveform .bar:nth-child(20) { --peak: 78%; --delay: 110ms; }
.waveform .bar:nth-child(21) { --peak: 54%; --delay: 50ms; }
.waveform .bar:nth-child(22) { --peak: 86%; --delay: 130ms; }
.waveform .bar:nth-child(23) { --peak: 46%; --delay: 30ms; }
.waveform .bar:nth-child(24) { --peak: 70%; --delay: 90ms; }
.waveform .bar:nth-child(25) { --peak: 58%; --delay: 70ms; }
.waveform .bar:nth-child(26) { --peak: 80%; --delay: 120ms; }
.waveform .bar:nth-child(27) { --peak: 36%; --delay: 40ms; }
.waveform .bar:nth-child(28) { --peak: 64%; --delay: 100ms; }

.status-line {
  text-align: center;
  font-size: 11px;
  color: #71717a;
  font-family: 'JetBrains Mono', ui-monospace, monospace;
  text-transform: uppercase;
  letter-spacing: 0.16em;
  padding: 4px 20px 12px;
}

/* ---- Transcript bubbles ---- */
.transcript {
  display: grid; gap: 8px;
  padding: 12px 20px;
  max-height: 220px; overflow-y: auto;
  scrollbar-width: thin;
}
.bubble {
  max-width: 85%;
  padding: 8px 14px;
  border-radius: 16px;
  font-size: 13px; line-height: 1.4;
  animation: bubble-in 220ms cubic-bezier(0.34, 1.56, 0.64, 1) both;
}
.bubble.agent {
  align-self: flex-start;
  background: #18181b; color: #fafafa;
  border-bottom-left-radius: 6px;
}
.bubble.user {
  align-self: flex-end;
  background: #fff; color: #18181b;
  border: 1px solid #e4e4e7;
  border-bottom-right-radius: 6px;
}
.bubble.system {
  align-self: center;
  background: #fef3c7; color: #92400e;
  font-size: 11px; padding: 4px 12px; border-radius: 9999px;
}
@keyframes bubble-in {
  0% { opacity: 0; transform: translateY(4px); }
  100% { opacity: 1; transform: translateY(0); }
}

/* ---- Product cards ---- */
.cards-row { display: flex; gap: 10px; overflow-x: auto; padding: 4px 2px; scrollbar-width: thin; }
.card {
  flex: 0 0 200px;
  background: #fff; border: 1px solid #e4e4e7; border-radius: 14px;
  padding: 8px; cursor: pointer;
  transition: transform 200ms cubic-bezier(0.34, 1.56, 0.64, 1), border-color 200ms ease-out, box-shadow 200ms ease-out;
}
.card:hover {
  transform: translateY(-2px);
  border-color: #7c3aed;
  box-shadow: 0 12px 24px -10px rgba(124,58,237,0.3);
}
.card img { width: 100%; height: 110px; object-fit: cover; border-radius: 8px; background: #f4f4f5; }
.card .title { font-size: 13px; font-weight: 500; margin: 6px 0 2px; }
.card .price { font-size: 12px; color: #71717a; font-family: 'JetBrains Mono', ui-monospace, monospace; }

/* ---- Call controls ---- */
.controls {
  display: flex; align-items: center; justify-content: center; gap: 12px;
  padding: 16px 20px;
  border-top: 1px solid rgba(228,228,231,0.7);
  background: rgba(250,250,250,0.6);
  backdrop-filter: blur(12px);
}
.ctrl {
  width: 48px; height: 48px;
  border-radius: 9999px;
  border: 1px solid #e4e4e7;
  background: #fff;
  display: grid; place-items: center;
  cursor: pointer;
  color: #18181b;
  transition: transform 150ms ease-out, background 150ms ease-out, border-color 150ms ease-out, box-shadow 150ms ease-out;
}
.ctrl:hover { transform: translateY(-1px); box-shadow: 0 8px 16px -8px rgba(0,0,0,0.18); }
.ctrl:active { transform: translateY(0) scale(0.96); }
.ctrl.muted {
  border-color: rgba(244,63,94,0.4);
  background: rgba(244,63,94,0.1);
  color: #f43f5e;
}
.ctrl.end {
  width: 56px; height: 56px;
  background: #f43f5e; color: #fff; border: none;
  box-shadow: 0 8px 20px -6px rgba(244,63,94,0.55);
}
.ctrl.end:hover { box-shadow: 0 12px 26px -6px rgba(244,63,94,0.7); }
.ctrl :where(svg) { width: 20px; height: 20px; }
.ctrl.end :where(svg) { width: 22px; height: 22px; }

/* ---- Chat input ---- */
.input-row {
  display: flex; align-items: center; gap: 8px;
  padding: 10px;
  border-top: 1px solid rgba(228,228,231,0.7);
}
.input-row input {
  flex: 1;
  padding: 10px 14px;
  border: 1px solid #e4e4e7; border-radius: 9999px;
  font-size: 13px; font-family: inherit;
  outline: none;
  transition: border-color 150ms ease-out, box-shadow 150ms ease-out;
}
.input-row input:focus {
  border-color: #7c3aed;
  box-shadow: 0 0 0 3px rgba(124,58,237,0.15);
}
.input-row .send {
  width: 36px; height: 36px;
  border-radius: 9999px;
  background: linear-gradient(135deg, #7c3aed, #d946ef);
  color: #fff; border: none; cursor: pointer;
  display: grid; place-items: center;
  transition: transform 150ms ease-out, box-shadow 150ms ease-out, opacity 150ms ease-out;
  box-shadow: 0 6px 14px -4px rgba(217,70,239,0.55);
}
.input-row .send:hover:not(:disabled) { transform: translateY(-1px); box-shadow: 0 10px 20px -6px rgba(217,70,239,0.65); }
.input-row .send:active:not(:disabled) { transform: translateY(0) scale(0.96); }
.input-row .send:disabled { opacity: 0.5; cursor: not-allowed; }
.input-row .send :where(svg) { width: 14px; height: 14px; }

.checkout-cta {
  display: block;
  padding: 12px 16px;
  background: linear-gradient(90deg, #7c3aed, #d946ef, #06b6d4);
  color: #fff; text-align: center; text-decoration: none;
  font-weight: 600; font-size: 13px;
  letter-spacing: 0.02em;
  transition: filter 150ms ease-out, transform 150ms ease-out;
}
.checkout-cta:hover { filter: brightness(1.08); }
.checkout-cta:active { transform: scale(0.99); }

.connection-chip {
  position: absolute; top: 8px; left: 50%; transform: translateX(-50%);
  font-size: 10px; padding: 2px 8px; border-radius: 9999px;
  background: rgba(0,0,0,0.6); color: #fff;
  font-family: 'JetBrains Mono', ui-monospace, monospace;
  z-index: 2;
}

.hidden { display: none !important; }

/* ---- Reduced motion (a11y) ---- */
@media (prefers-reduced-motion: reduce) {
  .pill, .panel, .bubble, .avatar, .btn, .ctrl, .card, .input-row .send, .input-row input { animation: none !important; transition: none !important; }
  .avatar::after { animation: none !important; }
  .waveform.active .bar { animation: none !important; }
}
`;
