"use strict";(()=>{var F=Object.defineProperty;var j=(t,n,e)=>n in t?F(t,n,{enumerable:!0,configurable:!0,writable:!0,value:e}):t[n]=e;var l=(t,n,e)=>j(t,typeof n!="symbol"?n+"":n,e);function h(){let t=globalThis,n=t.SpeechRecognition??t.webkitSpeechRecognition;if(!n)return null;let e=new n;e.continuous=!0,e.interimResults=!1,e.lang="en-US";let o=!1,i=[],r=[];return e.onresult=a=>{for(let c=0;c<a.results.length;c+=1){let d=a.results[c];if(d?.isFinal){let C=d[0]?.transcript?.trim();if(C)for(let D of i)D(C)}}},e.onerror=a=>{for(let c of r)c(String(a?.error??"unknown"))},e.onend=()=>{o=!1},{start:()=>{if(!o){o=!0;try{e.start()}catch{}}},stop:()=>{if(o){o=!1;try{e.stop()}catch{}}},onFinal:a=>{i.push(a)},onError:a=>{r.push(a)},isActive:()=>o}}function g(){let t=globalThis.speechSynthesis;if(!t)return{speak:async()=>{},cancel:()=>{},available:()=>!1};function n(){if(!t)return null;let e=t.getVoices();return e.find(o=>o.lang.startsWith("en-")&&o.default)??e.find(o=>o.lang.startsWith("en-"))??e[0]??null}return{speak:e=>new Promise(o=>{let i=new SpeechSynthesisUtterance(e),r=n();r&&(i.voice=r),i.rate=1,i.onend=()=>o(),i.onerror=()=>o(),t.speak(i)}),cancel:()=>t.cancel(),available:()=>!0}}function u(t,n){let e="idle",o=!1,i=[],r=a=>{if(e!==a){e=a;for(let c of i)c(a)}};return{start:()=>{if(e==="idle"){if(o){r("muted");return}t?.start(),r("listening")}},stop:()=>{t?.stop(),n.cancel(),r("idle")},speak:async a=>{e!=="idle"&&(t?.stop(),r("speaking"),await n.speak(a),o?r("muted"):(t?.start(),r("listening")))},setMuted:a=>{o=a,a?(t?.stop(),e==="listening"&&r("muted")):e==="muted"&&(t?.start(),r("listening"))},getState:()=>e,onStateChange:a=>{i.push(a)}}}var q="https://cdn.jsdelivr.net/npm",G="2.7.0";async function K(){return typeof globalThis.__SHOPPINGMATE_LIVEKIT_LOADER__=="function"?await globalThis.__SHOPPINGMATE_LIVEKIT_LOADER__():await import(`${q}/livekit-client@${G}/dist/livekit-client.esm.mjs`)}async function T(t){let n=await K(),e=new n.Room,o=new Map;e.on("trackSubscribed",r=>{let a=r;if(a.kind!=="audio")return;let c=a.attach();c.style.display="none",document.body.appendChild(c),o.set(r,c)}),e.on("trackUnsubscribed",r=>{let a=o.get(r);a&&(a.remove(),o.delete(r)),r.detach?.()});let i=[];return e.on("activeSpeakersChanged",r=>{let c=(r??[]).some(d=>!d.isLocal);for(let d of i)d(c)}),await e.connect(t.wsUrl,t.token),{setMicEnabled:r=>e.localParticipant.setMicrophoneEnabled(r),onData:r=>{e.on("dataReceived",a=>{a instanceof Uint8Array&&r(a)})},onAgentSpeaking:r=>{i.push(r)},disconnect:async()=>{for(let r of o.values())r.remove();o.clear(),await e.disconnect()}}}function I(t){let n="idle",e=null,o=!1,i=[],r=a=>{if(n!==a){n=a;for(let c of i)c(a)}};return{start:()=>{n==="idle"&&(async()=>{try{e=await T({wsUrl:t.wsUrl,token:t.token,roomName:t.roomName}),e.onData(a=>t.onTranscriptEvent(a)),e.onAgentSpeaking(a=>{o||r(a?"speaking":"listening")}),await e.setMicEnabled(!o),r(o?"muted":"listening")}catch(a){throw r("idle"),a}})().catch(a=>{console.warn("[voiceModeLiveKit] connect failed",a)})},stop:()=>{e?.disconnect().catch(()=>{}),e=null,r("idle")},speak:async()=>{},setMuted:a=>{o=a,e?.setMicEnabled(!a).catch(()=>{}),a?r("muted"):n==="muted"&&r("listening")},getState:()=>n,onStateChange:a=>{i.push(a)}}}function f(t){return t.stack==="web-speech"?u(h(),g()):t.stack==="live-kit"?t.livekit?I(t.livekit):(console.warn("[voiceModeFactory] live-kit stack requires livekit opts; returning null \u2192 caller falls back to chat"),null):null}async function E(t){try{let n=await fetch(`${t.apiBase}/v1/install`,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({merchantId:t.merchantId,domain:t.domain,userAgent:navigator.userAgent,referrer:document.referrer||null})});if(!n.ok)return{kind:"err",reason:`install_${n.status}`};let e=await n.json(),o=await fetch(`${t.apiBase}/v1/session`,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({merchantId:t.merchantId,domain:t.domain})});if(!o.ok)return{kind:"err",reason:`session_${o.status}`};let i=await o.json(),r=null;try{let a=await fetch(`${t.apiBase}/v1/voice/token`,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({sessionId:i.sessionId,merchantId:t.merchantId})});a.ok?r=await a.json():console.warn("[shoppingmate] voice unavailable \u2014 status",a.status)}catch(a){console.warn("[shoppingmate] voice unavailable \u2014",a)}return{kind:"ok",sessionId:i.sessionId,wsUrl:i.wsUrl,merchantStatus:e.status,voice:r}}catch(n){return{kind:"err",reason:n instanceof Error?n.message:"network"}}}var A=0,m=()=>(A+=1,`t${A}`);function Y(t,n){switch(n.type){case"set_mode":return{...t,mode:n.mode};case"set_voice_state":return{...t,voiceState:n.state};case"set_connection":return{...t,connection:n.status};case"reset":return{...t,transcript:[],thinking:!1,closed:!1,closedReason:null,checkoutUrl:null,capWarning:null};case"user_input":return{...t,transcript:[...t.transcript,{id:m(),role:"user",kind:"text",text:n.text,ts:Date.now()}]};case"agent_event":{let e=n.event;switch(e.type){case"thinking":return{...t,thinking:!0};case"end_of_turn":return{...t,thinking:!1};case"say":return{...t,thinking:!1,transcript:[...t.transcript,{id:m(),role:"agent",kind:"text",text:e.text,ts:Date.now()}]};case"user_text":return{...t,transcript:[...t.transcript,{id:m(),role:"user",kind:"text",text:e.text,ts:Date.now()}]};case"cards":return{...t,transcript:[...t.transcript,{id:m(),role:"agent",kind:"cards",items:e.items,ts:Date.now()}]};case"tool_result":return t;case"checkout_redirect":return{...t,checkoutUrl:e.url};case"cap_warning":return{...t,capWarning:{reason:e.reason,remaining:e.remaining},transcript:[...t.transcript,{id:m(),role:"system",kind:"cap_warning",remaining:e.remaining,ts:Date.now()}]};case"session_closed":return{...t,closed:!0,closedReason:e.reason,transcript:[...t.transcript,{id:m(),role:"system",kind:"closed",reason:e.reason,ts:Date.now()}]};default:return t}}default:return t}}function S(t){let n={sessionId:t.sessionId,mode:"pill",voiceState:"idle",transcript:[],thinking:!1,closed:!1,closedReason:null,checkoutUrl:null,capWarning:null,connection:"connecting"},e=[];return{get:()=>n,dispatch:o=>{n=Y(n,o);for(let i of e)i(n)},subscribe:o=>(e.push(o),()=>{let i=e.indexOf(o);i>=0&&e.splice(i,1)})}}var L=`
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
  display: inline-flex; align-items: center; gap: 6px;
}
.panel-header .who .sub.status-connected { color: #16a34a; }
.panel-header .who .sub.status-connected::before {
  content: ""; width: 6px; height: 6px; border-radius: 9999px;
  background: #22c55e;
  box-shadow: 0 0 8px rgba(34,197,94,0.7);
  animation: pulse 2s ease-in-out infinite;
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
`;function b(t){return JSON.stringify(t)}function M(t){let n;try{n=JSON.parse(t)}catch{return null}if(!n||typeof n!="object")return null;let e=n;switch(e.type){case"thinking":return{type:"thinking"};case"say":return typeof e.text=="string"?{type:"say",text:e.text}:null;case"user_text":return typeof e.text=="string"?{type:"user_text",text:e.text}:null;case"cards":return Array.isArray(e.items)?{type:"cards",items:e.items}:null;case"tool_result":return typeof e.toolName!="string"||typeof e.ok!="boolean"?null:{type:"tool_result",toolName:e.toolName,ok:e.ok,summary:typeof e.summary=="string"?e.summary:void 0};case"checkout_redirect":return typeof e.url=="string"?{type:"checkout_redirect",url:e.url}:null;case"cap_warning":return e.reason!=="turns"&&e.reason!=="voice_ms"&&e.reason!=="duration_ms"||typeof e.remaining!="number"?null:{type:"cap_warning",reason:e.reason,remaining:e.remaining};case"end_of_turn":return{type:"end_of_turn"};case"session_closed":return e.reason!=="user"&&e.reason!=="cap"&&e.reason!=="error"?null:{type:"session_closed",reason:e.reason};default:return null}}var H=[1e3,2e3,4e3,8e3,16e3],J=5;function N(t,n){let e=null,o=0,i=!1,r=[];function a(){i||(n.onStatus(o>0?"reconnecting":"connecting"),e=new WebSocket(t),e.onopen=()=>{n.onStatus("connected"),o>0&&e?.send(JSON.stringify({type:"session_resume",sessionId:n.sessionId})),o=0;for(let c of r)e?.send(c);r=[]},e.onmessage=c=>n.onEvent(typeof c.data=="string"?c.data:""),e.onerror=()=>{},e.onclose=()=>{if(i)return;if(o+=1,o>=J){n.onStatus("disconnected");return}let c=Math.min(o-1,H.length-1),d=H[c]??3e4;n.onStatus("reconnecting"),setTimeout(a,d)})}return a(),{send:c=>{e&&e.readyState===1?e.send(c):r.push(c)},close:()=>{i=!0,e?.close()}}}var s={pillCallable:"Talk to Sage",pillTextOnly:"Chat with Sage",pillCollapsed:"Sage",callBtn:"CALL",callBtnEnd:"END",chatBtnAria:"Open text chat",callBtnAria:"Start voice call",endCallAria:"End call",closeAria:"Close",callHeaderSpeaking:"speaking",callHeaderListening:"listening",callHeaderConnected:"CONNECTED",chatHeaderSubtitle:"text fallback \xB7 voice preferred",chatPlaceholder:"Type a quick question\u2026",chatGreeting:"Hi, I'm Sage. What are you shopping for today?",reconnecting:"Reconnecting\u2026",disconnected:"Connection lost \u2014 reload to retry",closed:{user:"Conversation ended",cap:"Time to wrap up \u2014 reload for a new chat",error:"Something went wrong"},payNow:"Pay now \u2192",capWarning:"A couple minutes left",thinking:"Sage is thinking\u2026",micDenied:"Mic blocked \u2014 switching to text"};function v(t){return t.replace(/[&<>"']/g,n=>n==="&"?"&amp;":n==="<"?"&lt;":n===">"?"&gt;":n==='"'?"&quot;":"&#39;")}function X(t,n){let e=document.createElement("button");return e.className="card",e.type="button",e.dataset.sku=t.sku,e.innerHTML=`
    ${t.image?`<img src="${v(t.image)}" alt="${v(t.title)}" />`:'<div class="card-img-fallback"></div>'}
    <div class="title">${v(t.title)}</div>
    <div class="price">${v(t.priceFormatted)}</div>
  `,e.addEventListener("click",()=>n({sku:t.sku,variantId:t.variantId})),e}function x(t,n,e){t.innerHTML="";for(let o of n)if(o.kind==="text"){let i=document.createElement("div");i.className=`bubble ${o.role}`,i.textContent=o.text,t.appendChild(i)}else if(o.kind==="cards"){let i=document.createElement("div");i.className="cards-row";for(let r of o.items)i.appendChild(X(r,e));t.appendChild(i)}else if(o.kind==="cap_warning"){let i=document.createElement("div");i.className="bubble system",i.textContent=s.capWarning,t.appendChild(i)}else if(o.kind==="closed"){let i=document.createElement("div");i.className="bubble system",i.textContent=s.closed[o.reason],t.appendChild(i)}t.scrollTop=t.scrollHeight}var p=t=>`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${t}</svg>`,y=p('<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>'),O=p('<path d="M18 6 6 18"/><path d="m6 6 12 12"/>'),k=p('<path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>'),w=p('<path d="M10.68 13.31a16 16 0 0 0 3.41 2.6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7 2 2 0 0 1 1.72 2v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.42 19.42 0 0 1-3.33-2.67"/><path d="M5 5a2 2 0 0 1 2-2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L10.9 11.1"/><line x1="22" y1="2" x2="2" y2="22"/>'),$=p('<path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="22"/>'),P=p('<line x1="2" y1="2" x2="22" y2="22"/><path d="M18.89 13.23A7.12 7.12 0 0 0 19 12v-2"/><path d="M5 10v2a7 7 0 0 0 12 5"/><path d="M15 9.34V5a3 3 0 0 0-5.68-1.33"/><path d="M9 9v3a3 3 0 0 0 5.12 2.12"/><line x1="12" y1="19" x2="12" y2="22"/>'),V=p('<path d="M22 2 11 13"/><path d="M22 2l-7 20-4-9-9-4 20-7z"/>');function R(t,n){let e=n.voiceState==="speaking",o=n.voiceState!=="idle",i=n.muted?"you're muted":e?`Sage is ${s.callHeaderSpeaking}\u2026`:`${s.callHeaderListening} to you\u2026`,r=o&&!n.muted;t.innerHTML=`
    <div class="panel">
      <div class="panel-header">
        <div class="who">
          <div class="avatar" aria-hidden="true">S</div>
          <div>
            <div class="name">Sage</div>
            <div class="sub status-${o?"connected":"idle"}">${o?s.callHeaderConnected:"\u2026"}</div>
          </div>
        </div>
      </div>
      <div class="waveform ${r?"active":""} ${e?"speaking":""}">
        ${Array.from({length:28}).map(()=>'<span class="bar"></span>').join("")}
      </div>
      <div class="status-line">${i}</div>
      <div class="transcript" data-region="transcript" aria-live="polite"></div>
      ${n.checkoutUrl?`<a class="checkout-cta" data-action="checkout" href="${n.checkoutUrl}" target="_blank" rel="noopener">${s.payNow}</a>`:""}
      <div class="controls">
        <button class="ctrl ${n.muted?"muted":""}" data-action="mute" aria-pressed="${n.muted}" aria-label="${n.muted?"Unmute":"Mute"}">${n.muted?P:$}</button>
        <button class="ctrl end" data-action="end" aria-label="${s.endCallAria}">${w}</button>
        <button class="ctrl" data-action="chat" aria-label="${s.chatBtnAria}">${y}</button>
      </div>
    </div>
  `;let a=t.querySelector('[data-region="transcript"]');a instanceof HTMLElement&&x(a,n.transcript,n.onCardTap),t.querySelector('[data-action="mute"]')?.addEventListener("click",()=>n.onMute(!n.muted)),t.querySelector('[data-action="end"]')?.addEventListener("click",n.onEnd),t.querySelector('[data-action="chat"]')?.addEventListener("click",n.onChat),t.querySelector('[data-action="checkout"]')?.addEventListener("click",n.onCheckout)}function B(t,n){t.innerHTML=`
    <div class="panel">
      <div class="panel-header">
        <div class="who">
          <div class="avatar" aria-hidden="true">S</div>
          <div>
            <div class="name">Sage</div>
            <div class="sub">${s.chatHeaderSubtitle}</div>
          </div>
        </div>
        <button class="btn" data-action="call" aria-label="${s.callBtnAria}">${k}<span>${s.callBtn}</span></button>
      </div>
      <div class="transcript" data-region="transcript" aria-live="polite"></div>
      ${n.checkoutUrl?`<a class="checkout-cta" href="${n.checkoutUrl}" target="_blank" rel="noopener">${s.payNow}</a>`:""}
      <form class="input-row">
        <input type="text" placeholder="${s.chatPlaceholder}" ${n.closed?"disabled":""} />
        <button class="send" type="submit" aria-label="Send" ${n.closed?"disabled":""}>${V}</button>
      </form>
    </div>
  `;let e=t.querySelector('[data-region="transcript"]');e instanceof HTMLElement&&x(e,n.transcript,n.onCardTap),t.querySelector('[data-action="call"]')?.addEventListener("click",n.onCall);let o=t.querySelector("form"),i=t.querySelector("input");o instanceof HTMLFormElement&&i instanceof HTMLInputElement&&o.addEventListener("submit",r=>{r.preventDefault();let a=i.value.trim();a&&(i.value="",n.onSend(a))})}function U(t,n){let e=n.mode!=="pill",o=n.mode==="call",i=n.mode==="chat",r=e?"Sage":n.callable?s.pillCallable:s.pillTextOnly;t.innerHTML=`
    <div class="pill" role="region" aria-label="Sage shopping assistant">
      <button class="avatar" data-action="toggle" aria-label="${e?s.closeAria:s.pillCollapsed}">S</button>
      <div class="label">
        <span class="label-main">${r}</span>
        <span class="label-sub">AI salesmate</span>
      </div>
      ${e?`
        <div class="actions">
          ${n.callable?`<button class="btn ${o?"btn-end":""}" data-action="call" aria-label="${o?s.endCallAria:s.callBtnAria}">${o?w:k}<span>${o?s.callBtnEnd:s.callBtn}</span></button>`:""}
          <button class="btn btn-icon" data-action="chat" aria-pressed="${i}" aria-label="${s.chatBtnAria}">${y}</button>
          <button class="btn btn-icon" data-action="close" aria-label="${s.closeAria}">${O}</button>
        </div>
      `:""}
    </div>
  `,t.querySelector('[data-action="toggle"]')?.addEventListener("click",()=>{n.mode==="pill"?n.onChat():n.onClose()}),t.querySelector('[data-action="call"]')?.addEventListener("click",n.onCall),t.querySelector('[data-action="chat"]')?.addEventListener("click",n.onChat),t.querySelector('[data-action="close"]')?.addEventListener("click",n.onClose)}var W="shoppingmate-widget";function Q(){return"live-kit"==="web-speech"?"web-speech":"live-kit"}var _=class extends HTMLElement{constructor(){super(...arguments);l(this,"rootEl",null);l(this,"pillHost",null);l(this,"panelHost",null);l(this,"store",S({sessionId:"pending"}));l(this,"socket",null);l(this,"voiceMode",u(null,g()));l(this,"voice",null);l(this,"apiBase","");l(this,"merchantId","");l(this,"domain",window.location.host)}connectedCallback(){if(this.shadowRoot)return;let e=this.getAttribute("data-id"),o=this.getAttribute("data-api")??this.apiBase;if(!e){console.warn("[shoppingmate] data-id missing on widget element");return}this.merchantId=e,this.apiBase=o;let i=this.attachShadow({mode:"open"}),r=document.createElement("style");r.textContent=L,i.appendChild(r);let a=document.createElement("div");a.className="root",i.appendChild(a),this.rootEl=a,this.panelHost=document.createElement("div"),this.pillHost=document.createElement("div"),a.appendChild(this.panelHost),a.appendChild(this.pillHost),this.store.subscribe(()=>this.render()),this.render(),this.start()}disconnectedCallback(){this.socket?.close(),this.voiceMode.stop()}async start(){let e=await E({apiBase:this.apiBase,merchantId:this.merchantId,domain:this.domain});if(e.kind==="err"){console.warn("[shoppingmate] bootstrap failed:",e.reason);return}this.store=S({sessionId:e.sessionId}),this.store.subscribe(()=>this.render()),this.voice=e.voice;let o=Q(),i=h();if(o==="live-kit"&&this.voice){let r=f({stack:"live-kit",livekit:{wsUrl:this.voice.wsUrl,token:this.voice.token,roomName:this.voice.roomName,onTranscriptEvent:a=>this.handleLiveKitData(a)}});r&&(this.voiceMode=r)}else{let r=f({stack:"web-speech"});r&&(this.voiceMode=r),i?.onFinal(a=>{this.store.dispatch({type:"user_input",text:a,mode:"voice"}),this.socket?.send(b({type:"user_text",sessionId:e.sessionId,text:a,mode:"voice"}))})}this.voiceMode.onStateChange(r=>this.store.dispatch({type:"set_voice_state",state:r})),this.socket=N(e.wsUrl,{sessionId:e.sessionId,onEvent:r=>{let a=M(r);a&&(this.store.dispatch({type:"agent_event",event:a}),a.type==="say"&&this.voiceMode.speak(a.text))},onStatus:r=>this.store.dispatch({type:"set_connection",status:r})})}render(){if(!this.pillHost||!this.panelHost)return;let e=this.store.get(),o=h()!==null;e.mode==="call"?R(this.panelHost,{voiceState:e.voiceState,muted:e.voiceState==="muted",transcript:e.transcript,checkoutUrl:e.checkoutUrl,onMute:i=>this.voiceMode.setMuted(i),onEnd:()=>{this.voiceMode.stop(),this.store.dispatch({type:"set_mode",mode:"expanded"})},onChat:()=>this.store.dispatch({type:"set_mode",mode:"chat"}),onCardTap:i=>this.cardTap(i),onCheckout:()=>{}}):e.mode==="chat"?B(this.panelHost,{transcript:e.transcript,checkoutUrl:e.checkoutUrl,onSend:i=>this.userText(i,"text"),onCall:()=>this.openCall(),onCardTap:i=>this.cardTap(i),closed:e.closed}):this.panelHost.innerHTML="",U(this.pillHost,{mode:e.mode,callable:o,onCall:()=>this.openCall(),onChat:()=>this.store.dispatch({type:"set_mode",mode:"chat"}),onClose:()=>this.store.dispatch({type:"set_mode",mode:"pill"})})}openCall(){this.store.dispatch({type:"set_mode",mode:"call"}),this.voiceMode.start()}userText(e,o){this.store.dispatch({type:"user_input",text:e,mode:o});let i=this.store.get().sessionId;this.socket?.send(b({type:"user_text",sessionId:i,text:e,mode:o}))}handleLiveKitData(e){let o;try{o=new TextDecoder().decode(e)}catch{return}let i=M(o);i&&this.store.dispatch({type:"agent_event",event:i})}cardTap(e){let o=this.store.get().sessionId;this.socket?.send(b({type:"card_tap",sessionId:o,action:"cartAdd",sku:e.sku,variantId:e.variantId,qty:1}))}};function z(){customElements.get(W)||customElements.define(W,_)}function Z(){let t=document.currentScript instanceof HTMLScriptElement?document.currentScript:null,n=t?.dataset.id;if(!n){console.warn("[shoppingmate] data-id missing on script tag");return}if(document.querySelector("shoppingmate-widget"))return;z();let e=document.createElement("shoppingmate-widget");e.setAttribute("data-id",n);let o=t?.dataset.api;e.setAttribute("data-api",o??"https://api-production-1ea1.up.railway.app"),document.body?document.body.appendChild(e):document.addEventListener("DOMContentLoaded",()=>document.body.appendChild(e),{once:!0})}Z();})();
