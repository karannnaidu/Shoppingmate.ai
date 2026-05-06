"use strict";(()=>{var N=Object.defineProperty;var R=(t,n,e)=>n in t?N(t,n,{enumerable:!0,configurable:!0,writable:!0,value:e}):t[n]=e;var l=(t,n,e)=>R(t,typeof n!="symbol"?n+"":n,e);function p(){let t=globalThis,n=t.SpeechRecognition??t.webkitSpeechRecognition;if(!n)return null;let e=new n;e.continuous=!0,e.interimResults=!1,e.lang="en-US";let o=!1,i=[],a=[];return e.onresult=r=>{for(let c=0;c<r.results.length;c+=1){let g=r.results[c];if(g?.isFinal){let S=g[0]?.transcript?.trim();if(S)for(let P of i)P(S)}}},e.onerror=r=>{for(let c of a)c(String(r?.error??"unknown"))},e.onend=()=>{o=!1},{start:()=>{if(!o){o=!0;try{e.start()}catch{}}},stop:()=>{if(o){o=!1;try{e.stop()}catch{}}},onFinal:r=>{i.push(r)},onError:r=>{a.push(r)},isActive:()=>o}}function m(){let t=globalThis.speechSynthesis;if(!t)return{speak:async()=>{},cancel:()=>{},available:()=>!1};function n(){if(!t)return null;let e=t.getVoices();return e.find(o=>o.lang.startsWith("en-")&&o.default)??e.find(o=>o.lang.startsWith("en-"))??e[0]??null}return{speak:e=>new Promise(o=>{let i=new SpeechSynthesisUtterance(e),a=n();a&&(i.voice=a),i.rate=1,i.onend=()=>o(),i.onerror=()=>o(),t.speak(i)}),cancel:()=>t.cancel(),available:()=>!0}}function d(t,n){let e="idle",o=!1,i=[],a=r=>{if(e!==r){e=r;for(let c of i)c(r)}};return{start:()=>{if(e==="idle"){if(o){a("muted");return}t?.start(),a("listening")}},stop:()=>{t?.stop(),n.cancel(),a("idle")},speak:async r=>{e!=="idle"&&(t?.stop(),a("speaking"),await n.speak(r),o?a("muted"):(t?.start(),a("listening")))},setMuted:r=>{o=r,r?(t?.stop(),e==="listening"&&a("muted")):e==="muted"&&(t?.start(),a("listening"))},getState:()=>e,onStateChange:r=>{i.push(r)}}}var U="https://cdn.shoppingmate.ai/vendor",B="2.7.0";async function W(){return typeof globalThis.__SHOPPINGMATE_LIVEKIT_LOADER__=="function"?await globalThis.__SHOPPINGMATE_LIVEKIT_LOADER__():await import(`${U}/livekit-client@${B}/dist/livekit-client.esm.min.js`)}async function w(t){let n=await W(),e=new n.Room;return await e.connect(t.wsUrl,t.token),{setMicEnabled:o=>e.localParticipant.setMicrophoneEnabled(o),onData:o=>{e.on("dataReceived",i=>{i instanceof Uint8Array&&o(i)})},disconnect:()=>e.disconnect()}}function T(t){let n="idle",e=null,o=!1,i=[],a=r=>{if(n!==r){n=r;for(let c of i)c(r)}};return{start:()=>{n==="idle"&&(async()=>{try{e=await w({wsUrl:t.wsUrl,token:t.token,roomName:t.roomName}),e.onData(r=>t.onTranscriptEvent(r)),await e.setMicEnabled(!o),a(o?"muted":"listening")}catch(r){throw a("idle"),r}})().catch(r=>{console.warn("[voiceModeLiveKit] connect failed",r)})},stop:()=>{e?.disconnect().catch(()=>{}),e=null,a("idle")},speak:async()=>{},setMuted:r=>{o=r,e?.setMicEnabled(!r).catch(()=>{}),r?a("muted"):n==="muted"&&a("listening")},getState:()=>n,onStateChange:r=>{i.push(r)}}}function f(t){return t.stack==="web-speech"?d(p(),m()):t.stack==="live-kit"?t.livekit?T(t.livekit):(console.warn("[voiceModeFactory] live-kit stack requires livekit opts; returning null \u2192 caller falls back to chat"),null):null}async function _(t){try{let n=await fetch(`${t.apiBase}/v1/install`,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({merchantId:t.merchantId,domain:t.domain,userAgent:navigator.userAgent,referrer:document.referrer||null})});if(!n.ok)return{kind:"err",reason:`install_${n.status}`};let e=await n.json(),o=await fetch(`${t.apiBase}/v1/session`,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({merchantId:t.merchantId,domain:t.domain})});if(!o.ok)return{kind:"err",reason:`session_${o.status}`};let i=await o.json(),a=null;try{let r=await fetch(`${t.apiBase}/v1/voice/token`,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({sessionId:i.sessionId,merchantId:t.merchantId})});r.ok?a=await r.json():console.warn("[shoppingmate] voice unavailable \u2014 status",r.status)}catch(r){console.warn("[shoppingmate] voice unavailable \u2014",r)}return{kind:"ok",sessionId:i.sessionId,wsUrl:i.wsUrl,merchantStatus:e.status,voice:a}}catch(n){return{kind:"err",reason:n instanceof Error?n.message:"network"}}}var M=0,u=()=>(M+=1,`t${M}`);function O(t,n){switch(n.type){case"set_mode":return{...t,mode:n.mode};case"set_voice_state":return{...t,voiceState:n.state};case"set_connection":return{...t,connection:n.status};case"reset":return{...t,transcript:[],thinking:!1,closed:!1,closedReason:null,checkoutUrl:null,capWarning:null};case"user_input":return{...t,transcript:[...t.transcript,{id:u(),role:"user",kind:"text",text:n.text,ts:Date.now()}]};case"agent_event":{let e=n.event;switch(e.type){case"thinking":return{...t,thinking:!0};case"end_of_turn":return{...t,thinking:!1};case"say":return{...t,thinking:!1,transcript:[...t.transcript,{id:u(),role:"agent",kind:"text",text:e.text,ts:Date.now()}]};case"cards":return{...t,transcript:[...t.transcript,{id:u(),role:"agent",kind:"cards",items:e.items,ts:Date.now()}]};case"tool_result":return t;case"checkout_redirect":return{...t,checkoutUrl:e.url};case"cap_warning":return{...t,capWarning:{reason:e.reason,remaining:e.remaining},transcript:[...t.transcript,{id:u(),role:"system",kind:"cap_warning",remaining:e.remaining,ts:Date.now()}]};case"session_closed":return{...t,closed:!0,closedReason:e.reason,transcript:[...t.transcript,{id:u(),role:"system",kind:"closed",reason:e.reason,ts:Date.now()}]};default:return t}}default:return t}}function x(t){let n={sessionId:t.sessionId,mode:"pill",voiceState:"idle",transcript:[],thinking:!1,closed:!1,closedReason:null,checkoutUrl:null,capWarning:null,connection:"connecting"},e=[];return{get:()=>n,dispatch:o=>{n=O(n,o);for(let i of e)i(n)},subscribe:o=>(e.push(o),()=>{let i=e.indexOf(o);i>=0&&e.splice(i,1)})}}var I=`
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
`;function h(t){return JSON.stringify(t)}function y(t){let n;try{n=JSON.parse(t)}catch{return null}if(!n||typeof n!="object")return null;let e=n;switch(e.type){case"thinking":return{type:"thinking"};case"say":return typeof e.text=="string"?{type:"say",text:e.text}:null;case"cards":return Array.isArray(e.items)?{type:"cards",items:e.items}:null;case"tool_result":return typeof e.toolName!="string"||typeof e.ok!="boolean"?null:{type:"tool_result",toolName:e.toolName,ok:e.ok,summary:typeof e.summary=="string"?e.summary:void 0};case"checkout_redirect":return typeof e.url=="string"?{type:"checkout_redirect",url:e.url}:null;case"cap_warning":return e.reason!=="turns"&&e.reason!=="voice_ms"&&e.reason!=="duration_ms"||typeof e.remaining!="number"?null:{type:"cap_warning",reason:e.reason,remaining:e.remaining};case"end_of_turn":return{type:"end_of_turn"};case"session_closed":return e.reason!=="user"&&e.reason!=="cap"&&e.reason!=="error"?null:{type:"session_closed",reason:e.reason};default:return null}}var C=[1e3,2e3,4e3,8e3,16e3],D=5;function E(t,n){let e=null,o=0,i=!1,a=[];function r(){i||(n.onStatus(o>0?"reconnecting":"connecting"),e=new WebSocket(t),e.onopen=()=>{n.onStatus("connected"),o>0&&e?.send(JSON.stringify({type:"session_resume",sessionId:n.sessionId})),o=0;for(let c of a)e?.send(c);a=[]},e.onmessage=c=>n.onEvent(typeof c.data=="string"?c.data:""),e.onerror=()=>{},e.onclose=()=>{if(i)return;if(o+=1,o>=D){n.onStatus("disconnected");return}let c=Math.min(o-1,C.length-1),g=C[c]??3e4;n.onStatus("reconnecting"),setTimeout(r,g)})}return r(),{send:c=>{e&&e.readyState===1?e.send(c):a.push(c)},close:()=>{i=!0,e?.close()}}}var s={pillCallable:"Talk to Sage",pillTextOnly:"Chat with Sage",pillCollapsed:"Sage",callBtn:"CALL",callBtnEnd:"END",chatBtnAria:"Open text chat",callBtnAria:"Start voice call",endCallAria:"End call",closeAria:"Close",callHeaderSpeaking:"speaking",callHeaderListening:"listening",chatHeaderSubtitle:"text fallback \xB7 voice preferred",chatPlaceholder:"Type a quick question\u2026",chatGreeting:"Hi, I'm Sage. What are you shopping for today?",reconnecting:"Reconnecting\u2026",disconnected:"Connection lost \u2014 reload to retry",closed:{user:"Conversation ended",cap:"Time to wrap up \u2014 reload for a new chat",error:"Something went wrong"},payNow:"Pay now \u2192",capWarning:"A couple minutes left",thinking:"Sage is thinking\u2026",micDenied:"Mic blocked \u2014 switching to text"};function v(t){return t.replace(/[&<>"']/g,n=>n==="&"?"&amp;":n==="<"?"&lt;":n===">"?"&gt;":n==='"'?"&quot;":"&#39;")}function j(t,n){let e=document.createElement("button");return e.className="card",e.type="button",e.dataset.sku=t.sku,e.innerHTML=`
    ${t.image?`<img src="${v(t.image)}" alt="${v(t.title)}" />`:'<div class="card-img-fallback"></div>'}
    <div class="title">${v(t.title)}</div>
    <div class="price">${v(t.priceFormatted)}</div>
  `,e.addEventListener("click",()=>n({sku:t.sku,variantId:t.variantId})),e}function b(t,n,e){t.innerHTML="";for(let o of n)if(o.kind==="text"){let i=document.createElement("div");i.className=`bubble ${o.role}`,i.textContent=o.text,t.appendChild(i)}else if(o.kind==="cards"){let i=document.createElement("div");i.className="cards-row";for(let a of o.items)i.appendChild(j(a,e));t.appendChild(i)}else if(o.kind==="cap_warning"){let i=document.createElement("div");i.className="bubble system",i.textContent=s.capWarning,t.appendChild(i)}else if(o.kind==="closed"){let i=document.createElement("div");i.className="bubble system",i.textContent=s.closed[o.reason],t.appendChild(i)}t.scrollTop=t.scrollHeight}function A(t,n){let e=n.voiceState==="speaking",o=n.muted?"you're muted":e?`Sage is ${s.callHeaderSpeaking}\u2026`:`${s.callHeaderListening} to you\u2026`;t.innerHTML=`
    <div class="panel">
      <div class="panel-header">
        <div class="who">
          <div class="avatar" aria-hidden="true">S</div>
          <div>
            <div class="name">Sage</div>
            <div class="sub">on call \xB7 ${e?s.callHeaderSpeaking:s.callHeaderListening}</div>
          </div>
        </div>
      </div>
      <div class="waveform ${e&&!n.muted?"active":""}">
        ${Array.from({length:28}).map(()=>'<span class="bar"></span>').join("")}
      </div>
      <div class="status-line">${o}</div>
      <div class="transcript" data-region="transcript" aria-live="polite"></div>
      ${n.checkoutUrl?`<a class="checkout-cta" data-action="checkout" href="${n.checkoutUrl}" target="_blank" rel="noopener">${s.payNow}</a>`:""}
      <div class="controls">
        <button class="ctrl ${n.muted?"muted":""}" data-action="mute" aria-pressed="${n.muted}" aria-label="${n.muted?"Unmute":"Mute"}">${n.muted?"\u{1F507}":"\u{1F3A4}"}</button>
        <button class="ctrl end" data-action="end" aria-label="${s.endCallAria}">\u{1F4F5}</button>
        <button class="ctrl" data-action="chat" aria-label="${s.chatBtnAria}">\u{1F4AC}</button>
      </div>
    </div>
  `;let i=t.querySelector('[data-region="transcript"]');i instanceof HTMLElement&&b(i,n.transcript,n.onCardTap),t.querySelector('[data-action="mute"]')?.addEventListener("click",()=>n.onMute(!n.muted)),t.querySelector('[data-action="end"]')?.addEventListener("click",n.onEnd),t.querySelector('[data-action="chat"]')?.addEventListener("click",n.onChat),t.querySelector('[data-action="checkout"]')?.addEventListener("click",n.onCheckout)}function L(t,n){t.innerHTML=`
    <div class="panel">
      <div class="panel-header">
        <div class="who">
          <div class="avatar" aria-hidden="true">S</div>
          <div>
            <div class="name">Sage</div>
            <div class="sub">${s.chatHeaderSubtitle}</div>
          </div>
        </div>
        <button class="btn" data-action="call" aria-label="${s.callBtnAria}">${s.callBtn}</button>
      </div>
      <div class="transcript" data-region="transcript" aria-live="polite"></div>
      ${n.checkoutUrl?`<a class="checkout-cta" href="${n.checkoutUrl}" target="_blank" rel="noopener">${s.payNow}</a>`:""}
      <form class="input-row">
        <input type="text" placeholder="${s.chatPlaceholder}" ${n.closed?"disabled":""} />
        <button class="send" type="submit" aria-label="Send" ${n.closed?"disabled":""}>\u21B5</button>
      </form>
    </div>
  `;let e=t.querySelector('[data-region="transcript"]');e instanceof HTMLElement&&b(e,n.transcript,n.onCardTap),t.querySelector('[data-action="call"]')?.addEventListener("click",n.onCall);let o=t.querySelector("form"),i=t.querySelector("input");o instanceof HTMLFormElement&&i instanceof HTMLInputElement&&o.addEventListener("submit",a=>{a.preventDefault();let r=i.value.trim();r&&(i.value="",n.onSend(r))})}function H(t,n){let e=n.mode!=="pill",o=n.mode==="call",i=n.mode==="chat",a=e?"Sage":n.callable?s.pillCallable:s.pillTextOnly;t.innerHTML=`
    <div class="pill" role="region" aria-label="Sage shopping assistant">
      <button class="avatar" data-action="toggle" aria-label="${e?s.closeAria:s.pillCollapsed}">S</button>
      <div class="label">
        <span class="label-main">${a}</span>
        <span class="label-sub">AI Assistant</span>
      </div>
      ${e?`
        <div class="actions">
          ${n.callable?`<button class="btn ${o?"btn-end":""}" data-action="call" aria-label="${o?s.endCallAria:s.callBtnAria}">${o?s.callBtnEnd:s.callBtn}</button>`:""}
          <button class="btn btn-icon" data-action="chat" aria-pressed="${i}" aria-label="${s.chatBtnAria}">\u{1F4AC}</button>
          <button class="btn btn-icon" data-action="close" aria-label="${s.closeAria}">\xD7</button>
        </div>
      `:""}
    </div>
  `,t.querySelector('[data-action="toggle"]')?.addEventListener("click",()=>{n.mode==="pill"?n.onChat():n.onClose()}),t.querySelector('[data-action="call"]')?.addEventListener("click",n.onCall),t.querySelector('[data-action="chat"]')?.addEventListener("click",n.onChat),t.querySelector('[data-action="close"]')?.addEventListener("click",n.onClose)}var V="shoppingmate-widget";function q(){return"live-kit"==="web-speech"?"web-speech":"live-kit"}var k=class extends HTMLElement{constructor(){super(...arguments);l(this,"rootEl",null);l(this,"pillHost",null);l(this,"panelHost",null);l(this,"store",x({sessionId:"pending"}));l(this,"socket",null);l(this,"voiceMode",d(null,m()));l(this,"voice",null);l(this,"apiBase","");l(this,"merchantId","");l(this,"domain",window.location.host)}connectedCallback(){if(this.shadowRoot)return;let e=this.getAttribute("data-id"),o=this.getAttribute("data-api")??this.apiBase;if(!e){console.warn("[shoppingmate] data-id missing on widget element");return}this.merchantId=e,this.apiBase=o;let i=this.attachShadow({mode:"open"}),a=document.createElement("style");a.textContent=I,i.appendChild(a);let r=document.createElement("div");r.className="root",i.appendChild(r),this.rootEl=r,this.panelHost=document.createElement("div"),this.pillHost=document.createElement("div"),r.appendChild(this.panelHost),r.appendChild(this.pillHost),this.store.subscribe(()=>this.render()),this.render(),this.start()}disconnectedCallback(){this.socket?.close(),this.voiceMode.stop()}async start(){let e=await _({apiBase:this.apiBase,merchantId:this.merchantId,domain:this.domain});if(e.kind==="err"){console.warn("[shoppingmate] bootstrap failed:",e.reason);return}this.store=x({sessionId:e.sessionId}),this.store.subscribe(()=>this.render()),this.voice=e.voice;let o=q(),i=p();if(o==="live-kit"&&this.voice){let a=f({stack:"live-kit",livekit:{wsUrl:this.voice.wsUrl,token:this.voice.token,roomName:this.voice.roomName,onTranscriptEvent:r=>this.handleLiveKitData(r)}});a&&(this.voiceMode=a)}else{let a=f({stack:"web-speech"});a&&(this.voiceMode=a),i?.onFinal(r=>{this.store.dispatch({type:"user_input",text:r,mode:"voice"}),this.socket?.send(h({type:"user_text",sessionId:e.sessionId,text:r,mode:"voice"}))})}this.voiceMode.onStateChange(a=>this.store.dispatch({type:"set_voice_state",state:a})),this.socket=E(e.wsUrl,{sessionId:e.sessionId,onEvent:a=>{let r=y(a);r&&(this.store.dispatch({type:"agent_event",event:r}),r.type==="say"&&this.voiceMode.speak(r.text))},onStatus:a=>this.store.dispatch({type:"set_connection",status:a})})}render(){if(!this.pillHost||!this.panelHost)return;let e=this.store.get(),o=p()!==null;e.mode==="call"?A(this.panelHost,{voiceState:e.voiceState,muted:e.voiceState==="muted",transcript:e.transcript,checkoutUrl:e.checkoutUrl,onMute:i=>this.voiceMode.setMuted(i),onEnd:()=>{this.voiceMode.stop(),this.store.dispatch({type:"set_mode",mode:"expanded"})},onChat:()=>this.store.dispatch({type:"set_mode",mode:"chat"}),onCardTap:i=>this.cardTap(i),onCheckout:()=>{}}):e.mode==="chat"?L(this.panelHost,{transcript:e.transcript,checkoutUrl:e.checkoutUrl,onSend:i=>this.userText(i,"text"),onCall:()=>this.openCall(),onCardTap:i=>this.cardTap(i),closed:e.closed}):this.panelHost.innerHTML="",H(this.pillHost,{mode:e.mode,callable:o,onCall:()=>this.openCall(),onChat:()=>this.store.dispatch({type:"set_mode",mode:"chat"}),onClose:()=>this.store.dispatch({type:"set_mode",mode:"pill"})})}openCall(){this.store.dispatch({type:"set_mode",mode:"call"}),this.voiceMode.start()}userText(e,o){this.store.dispatch({type:"user_input",text:e,mode:o});let i=this.store.get().sessionId;this.socket?.send(h({type:"user_text",sessionId:i,text:e,mode:o}))}handleLiveKitData(e){let o;try{o=new TextDecoder().decode(e)}catch{return}let i=y(o);i&&this.store.dispatch({type:"agent_event",event:i})}cardTap(e){let o=this.store.get().sessionId;this.socket?.send(h({type:"card_tap",sessionId:o,action:"cartAdd",sku:e.sku,variantId:e.variantId,qty:1}))}};function $(){customElements.get(V)||customElements.define(V,k)}function F(){let t=document.currentScript instanceof HTMLScriptElement?document.currentScript:null,n=t?.dataset.id;if(!n){console.warn("[shoppingmate] data-id missing on script tag");return}if(document.querySelector("shoppingmate-widget"))return;$();let e=document.createElement("shoppingmate-widget");e.setAttribute("data-id",n);let o=t?.dataset.api;e.setAttribute("data-api",o??"https://api.shoppingmate.ai"),document.body?document.body.appendChild(e):document.addEventListener("DOMContentLoaded",()=>document.body.appendChild(e),{once:!0})}F();})();
