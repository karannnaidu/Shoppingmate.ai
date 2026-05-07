"use strict";(()=>{var G=Object.defineProperty;var K=(t,n,e)=>n in t?G(t,n,{enumerable:!0,configurable:!0,writable:!0,value:e}):t[n]=e;var d=(t,n,e)=>K(t,typeof n!="symbol"?n+"":n,e);function h(){let t=globalThis,n=t.SpeechRecognition??t.webkitSpeechRecognition;if(!n)return null;let e=new n;e.continuous=!0,e.interimResults=!1,e.lang="en-US";let a=!1,r=[],i=[];return e.onresult=o=>{for(let s=0;s<o.results.length;s+=1){let l=o.results[s];if(l?.isFinal){let p=l[0]?.transcript?.trim();if(p)for(let w of r)w(p)}}},e.onerror=o=>{for(let s of i)s(String(o?.error??"unknown"))},e.onend=()=>{a=!1},{start:()=>{if(!a){a=!0;try{e.start()}catch{}}},stop:()=>{if(a){a=!1;try{e.stop()}catch{}}},onFinal:o=>{r.push(o)},onError:o=>{i.push(o)},isActive:()=>a}}function f(){let t=globalThis.speechSynthesis;if(!t)return{speak:async()=>{},cancel:()=>{},available:()=>!1};function n(){if(!t)return null;let e=t.getVoices();return e.find(a=>a.lang.startsWith("en-")&&a.default)??e.find(a=>a.lang.startsWith("en-"))??e[0]??null}return{speak:e=>new Promise(a=>{let r=new SpeechSynthesisUtterance(e),i=n();i&&(r.voice=i),r.rate=1,r.onend=()=>a(),r.onerror=()=>a(),t.speak(r)}),cancel:()=>t.cancel(),available:()=>!0}}function g(t,n){let e="idle",a=!1,r=[],i=o=>{if(e!==o){e=o;for(let s of r)s(o)}};return{start:()=>{if(e==="idle"){if(a){i("muted");return}t?.start(),i("listening")}},stop:()=>{t?.stop(),n.cancel(),i("idle")},speak:async o=>{e!=="idle"&&(t?.stop(),i("speaking"),await n.speak(o),a?i("muted"):(t?.start(),i("listening")))},setMuted:o=>{a=o,o?(t?.stop(),e==="listening"&&i("muted")):e==="muted"&&(t?.start(),i("listening"))},getState:()=>e,onStateChange:o=>{r.push(o)}}}var J="https://cdn.jsdelivr.net/npm",Y="2.7.0";async function X(){return typeof globalThis.__SHOPPINGMATE_LIVEKIT_LOADER__=="function"?await globalThis.__SHOPPINGMATE_LIVEKIT_LOADER__():await import(`${J}/livekit-client@${Y}/dist/livekit-client.esm.mjs`)}async function I(t){let n=await X(),e=new n.Room,a=new Map;e.on("trackSubscribed",i=>{let o=i;if(o.kind!=="audio")return;let s=o.attach();s.style.display="none",document.body.appendChild(s),a.set(i,s)}),e.on("trackUnsubscribed",i=>{let o=a.get(i);o&&(o.remove(),a.delete(i)),i.detach?.()});let r=[];return e.on("activeSpeakersChanged",i=>{let s=(i??[]).some(l=>!l.isLocal);for(let l of r)l(s)}),await e.connect(t.wsUrl,t.token),{setMicEnabled:i=>e.localParticipant.setMicrophoneEnabled(i),onData:i=>{e.on("dataReceived",o=>{o instanceof Uint8Array&&i(o)})},onAgentSpeaking:i=>{r.push(i)},disconnect:async()=>{for(let i of a.values())i.remove();a.clear(),await e.disconnect()}}}function C(t){let n="idle",e=null,a=!1,r=[],i=o=>{if(n!==o){n=o;for(let s of r)s(o)}};return{start:()=>{n==="idle"&&(async()=>{try{e=await I({wsUrl:t.wsUrl,token:t.token,roomName:t.roomName}),e.onData(o=>t.onTranscriptEvent(o)),e.onAgentSpeaking(o=>{a||i(o?"speaking":"listening")}),await e.setMicEnabled(!a),i(a?"muted":"listening")}catch(o){throw i("idle"),o}})().catch(o=>{console.warn("[voiceModeLiveKit] connect failed",o)})},stop:()=>{e?.disconnect().catch(()=>{}),e=null,i("idle")},speak:async()=>{},setMuted:o=>{a=o,e?.setMicEnabled(!o).catch(()=>{}),o?i("muted"):n==="muted"&&i("listening")},getState:()=>n,onStateChange:o=>{r.push(o)}}}function b(t){return t.stack==="web-speech"?g(h(),f()):t.stack==="live-kit"?t.livekit?C(t.livekit):(console.warn("[voiceModeFactory] live-kit stack requires livekit opts; returning null \u2192 caller falls back to chat"),null):null}async function E(t){try{let n=await fetch(`${t.apiBase}/v1/install`,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({merchantId:t.merchantId,domain:t.domain,userAgent:navigator.userAgent,referrer:document.referrer||null})});if(!n.ok)return{kind:"err",reason:`install_${n.status}`};let e=await n.json(),a=await fetch(`${t.apiBase}/v1/session`,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({merchantId:t.merchantId,domain:t.domain})});if(!a.ok)return{kind:"err",reason:`session_${a.status}`};let r=await a.json(),i=null;try{let o=await fetch(`${t.apiBase}/v1/voice/token`,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({sessionId:r.sessionId,merchantId:t.merchantId})});o.ok?i=await o.json():console.warn("[shoppingmate] voice unavailable \u2014 status",o.status)}catch(o){console.warn("[shoppingmate] voice unavailable \u2014",o)}return{kind:"ok",sessionId:r.sessionId,wsUrl:r.wsUrl,merchantStatus:e.status,voice:i}}catch(n){return{kind:"err",reason:n instanceof Error?n.message:"network"}}}var A={"calm-clinician":"Sage",stylist:"Lumi",coach:"Kai",concierge:"Olivia",curator:"Theo",guide:"Maya",expert:"Arjun",host:"Ana"},Q="concierge";function Z(){let t="https://shoppingmate-web.vercel.app/widget/personas";return t&&typeof t=="string"?t.replace(/\/$/,""):"https://cdn.shoppingmate.ai/v1/personas"}function S(t){let n=t&&A[t]?t:Q,e=A[n]??"Olivia";return{id:n,name:e,initial:e.charAt(0).toUpperCase(),avatarUrl:`${Z()}/${n}.png`}}var N=0,u=()=>(N+=1,`t${N}`);function ee(t,n){switch(n.type){case"set_mode":return{...t,mode:n.mode};case"set_voice_state":return{...t,voiceState:n.state};case"set_connection":return{...t,connection:n.status};case"reset":return{...t,transcript:[],thinking:!1,closed:!1,closedReason:null,checkoutUrl:null,capWarning:null};case"user_input":return{...t,transcript:[...t.transcript,{id:u(),role:"user",kind:"text",text:n.text,ts:Date.now()}]};case"agent_event":{let e=n.event;switch(e.type){case"thinking":return{...t,thinking:!0};case"end_of_turn":return{...t,thinking:!1};case"say":{let a=t.transcript[t.transcript.length-1];return a&&a.role==="agent"&&a.kind==="text"&&a.partial?{...t,thinking:!1,transcript:[...t.transcript.slice(0,-1),{...a,text:e.text,partial:!1,ts:Date.now()}]}:{...t,thinking:!1,transcript:[...t.transcript,{id:u(),role:"agent",kind:"text",text:e.text,ts:Date.now()}]}}case"say_partial":{let a=t.transcript[t.transcript.length-1];return a&&a.role==="agent"&&a.kind==="text"&&a.partial?{...t,thinking:!1,transcript:[...t.transcript.slice(0,-1),{...a,text:e.text,ts:Date.now()}]}:{...t,thinking:!1,transcript:[...t.transcript,{id:u(),role:"agent",kind:"text",text:e.text,ts:Date.now(),partial:!0}]}}case"user_text":return{...t,transcript:[...t.transcript,{id:u(),role:"user",kind:"text",text:e.text,ts:Date.now()}]};case"cards":return{...t,transcript:[...t.transcript,{id:u(),role:"agent",kind:"cards",items:e.items,ts:Date.now()}]};case"tool_result":return t;case"checkout_redirect":return{...t,checkoutUrl:e.url};case"cap_warning":return{...t,capWarning:{reason:e.reason,remaining:e.remaining},transcript:[...t.transcript,{id:u(),role:"system",kind:"cap_warning",remaining:e.remaining,ts:Date.now()}]};case"session_closed":return{...t,closed:!0,closedReason:e.reason,transcript:[...t.transcript,{id:u(),role:"system",kind:"closed",reason:e.reason,ts:Date.now()}]};default:return t}}default:return t}}function _(t){let n={sessionId:t.sessionId,mode:"pill",voiceState:"idle",transcript:[],thinking:!1,closed:!1,closedReason:null,checkoutUrl:null,capWarning:null,connection:"connecting"},e=[];return{get:()=>n,dispatch:a=>{n=ee(n,a);for(let r of e)r(n)},subscribe:a=>(e.push(a),()=>{let r=e.indexOf(a);r>=0&&e.splice(r,1)})}}var L=`
:host { all: initial; }
* { box-sizing: border-box; }

.root {
  position: fixed;
  bottom: 20px;
  right: 20px;
  z-index: 2147483647;
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  font-size: 14px;
  color: #fafafa;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 12px;
  pointer-events: none;
}
.root > * { pointer-events: auto; }

/* ---- Tray (always-visible launcher) ---- */
.tray {
  display: inline-flex;
  align-items: center;
  gap: 12px;
  background: #0a0a0a;
  border: 1px solid rgba(255,255,255,0.08);
  border-radius: 9999px;
  padding: 6px 10px 6px 6px;
  box-shadow:
    0 24px 48px -16px rgba(0,0,0,0.65),
    0 8px 20px -8px rgba(0,0,0,0.5);
  animation: tray-in 280ms cubic-bezier(0.34, 1.56, 0.64, 1) both;
}
@keyframes tray-in {
  0% { opacity: 0; transform: translateY(8px) scale(0.96); }
  100% { opacity: 1; transform: translateY(0) scale(1); }
}

.tray-avatar {
  position: relative;
  width: 40px; height: 40px;
  border-radius: 9999px;
  border: none; padding: 0;
  cursor: pointer;
  background: #1a1a1a;
  overflow: hidden;
  flex-shrink: 0;
  transition: transform 200ms cubic-bezier(0.34, 1.56, 0.64, 1);
}
.tray-avatar:hover { transform: scale(1.04); }
.tray-avatar:active { transform: scale(0.96); }
.tray-avatar-img {
  width: 100%; height: 100%;
  object-fit: cover;
  display: block;
}
.tray-avatar-fallback {
  display: none;
  width: 100%; height: 100%;
  place-items: center;
  background: linear-gradient(135deg, #2a2a2a, #1a1a1a);
  color: #fff;
  font-weight: 600; font-size: 16px;
  letter-spacing: 0.02em;
}
.tray-presence {
  position: absolute;
  bottom: 0; right: 0;
  width: 11px; height: 11px;
  border-radius: 9999px;
  box-shadow: 0 0 0 2px #0a0a0a;
}
.tray-presence.connected {
  background: #22c55e;
  box-shadow: 0 0 0 2px #0a0a0a, 0 0 10px rgba(34,197,94,0.7);
  animation: pulse 2.4s ease-in-out infinite;
}
.tray-presence.idle {
  background: #52525b;
}
@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.55; }
}

.tray-meta {
  display: flex; flex-direction: column;
  line-height: 1.1;
  min-width: 0;
}
.tray-name {
  font-size: 13px; font-weight: 600; color: #fafafa;
  letter-spacing: -0.01em;
}
.tray-status {
  font-size: 9.5px;
  text-transform: uppercase;
  letter-spacing: 0.18em;
  font-family: 'JetBrains Mono', ui-monospace, monospace;
  display: inline-flex; align-items: center; gap: 5px;
  margin-top: 2px;
}
.tray-status.connected { color: #22c55e; }
.tray-status.idle { color: rgba(255,255,255,0.4); }
.tray-status-dot {
  width: 5px; height: 5px; border-radius: 9999px;
  background: currentColor;
}
.tray-status.connected .tray-status-dot {
  box-shadow: 0 0 6px rgba(34,197,94,0.7);
  animation: pulse 2s ease-in-out infinite;
}

/* ---- Tray waveform (compact) ---- */
.tray-waveform {
  display: flex; align-items: center; gap: 2px;
  height: 24px;
  padding: 0 4px;
}
.tray-waveform .bar {
  width: 2px; border-radius: 1px;
  background: rgba(255,255,255,0.25);
  height: 20%;
  transition: height 200ms ease-out, background 200ms ease-out;
}
.tray-waveform.active .bar {
  background: #22c55e;
  animation: tray-bar 0.9s ease-in-out infinite;
  animation-delay: var(--delay, 0ms);
}
.tray-waveform.active.speaking .bar { background: #fafafa; }
@keyframes tray-bar {
  0%, 100% { height: 18%; }
  50% { height: var(--peak, 70%); }
}
.tray-waveform .bar:nth-child(1)  { --peak: 40%; --delay: 0ms; }
.tray-waveform .bar:nth-child(2)  { --peak: 70%; --delay: 60ms; }
.tray-waveform .bar:nth-child(3)  { --peak: 50%; --delay: 30ms; }
.tray-waveform .bar:nth-child(4)  { --peak: 85%; --delay: 90ms; }
.tray-waveform .bar:nth-child(5)  { --peak: 60%; --delay: 50ms; }
.tray-waveform .bar:nth-child(6)  { --peak: 75%; --delay: 110ms; }
.tray-waveform .bar:nth-child(7)  { --peak: 45%; --delay: 20ms; }
.tray-waveform .bar:nth-child(8)  { --peak: 90%; --delay: 130ms; }
.tray-waveform .bar:nth-child(9)  { --peak: 55%; --delay: 70ms; }
.tray-waveform .bar:nth-child(10) { --peak: 80%; --delay: 100ms; }
.tray-waveform .bar:nth-child(11) { --peak: 48%; --delay: 40ms; }
.tray-waveform .bar:nth-child(12) { --peak: 92%; --delay: 150ms; }
.tray-waveform .bar:nth-child(13) { --peak: 62%; --delay: 80ms; }
.tray-waveform .bar:nth-child(14) { --peak: 75%; --delay: 120ms; }
.tray-waveform .bar:nth-child(15) { --peak: 42%; --delay: 30ms; }
.tray-waveform .bar:nth-child(16) { --peak: 86%; --delay: 140ms; }
.tray-waveform .bar:nth-child(17) { --peak: 52%; --delay: 60ms; }
.tray-waveform .bar:nth-child(18) { --peak: 70%; --delay: 100ms; }

/* ---- Tray controls ---- */
.tray-controls {
  display: flex; align-items: center; gap: 6px;
  margin-left: 4px;
}
.tray-btn {
  width: 32px; height: 32px;
  border-radius: 9999px;
  border: 1px solid rgba(255,255,255,0.1);
  background: rgba(255,255,255,0.06);
  color: #fafafa;
  display: grid; place-items: center;
  cursor: pointer;
  transition: transform 150ms ease-out, background 150ms ease-out, border-color 150ms ease-out;
}
.tray-btn:hover { background: rgba(255,255,255,0.12); transform: translateY(-1px); }
.tray-btn:active { transform: translateY(0) scale(0.96); }
.tray-btn.muted {
  background: rgba(244,63,94,0.15);
  border-color: rgba(244,63,94,0.4);
  color: #fb7185;
}
.tray-btn.end {
  background: #ef4444;
  border-color: transparent;
  color: #fff;
}
.tray-btn.end:hover { background: #dc2626; }
.tray-btn :where(svg) { width: 14px; height: 14px; }
.tray-btn.hidden { display: none; }

/* ---- Focus-visible (a11y) ---- */
.tray-avatar:focus-visible,
.tray-btn:focus-visible,
.send:focus-visible,
.input-row input:focus-visible,
.panel-close:focus-visible,
.card:focus-visible {
  outline: 2px solid #22c55e;
  outline-offset: 2px;
}

/* ---- Panel (welcome / chat / call surface) ---- */
.panel {
  width: min(360px, calc(100vw - 40px));
  background: #0a0a0a;
  color: #fafafa;
  border: 1px solid rgba(255,255,255,0.08);
  border-radius: 20px;
  overflow: hidden;
  box-shadow:
    0 32px 64px -16px rgba(0,0,0,0.7),
    0 12px 28px -10px rgba(0,0,0,0.5);
  display: flex; flex-direction: column;
  position: relative;
  animation: panel-in 320ms cubic-bezier(0.34, 1.56, 0.64, 1) both;
}
@keyframes panel-in {
  0% { opacity: 0; transform: translateY(12px) scale(0.97); }
  100% { opacity: 1; transform: translateY(0) scale(1); }
}

.panel-close {
  position: absolute; top: 10px; right: 10px;
  width: 28px; height: 28px;
  border-radius: 9999px;
  border: none;
  background: rgba(255,255,255,0.06);
  color: rgba(255,255,255,0.7);
  display: grid; place-items: center;
  cursor: pointer;
  z-index: 2;
  transition: background 150ms ease-out, color 150ms ease-out;
}
.panel-close:hover { background: rgba(255,255,255,0.12); color: #fafafa; }
.panel-close :where(svg) { width: 14px; height: 14px; }

/* ---- Welcome (empty state) ---- */
.welcome {
  padding: 28px 24px 16px;
  text-align: left;
}
.welcome-avatar {
  width: 56px; height: 56px;
  border-radius: 9999px;
  background: #1a1a1a;
  overflow: hidden;
  margin-bottom: 14px;
  position: relative;
}
.welcome-avatar img {
  width: 100%; height: 100%; object-fit: cover; display: block;
}
.welcome-avatar-fallback {
  display: none;
  width: 100%; height: 100%;
  place-items: center;
  background: linear-gradient(135deg, #2a2a2a, #1a1a1a);
  color: #fff;
  font-weight: 600; font-size: 22px;
}
.welcome-heading {
  font-size: 20px; font-weight: 600;
  color: #fafafa;
  margin: 0 0 4px;
  letter-spacing: -0.01em;
}
.welcome-sub {
  font-size: 13px; color: rgba(255,255,255,0.6);
  margin: 0 0 14px;
}
.welcome-bullets {
  list-style: none; padding: 0; margin: 0;
  display: grid; gap: 8px;
}
.welcome-bullets li {
  font-size: 13px; color: rgba(255,255,255,0.85);
  padding: 8px 12px;
  background: rgba(255,255,255,0.04);
  border: 1px solid rgba(255,255,255,0.06);
  border-radius: 10px;
}

.status-line {
  text-align: center;
  font-size: 11px;
  color: rgba(255,255,255,0.55);
  font-family: 'JetBrains Mono', ui-monospace, monospace;
  text-transform: uppercase;
  letter-spacing: 0.16em;
  padding: 18px 20px 8px;
}

/* ---- Transcript bubbles ---- */
.transcript {
  display: grid; gap: 8px;
  padding: 12px 20px;
  max-height: 240px; overflow-y: auto;
  scrollbar-width: thin;
  scrollbar-color: rgba(255,255,255,0.2) transparent;
}
.transcript-empty { padding: 0; max-height: 0; }
.transcript::-webkit-scrollbar { width: 6px; }
.transcript::-webkit-scrollbar-thumb {
  background: rgba(255,255,255,0.2); border-radius: 9999px;
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
  background: rgba(255,255,255,0.06);
  color: #fafafa;
  border-bottom-left-radius: 6px;
}
.bubble.user {
  align-self: flex-end;
  background: #fafafa; color: #0a0a0a;
  border-bottom-right-radius: 6px;
}
.bubble.system {
  align-self: center;
  background: rgba(251,191,36,0.12);
  color: #fcd34d;
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
  background: #1a1a1a;
  border: 1px solid rgba(255,255,255,0.08);
  border-radius: 14px;
  padding: 8px; cursor: pointer;
  color: #fafafa;
  transition: transform 200ms cubic-bezier(0.34, 1.56, 0.64, 1), border-color 200ms ease-out;
}
.card:hover {
  transform: translateY(-2px);
  border-color: rgba(34,197,94,0.5);
}
.card img {
  width: 100%; height: 110px; object-fit: cover;
  border-radius: 8px;
  background: #0a0a0a;
}
.card .title { font-size: 13px; font-weight: 500; margin: 6px 0 2px; }
.card .price {
  font-size: 12px; color: rgba(255,255,255,0.6);
  font-family: 'JetBrains Mono', ui-monospace, monospace;
}

/* ---- Chat input ---- */
.input-row {
  display: flex; align-items: center; gap: 8px;
  padding: 10px 12px;
  border-top: 1px solid rgba(255,255,255,0.06);
}
.input-row input {
  flex: 1;
  padding: 10px 14px;
  border: 1px solid rgba(255,255,255,0.1);
  background: rgba(255,255,255,0.04);
  color: #fafafa;
  border-radius: 9999px;
  font-size: 13px; font-family: inherit;
  outline: none;
  transition: border-color 150ms ease-out, background 150ms ease-out;
}
.input-row input::placeholder { color: rgba(255,255,255,0.4); }
.input-row input:focus {
  border-color: rgba(34,197,94,0.5);
  background: rgba(255,255,255,0.06);
}
.input-row .send {
  width: 36px; height: 36px;
  border-radius: 9999px;
  background: #22c55e;
  color: #0a0a0a; border: none; cursor: pointer;
  display: grid; place-items: center;
  transition: transform 150ms ease-out, background 150ms ease-out, opacity 150ms ease-out;
}
.input-row .send:hover:not(:disabled) { transform: translateY(-1px); background: #16a34a; }
.input-row .send:active:not(:disabled) { transform: translateY(0) scale(0.96); }
.input-row .send:disabled { opacity: 0.4; cursor: not-allowed; }
.input-row .send :where(svg) { width: 14px; height: 14px; }

.checkout-cta {
  display: block;
  margin: 0 16px 12px;
  padding: 12px 16px;
  background: #22c55e;
  color: #0a0a0a;
  text-align: center; text-decoration: none;
  font-weight: 600; font-size: 13px;
  letter-spacing: 0.02em;
  border-radius: 12px;
  transition: background 150ms ease-out, transform 150ms ease-out;
}
.checkout-cta:hover { background: #16a34a; }
.checkout-cta:active { transform: scale(0.99); }

/* ---- Panel footer ---- */
.panel-footer {
  text-align: center;
  font-size: 10px;
  color: rgba(255,255,255,0.35);
  font-family: 'JetBrains Mono', ui-monospace, monospace;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  padding: 8px 16px 12px;
  border-top: 1px solid rgba(255,255,255,0.04);
}

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
  .tray, .panel, .bubble, .tray-avatar, .tray-btn, .card, .input-row .send, .input-row input { animation: none !important; transition: none !important; }
  .tray-presence.connected,
  .tray-status.connected .tray-status-dot { animation: none !important; }
  .tray-waveform.active .bar { animation: none !important; }
}
`;function y(t){return JSON.stringify(t)}function M(t){let n;try{n=JSON.parse(t)}catch{return null}if(!n||typeof n!="object")return null;let e=n;switch(e.type){case"thinking":return{type:"thinking"};case"say":return typeof e.text=="string"?{type:"say",text:e.text}:null;case"say_partial":return typeof e.text=="string"?{type:"say_partial",text:e.text}:null;case"user_text":return typeof e.text=="string"?{type:"user_text",text:e.text}:null;case"cards":return Array.isArray(e.items)?{type:"cards",items:e.items}:null;case"tool_result":return typeof e.toolName!="string"||typeof e.ok!="boolean"?null:{type:"tool_result",toolName:e.toolName,ok:e.ok,summary:typeof e.summary=="string"?e.summary:void 0};case"checkout_redirect":return typeof e.url=="string"?{type:"checkout_redirect",url:e.url}:null;case"cap_warning":return e.reason!=="turns"&&e.reason!=="voice_ms"&&e.reason!=="duration_ms"||typeof e.remaining!="number"?null:{type:"cap_warning",reason:e.reason,remaining:e.remaining};case"end_of_turn":return{type:"end_of_turn"};case"session_closed":return e.reason!=="user"&&e.reason!=="cap"&&e.reason!=="error"?null:{type:"session_closed",reason:e.reason};default:return null}}var H=[1e3,2e3,4e3,8e3,16e3],te=5;function $(t,n){let e=null,a=0,r=!1,i=[];function o(){r||(n.onStatus(a>0?"reconnecting":"connecting"),e=new WebSocket(t),e.onopen=()=>{n.onStatus("connected"),a>0&&e?.send(JSON.stringify({type:"session_resume",sessionId:n.sessionId})),a=0;for(let s of i)e?.send(s);i=[]},e.onmessage=s=>n.onEvent(typeof s.data=="string"?s.data:""),e.onerror=()=>{},e.onclose=()=>{if(r)return;if(a+=1,a>=te){n.onStatus("disconnected");return}let s=Math.min(a-1,H.length-1),l=H[s]??3e4;n.onStatus("reconnecting"),setTimeout(o,l)})}return o(),{send:s=>{e&&e.readyState===1?e.send(s):i.push(s)},close:()=>{r=!0,e?.close()}}}var c={trayConnected:"CONNECTED",trayOffline:"OFFLINE",micStart:"Start voice call",micMute:"Mute mic",micUnmute:"Unmute mic",endCallAria:"End call",closeAria:"Close",openAria:"Open shoppingmate",panelHelpHeading:"Hi, I'm",panelHelpSubtitle:"I'm here to help you:",panelBullets:["Find the right product fast","Compare options out loud","Check out without leaving the page"],poweredBy:"Powered by shoppingmate",chatPlaceholder:"Type a quick question\u2026",reconnecting:"Reconnecting\u2026",disconnected:"Connection lost \u2014 reload to retry",closed:{user:"Conversation ended",cap:"Time to wrap up \u2014 reload for a new chat",error:"Something went wrong"},payNow:"Pay now \u2192",capWarning:"A couple minutes left",thinking:"thinking\u2026",micDenied:"Mic blocked \u2014 switching to text"};var m=t=>`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${t}</svg>`,Ie=m('<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>'),v=m('<path d="M18 6 6 18"/><path d="m6 6 12 12"/>'),Ce=m('<path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>'),P=m('<path d="M10.68 13.31a16 16 0 0 0 3.41 2.6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7 2 2 0 0 1 1.72 2v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.42 19.42 0 0 1-3.33-2.67"/><path d="M5 5a2 2 0 0 1 2-2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L10.9 11.1"/><line x1="22" y1="2" x2="2" y2="22"/>'),O=m('<path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="22"/>'),U=m('<line x1="2" y1="2" x2="22" y2="22"/><path d="M18.89 13.23A7.12 7.12 0 0 0 19 12v-2"/><path d="M5 10v2a7 7 0 0 0 12 5"/><path d="M15 9.34V5a3 3 0 0 0-5.68-1.33"/><path d="M9 9v3a3 3 0 0 0 5.12 2.12"/><line x1="12" y1="19" x2="12" y2="22"/>'),V=m('<path d="M22 2 11 13"/><path d="M22 2l-7 20-4-9-9-4 20-7z"/>');function x(t){return t.replace(/[&<>"']/g,n=>n==="&"?"&amp;":n==="<"?"&lt;":n===">"?"&gt;":n==='"'?"&quot;":"&#39;")}function ne(t,n){let e=document.createElement("button");return e.className="card",e.type="button",e.dataset.sku=t.sku,e.innerHTML=`
    ${t.image?`<img src="${x(t.image)}" alt="${x(t.title)}" />`:'<div class="card-img-fallback"></div>'}
    <div class="title">${x(t.title)}</div>
    <div class="price">${x(t.priceFormatted)}</div>
  `,e.addEventListener("click",()=>n({sku:t.sku,variantId:t.variantId})),e}function k(t,n,e){t.innerHTML="";for(let a of n)if(a.kind==="text"){let r=document.createElement("div");r.className=`bubble ${a.role}`,r.textContent=a.text,t.appendChild(r)}else if(a.kind==="cards"){let r=document.createElement("div");r.className="cards-row";for(let i of a.items)r.appendChild(ne(i,e));t.appendChild(r)}else if(a.kind==="cap_warning"){let r=document.createElement("div");r.className="bubble system",r.textContent=c.capWarning,t.appendChild(r)}else if(a.kind==="closed"){let r=document.createElement("div");r.className="bubble system",r.textContent=c.closed[a.reason],t.appendChild(r)}t.scrollTop=t.scrollHeight}function R(t,n){let e=n.voiceState==="speaking",a=n.muted?"you're muted":e?`${n.personaName} is speaking\u2026`:`${n.personaName} is listening\u2026`;t.innerHTML=`
    <div class="panel call-panel">
      <button class="panel-close" data-action="close" aria-label="${c.closeAria}">${v}</button>
      <div class="status-line">${a}</div>
      <div class="transcript" data-region="transcript" aria-live="polite"></div>
      ${n.checkoutUrl?`<a class="checkout-cta" data-action="checkout" href="${n.checkoutUrl}" target="_blank" rel="noopener">${c.payNow}</a>`:""}
      <div class="panel-footer">${c.poweredBy}</div>
    </div>
  `;let r=t.querySelector('[data-region="transcript"]');r instanceof HTMLElement&&k(r,n.transcript,n.onCardTap),t.querySelector('[data-action="close"]')?.addEventListener("click",n.onClose),t.querySelector('[data-action="checkout"]')?.addEventListener("click",n.onCheckout)}function D(t,n){let e=n.transcript.length===0,a=c.panelBullets.map(l=>`<li>${l}</li>`).join(""),r=e?`
      <div class="welcome">
        <div class="welcome-avatar">
          <img src="${n.personaAvatarUrl}" alt="" onerror="this.style.display='none'; this.nextElementSibling.style.display='grid';" />
          <span class="welcome-avatar-fallback" aria-hidden="true">${n.personaInitial}</span>
        </div>
        <h2 class="welcome-heading">${c.panelHelpHeading} ${n.personaName}.</h2>
        <p class="welcome-sub">${c.panelHelpSubtitle}</p>
        <ul class="welcome-bullets">${a}</ul>
      </div>
    `:"";t.innerHTML=`
    <div class="panel">
      <button class="panel-close" data-action="close" aria-label="${c.closeAria}">${v}</button>
      ${r}
      <div class="transcript ${e?"transcript-empty":""}" data-region="transcript" aria-live="polite"></div>
      ${n.checkoutUrl?`<a class="checkout-cta" href="${n.checkoutUrl}" target="_blank" rel="noopener">${c.payNow}</a>`:""}
      <form class="input-row">
        <input type="text" placeholder="${c.chatPlaceholder}" ${n.closed?"disabled":""} />
        <button class="send" type="submit" aria-label="Send" ${n.closed?"disabled":""}>${V}</button>
      </form>
      <div class="panel-footer">${c.poweredBy}</div>
    </div>
  `;let i=t.querySelector('[data-region="transcript"]');i instanceof HTMLElement&&k(i,n.transcript,n.onCardTap),t.querySelector('[data-action="close"]')?.addEventListener("click",n.onClose);let o=t.querySelector("form"),s=t.querySelector("input");o instanceof HTMLFormElement&&s instanceof HTMLInputElement&&o.addEventListener("submit",l=>{l.preventDefault();let p=s.value.trim();p&&(s.value="",n.onSend(p))})}function B(t,n){let e=n.mode==="call"||n.voiceState!=="idle",a=n.voiceState==="muted",r=n.voiceState==="speaking",i=n.voiceState!=="idle",o=i&&!a,s=n.mode==="chat"||n.mode==="call"||n.mode==="expanded",l=i?c.trayConnected:c.trayOffline,p=i?"tray-status connected":"tray-status idle",w=`
    <div class="tray-waveform ${o?"active":""} ${r?"speaking":""}" aria-hidden="true">
      ${Array.from({length:18}).map(()=>'<span class="bar"></span>').join("")}
    </div>
  `,z=n.callable?e?a?c.micUnmute:c.micMute:c.micStart:c.micStart,j=a?U:O,q=!e;t.innerHTML=`
    <div class="tray" role="region" aria-label="shoppingmate">
      <button class="tray-avatar" data-action="toggle" aria-expanded="${s}" aria-label="${c.openAria}">
        <img src="${n.personaAvatarUrl}" alt="" class="tray-avatar-img" onerror="this.style.display='none'; this.nextElementSibling.style.display='grid';" />
        <span class="tray-avatar-fallback" aria-hidden="true">${n.personaInitial}</span>
        <span class="tray-presence ${i?"connected":"idle"}"></span>
      </button>
      <div class="tray-meta">
        <div class="tray-name">${n.personaName}</div>
        <div class="${p}"><span class="tray-status-dot"></span>${l}</div>
      </div>
      ${w}
      <div class="tray-controls">
        <button class="tray-btn ${a?"muted":""}" data-action="mic" aria-pressed="${a}" aria-label="${z}">${j}</button>
        <button class="tray-btn end ${q?"hidden":""}" data-action="end" aria-label="${c.endCallAria}">${P}</button>
      </div>
    </div>
  `,t.querySelector('[data-action="toggle"]')?.addEventListener("click",()=>{s?n.onClose():n.onChat()}),t.querySelector('[data-action="mic"]')?.addEventListener("click",()=>{e?n.onMute(!a):n.onCall()}),t.querySelector('[data-action="end"]')?.addEventListener("click",n.onEnd)}var W="shoppingmate-widget";function ae(){return"live-kit"==="web-speech"?"web-speech":"live-kit"}var T=class extends HTMLElement{constructor(){super(...arguments);d(this,"rootEl",null);d(this,"pillHost",null);d(this,"panelHost",null);d(this,"store",_({sessionId:"pending"}));d(this,"socket",null);d(this,"voiceMode",g(null,f()));d(this,"voice",null);d(this,"persona",S(null));d(this,"apiBase","");d(this,"merchantId","");d(this,"domain",window.location.host)}connectedCallback(){if(this.shadowRoot)return;let e=this.getAttribute("data-id"),a=this.getAttribute("data-api")??this.apiBase;if(!e){console.warn("[shoppingmate] data-id missing on widget element");return}this.merchantId=e,this.apiBase=a;let r=this.attachShadow({mode:"open"}),i=document.createElement("style");i.textContent=L,r.appendChild(i);let o=document.createElement("div");o.className="root",r.appendChild(o),this.rootEl=o,this.panelHost=document.createElement("div"),this.pillHost=document.createElement("div"),o.appendChild(this.panelHost),o.appendChild(this.pillHost),this.store.subscribe(()=>this.render()),this.render(),this.start()}disconnectedCallback(){this.socket?.close(),this.voiceMode.stop()}async start(){let e=await E({apiBase:this.apiBase,merchantId:this.merchantId,domain:this.domain});if(e.kind==="err"){console.warn("[shoppingmate] bootstrap failed:",e.reason);return}this.store=_({sessionId:e.sessionId}),this.store.subscribe(()=>this.render()),this.voice=e.voice,this.persona=S(e.voice?.personaId??null);let a=ae(),r=h();if(a==="live-kit"&&this.voice){let i=b({stack:"live-kit",livekit:{wsUrl:this.voice.wsUrl,token:this.voice.token,roomName:this.voice.roomName,onTranscriptEvent:o=>this.handleLiveKitData(o)}});i&&(this.voiceMode=i)}else{let i=b({stack:"web-speech"});i&&(this.voiceMode=i),r?.onFinal(o=>{this.store.dispatch({type:"user_input",text:o,mode:"voice"}),this.socket?.send(y({type:"user_text",sessionId:e.sessionId,text:o,mode:"voice"}))})}this.voiceMode.onStateChange(i=>this.store.dispatch({type:"set_voice_state",state:i})),this.socket=$(e.wsUrl,{sessionId:e.sessionId,onEvent:i=>{let o=M(i);o&&(this.store.dispatch({type:"agent_event",event:o}),o.type==="say"&&this.voiceMode.speak(o.text))},onStatus:i=>this.store.dispatch({type:"set_connection",status:i})})}render(){if(!this.pillHost||!this.panelHost)return;let e=this.store.get(),a=h()!==null;e.mode==="call"?R(this.panelHost,{voiceState:e.voiceState,muted:e.voiceState==="muted",transcript:e.transcript,checkoutUrl:e.checkoutUrl,personaName:this.persona.name,onClose:()=>this.store.dispatch({type:"set_mode",mode:"pill"}),onCardTap:r=>this.cardTap(r),onCheckout:()=>{}}):e.mode==="chat"||e.mode==="expanded"?D(this.panelHost,{transcript:e.transcript,checkoutUrl:e.checkoutUrl,personaName:this.persona.name,personaInitial:this.persona.initial,personaAvatarUrl:this.persona.avatarUrl,onSend:r=>this.userText(r,"text"),onCall:()=>this.openCall(),onClose:()=>this.store.dispatch({type:"set_mode",mode:"pill"}),onCardTap:r=>this.cardTap(r),closed:e.closed}):this.panelHost.innerHTML="",B(this.pillHost,{mode:e.mode,callable:a,voiceState:e.voiceState,personaName:this.persona.name,personaInitial:this.persona.initial,personaAvatarUrl:this.persona.avatarUrl,onCall:()=>this.openCall(),onMute:r=>this.voiceMode.setMuted(r),onEnd:()=>{this.voiceMode.stop(),this.store.dispatch({type:"set_mode",mode:"pill"})},onChat:()=>this.store.dispatch({type:"set_mode",mode:"chat"}),onClose:()=>this.store.dispatch({type:"set_mode",mode:"pill"})})}openCall(){this.store.dispatch({type:"set_mode",mode:"call"}),this.voiceMode.start()}userText(e,a){this.store.dispatch({type:"user_input",text:e,mode:a});let r=this.store.get().sessionId;this.socket?.send(y({type:"user_text",sessionId:r,text:e,mode:a}))}handleLiveKitData(e){let a;try{a=new TextDecoder().decode(e)}catch{return}let r=M(a);r&&this.store.dispatch({type:"agent_event",event:r})}cardTap(e){let a=this.store.get().sessionId;this.socket?.send(y({type:"card_tap",sessionId:a,action:"cartAdd",sku:e.sku,variantId:e.variantId,qty:1}))}};function F(){customElements.get(W)||customElements.define(W,T)}function oe(){let t=document.currentScript instanceof HTMLScriptElement?document.currentScript:null,n=t?.dataset.id;if(!n){console.warn("[shoppingmate] data-id missing on script tag");return}if(document.querySelector("shoppingmate-widget"))return;F();let e=document.createElement("shoppingmate-widget");e.setAttribute("data-id",n);let a=t?.dataset.api;e.setAttribute("data-api",a??"https://api-production-1ea1.up.railway.app"),document.body?document.body.appendChild(e):document.addEventListener("DOMContentLoaded",()=>document.body.appendChild(e),{once:!0})}oe();})();
