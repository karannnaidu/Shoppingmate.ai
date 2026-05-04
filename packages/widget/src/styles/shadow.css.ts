export const SHADOW_CSS = `
:host { all: initial; }
* { box-sizing: border-box; }
.root {
  position: fixed;
  bottom: 20px;
  right: 20px;
  z-index: 2147483647;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  font-size: 14px;
  color: #fff;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 12px;
  pointer-events: none;
}
.root > * { pointer-events: auto; }

.pill {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  background: #09090b;
  border: 1px solid rgba(255,255,255,0.1);
  border-radius: 9999px;
  padding: 6px 8px 6px 6px;
  box-shadow: 0 18px 40px -12px rgba(124,58,237,0.45), 0 8px 20px -8px rgba(0,0,0,0.5);
  cursor: pointer;
}
.avatar {
  width: 40px; height: 40px; border-radius: 9999px; display: grid; place-items: center;
  background: linear-gradient(135deg, #7c3aed, #d946ef, #06b6d4);
  font-weight: 600; font-size: 14px;
  position: relative;
  border: none; color: #fff; cursor: pointer;
}
.avatar::after {
  content: ""; position: absolute; bottom: 0; right: 0;
  width: 12px; height: 12px; border-radius: 9999px;
  background: #34d399; box-shadow: 0 0 0 2px #09090b;
}
.pill .label { display: flex; flex-direction: column; line-height: 1.1; padding-right: 4px; text-align: left; }
.pill .label-main { font-size: 13px; font-weight: 500; }
.pill .label-sub { font-size: 9.5px; text-transform: uppercase; letter-spacing: 0.18em; color: rgba(255,255,255,0.55); font-family: ui-monospace, monospace; }
.actions { display: flex; align-items: center; gap: 4px; margin-left: 4px; }
.btn {
  border: none; cursor: pointer; font: inherit; color: #fff;
  display: inline-flex; align-items: center; gap: 6px;
  border-radius: 9999px; padding: 8px 16px; font-size: 12px; font-weight: 600;
  background: linear-gradient(90deg, #7c3aed, #d946ef, #06b6d4);
  box-shadow: 0 6px 18px -4px rgba(217,70,239,0.55);
}
.btn-end { background: #f43f5e; box-shadow: none; }
.btn-icon { background: rgba(255,255,255,0.05); width: 36px; height: 36px; padding: 0; justify-content: center; }
.btn-icon:hover { background: rgba(255,255,255,0.1); }

.panel {
  width: min(380px, calc(100vw - 40px));
  background: #fff; color: #18181b;
  border: 1px solid #e4e4e7; border-radius: 22px;
  overflow: hidden;
  box-shadow: 0 24px 48px -12px rgba(0,0,0,0.25);
  display: flex; flex-direction: column;
  position: relative;
}
.panel-header { display: flex; align-items: center; justify-content: space-between; padding: 14px 20px; border-bottom: 1px solid #e4e4e7; }
.panel-header .who { display: flex; align-items: center; gap: 10px; }
.panel-header .who .name { font-size: 14px; font-weight: 500; }
.panel-header .who .sub { font-size: 10px; text-transform: uppercase; letter-spacing: 0.16em; color: #71717a; font-family: ui-monospace, monospace; }
.elapsed { font-family: ui-monospace, monospace; font-size: 11px; color: #71717a; }

.waveform { display: flex; align-items: center; justify-content: center; gap: 4px; height: 80px; padding: 24px 20px 8px; }
.waveform .bar { width: 3px; border-radius: 2px; background: linear-gradient(180deg, #7c3aed, #d946ef, #06b6d4); height: 10%; transition: height 0.2s; }
.waveform.active .bar { animation: bar 0.8s ease-in-out infinite; }
@keyframes bar { 0%,100% { height: 12%; } 50% { height: var(--peak, 60%); } }
.waveform .bar:nth-child(2n) { --peak: 70%; }
.waveform .bar:nth-child(3n) { --peak: 45%; }
.waveform .bar:nth-child(5n) { --peak: 80%; }
.waveform .bar:nth-child(7n) { --peak: 35%; }

.transcript { display: grid; gap: 8px; padding: 12px 20px; max-height: 220px; overflow-y: auto; }
.bubble { max-width: 85%; padding: 8px 14px; border-radius: 16px; font-size: 13px; line-height: 1.4; }
.bubble.agent { align-self: flex-start; background: #18181b; color: #fafafa; border-bottom-left-radius: 6px; }
.bubble.user { align-self: flex-end; background: #fff; color: #18181b; border: 1px solid #e4e4e7; border-bottom-right-radius: 6px; }
.bubble.system { align-self: center; background: #fef3c7; color: #92400e; font-size: 11px; padding: 4px 12px; border-radius: 9999px; }

.cards-row { display: flex; gap: 10px; overflow-x: auto; padding: 4px 2px; scrollbar-width: thin; }
.card { flex: 0 0 200px; background: #fff; border: 1px solid #e4e4e7; border-radius: 14px; padding: 8px; cursor: pointer; transition: transform 0.15s; }
.card:hover { transform: translateY(-2px); border-color: #7c3aed; }
.card img { width: 100%; height: 110px; object-fit: cover; border-radius: 8px; background: #f4f4f5; }
.card .title { font-size: 13px; font-weight: 500; margin: 6px 0 2px; }
.card .price { font-size: 12px; color: #71717a; }

.controls { display: flex; align-items: center; justify-content: center; gap: 12px; padding: 16px 20px; border-top: 1px solid #e4e4e7; background: #fafafa; }
.ctrl { width: 48px; height: 48px; border-radius: 9999px; border: 1px solid #e4e4e7; background: #fff; display: grid; place-items: center; cursor: pointer; }
.ctrl.muted { border-color: rgba(244,63,94,0.4); background: rgba(244,63,94,0.1); color: #f43f5e; }
.ctrl.end { width: 56px; height: 56px; background: #f43f5e; color: #fff; border: none; }

.input-row { display: flex; align-items: center; gap: 8px; padding: 10px; border-top: 1px solid #e4e4e7; }
.input-row input { flex: 1; padding: 8px 14px; border: 1px solid #e4e4e7; border-radius: 9999px; font-size: 13px; outline: none; }
.input-row input:focus { border-color: #7c3aed; }
.input-row .send { width: 36px; height: 36px; border-radius: 9999px; background: #18181b; color: #fff; border: none; cursor: pointer; display: grid; place-items: center; }

.checkout-cta {
  display: block; padding: 10px 16px; background: linear-gradient(90deg, #7c3aed, #06b6d4);
  color: #fff; text-align: center; text-decoration: none; font-weight: 600; font-size: 13px;
}
.connection-chip {
  position: absolute; top: 8px; left: 50%; transform: translateX(-50%);
  font-size: 10px; padding: 2px 8px; border-radius: 9999px;
  background: rgba(0,0,0,0.6); color: #fff; font-family: ui-monospace, monospace;
}
.hidden { display: none !important; }
`;
