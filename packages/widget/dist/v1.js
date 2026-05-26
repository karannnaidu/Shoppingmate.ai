"use strict";(()=>{var ve=Object.defineProperty;var xe=(e,n,t)=>n in e?ve(e,n,{enumerable:!0,configurable:!0,writable:!0,value:t}):e[n]=t;var u=(e,n,t)=>xe(e,typeof n!="symbol"?n+"":n,t);function x(){let e=globalThis,n=e.SpeechRecognition??e.webkitSpeechRecognition;if(!n)return null;let t=new n;t.continuous=!0,t.interimResults=!1,t.lang="en-US";let o=!1,r=[],a=[];return t.onresult=i=>{for(let s=0;s<i.results.length;s+=1){let l=i.results[s];if(l?.isFinal){let c=l[0]?.transcript?.trim();if(c)for(let p of r)p(c)}}},t.onerror=i=>{for(let s of a)s(String(i?.error??"unknown"))},t.onend=()=>{o=!1},{start:()=>{if(!o){o=!0;try{t.start()}catch{}}},stop:()=>{if(o){o=!1;try{t.stop()}catch{}}},onFinal:i=>{r.push(i)},onError:i=>{a.push(i)},isActive:()=>o}}function w(){let e=globalThis.speechSynthesis;if(!e)return{speak:async()=>{},cancel:()=>{},available:()=>!1};function n(){if(!e)return null;let t=e.getVoices();return t.find(o=>o.lang.startsWith("en-")&&o.default)??t.find(o=>o.lang.startsWith("en-"))??t[0]??null}return{speak:t=>new Promise(o=>{let r=new SpeechSynthesisUtterance(t),a=n();a&&(r.voice=a),r.rate=1,r.onend=()=>o(),r.onerror=()=>o(),e.speak(r)}),cancel:()=>e.cancel(),available:()=>!0}}function b(e,n){let t="idle",o=!1,r=[],a=i=>{if(t!==i){t=i;for(let s of r)s(i)}};return{start:()=>{if(t==="idle"){if(o){a("muted");return}e?.start(),a("listening")}},stop:()=>{e?.stop(),n.cancel(),a("idle")},speak:async i=>{t!=="idle"&&(e?.stop(),a("speaking"),await n.speak(i),o?a("muted"):(e?.start(),a("listening")))},setMuted:i=>{o=i,i?(e?.stop(),t==="listening"&&a("muted")):t==="muted"&&(e?.start(),a("listening"))},getState:()=>t,onStateChange:i=>{r.push(i)}}}function ke(e){if(!e||typeof e.type!="string")return!1;switch(e.type){case"navigate":return typeof e.path=="string";case"scroll_to":case"highlight":case"click":case"point_at":case"demo_click":return typeof e.intent=="string";default:return!1}}function g(e){return JSON.stringify(e)}function L(e){let n;try{n=JSON.parse(e)}catch{return null}if(!n||typeof n!="object")return null;let t=n;switch(t.type){case"thinking":return{type:"thinking"};case"say":return typeof t.text=="string"?{type:"say",text:t.text}:null;case"say_partial":return typeof t.text=="string"?{type:"say_partial",text:t.text}:null;case"user_text":return typeof t.text=="string"?{type:"user_text",text:t.text}:null;case"cards":return Array.isArray(t.items)?{type:"cards",items:t.items}:null;case"tool_result":return typeof t.toolName!="string"||typeof t.ok!="boolean"?null:{type:"tool_result",toolName:t.toolName,ok:t.ok,summary:typeof t.summary=="string"?t.summary:void 0};case"checkout_redirect":return typeof t.url=="string"?{type:"checkout_redirect",url:t.url}:null;case"cap_warning":return t.reason!=="turns"&&t.reason!=="voice_ms"&&t.reason!=="duration_ms"||typeof t.remaining!="number"?null:{type:"cap_warning",reason:t.reason,remaining:t.remaining};case"end_of_turn":return{type:"end_of_turn"};case"session_closed":return t.reason!=="user"&&t.reason!=="cap"&&t.reason!=="error"?null:{type:"session_closed",reason:t.reason};case"host_action_request":{if(typeof t.callId!="string"||!t.action)return null;let o=t.action;return ke(o)?{type:"host_action_request",callId:t.callId,action:o}:null}case"persona_swap":return typeof t.personaId=="string"?{type:"persona_swap",personaId:t.personaId}:null;case"agent_warmed":return{type:"agent_warmed"};case"agent_ready":return{type:"agent_ready"};default:return null}}var we="https://cdn.jsdelivr.net/npm",Se="2.7.0",f=null;function O(){return f||(typeof globalThis.__SHOPPINGMATE_LIVEKIT_LOADER__=="function"?(f=globalThis.__SHOPPINGMATE_LIVEKIT_LOADER__(),f):(f=import(`${we}/livekit-client@${Se}/dist/livekit-client.esm.mjs`),f))}function U(){O().catch(()=>{f=null})}async function V(e){let n=await O(),t=new n.Room,o=new Map;t.on("trackSubscribed",a=>{let i=a;if(i.kind!=="audio")return;let s=i.attach();s.style.display="none",document.body.appendChild(s),o.set(a,s)}),t.on("trackUnsubscribed",a=>{let i=o.get(a);i&&(i.remove(),o.delete(a)),a.detach?.()});let r=[];return t.on("activeSpeakersChanged",a=>{let s=(a??[]).some(l=>!l.isLocal);for(let l of r)l(s)}),await t.connect(e.wsUrl,e.token),{setMicEnabled:a=>t.localParticipant.setMicrophoneEnabled(a),onData:a=>{t.on("dataReceived",i=>{i instanceof Uint8Array&&a(i)})},onAgentSpeaking:a=>{r.push(a)},publishData:a=>t.localParticipant.publishData(a,{reliable:!0}),disconnect:async()=>{for(let a of o.values())a.remove();o.clear(),await t.disconnect()}}}function W(e){let n="idle",t=null,o=null,r=!1,a=!1,i=[],s=c=>{if(n!==c){n=c;for(let p of i)p(c)}},l=()=>t?Promise.resolve(t):o||(o=(async()=>{let c=await V({wsUrl:e.wsUrl,token:e.token,roomName:e.roomName});return c.onData(p=>e.onTranscriptEvent(p)),c.onAgentSpeaking(p=>{r||(p&&(a=!0),a&&s(p?"speaking":"listening"))}),t=c,c})(),o.catch(()=>{o=null}),o);return{warm:()=>{l().catch(c=>console.warn("[voiceModeLiveKit] warm failed",c))},start:()=>{n==="idle"&&(s("connecting"),a=!1,(async()=>{try{let c=await l();await c.setMicEnabled(!r);let p=new TextEncoder().encode(g({type:"start_voice",sessionId:e.sessionId}));await c.publishData(p),r&&s("muted")}catch(c){throw s("idle"),c}})().catch(c=>{console.warn("[voiceModeLiveKit] start failed",c)}))},stop:()=>{t?.disconnect().catch(()=>{}),t=null,o=null,s("idle")},speak:async()=>{},setMuted:c=>{r=c,t?.setMicEnabled(!c).catch(()=>{}),c?s("muted"):n==="muted"&&s("listening")},getState:()=>n,onStateChange:c=>{i.push(c)},signalAgentReady:()=>{a=!0,n==="connecting"&&s(r?"muted":"listening")},publishData:async c=>{t&&await t.publishData(c)}}}function S(e){return e.stack==="web-speech"?b(x(),w()):e.stack==="live-kit"?e.livekit?W(e.livekit):(console.warn("[voiceModeFactory] live-kit stack requires livekit opts; returning null \u2192 caller falls back to chat"),null):null}async function B(e){try{let n=await fetch(`${e.apiBase}/v1/install`,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({merchantId:e.merchantId,domain:e.domain,userAgent:navigator.userAgent,referrer:document.referrer||null})});if(!n.ok)return{kind:"err",reason:`install_${n.status}`};let t=await n.json(),o=await fetch(`${e.apiBase}/v1/session`,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({merchantId:e.merchantId,domain:e.domain})});if(!o.ok)return{kind:"err",reason:`session_${o.status}`};let r=await o.json(),a=null;try{let i=await fetch(`${e.apiBase}/v1/voice/token`,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({sessionId:r.sessionId,merchantId:e.merchantId})});i.ok?a=await i.json():console.warn("[shoppingmate] voice unavailable \u2014 status",i.status)}catch(i){console.warn("[shoppingmate] voice unavailable \u2014",i)}return{kind:"ok",sessionId:r.sessionId,wsUrl:r.wsUrl,merchantStatus:t.status,personaId:t.personaId??a?.personaId??null,voice:a}}catch(n){return{kind:"err",reason:n instanceof Error?n.message:"network"}}}function z(e){let n=0,t=i=>{let s=Date.now();s-n<200||(n=s,e.send(i))},o=i=>{let s=i.target;if(!s)return;let l=_e(s),c=l?Me(l,e.hints):null;t({type:"visitor_action",sessionId:e.sessionId,action:"click",intentKey:c,url:window.location.href,elementLabel:l,timestamp:Date.now()})},r=()=>{t({type:"visitor_action",sessionId:e.sessionId,action:"route_change",intentKey:null,url:window.location.href,elementLabel:null,timestamp:Date.now()})},a=i=>{let s=i.target;if(!s)return;let l=s.tagName?.toLowerCase();l!=="input"&&l!=="textarea"&&l!=="select"||s.type==="password"||t({type:"visitor_action",sessionId:e.sessionId,action:"form_focus",intentKey:null,url:window.location.href,elementLabel:s.name||s.id||null,timestamp:Date.now()})};return document.addEventListener("click",o,{passive:!0,capture:!0}),window.addEventListener("popstate",r),document.addEventListener("focusin",a,{passive:!0}),()=>{document.removeEventListener("click",o,!0),window.removeEventListener("popstate",r),document.removeEventListener("focusin",a)}}function _e(e){return e.getAttribute("aria-label")??e.getAttribute("title")??(e.textContent??"").trim().slice(0,80)??null}function Me(e,n){let t=e.toLowerCase();if(n.has(t))return t;for(let o of n.keys())if(t.includes(o)||o.includes(t))return o;return null}var Te=new Set(["the","a","an","to","of","on","in","and","or","section","button","link","card","tile","now"]),Ee=[{keyword:"button",matchTag:/^(button)$/i,matchRole:"button"},{keyword:"link",matchTag:/^(a)$/i,matchRole:"link"},{keyword:"card",matchTag:/^(article|div|section)$/i},{keyword:"section",matchTag:/^(section|main|article)$/i}],Ce=.4;function _(e,n){if(n){let a=n.get(e.toLowerCase().trim());if(a)try{let i=document.querySelector(a);if(i instanceof HTMLElement&&K(i))return i}catch{}}let t=H(e);if(t.size===0)return null;let o=Ie(document.body),r=null;for(let a of o){if(!a.visible)continue;let i=Le(a,e,t);i<Ce||(!r||i>r.score)&&(r={c:a,score:i})}return r?.c.element??null}function H(e){return new Set(e.toLowerCase().replace(/[^a-z0-9 ]/g," ").split(/\s+/).filter(n=>n.length>0&&!Te.has(n)))}function Ie(e){let n=[],t=document.createTreeWalker(e,NodeFilter.SHOW_ELEMENT),o=t.nextNode();for(;o;){if(o instanceof HTMLElement){let r=Ae(o);r&&n.push({element:o,role:o.getAttribute("role")??o.tagName.toLowerCase(),name:r,visible:K(o)})}o=t.nextNode()}return n}function Ae(e){let n=e.getAttribute("aria-labelledby");if(n){let a=n.split(/\s+/).map(i=>document.getElementById(i)?.textContent?.trim()??"").filter(Boolean);if(a.length>0)return a.join(" ")}let t=e.getAttribute("aria-label");if(t)return t.trim();if(e.id){let a=document.querySelector(`label[for="${He(e.id)}"]`);if(a?.textContent)return a.textContent.trim()}let o=e.getAttribute("alt")??e.getAttribute("title");if(o)return o.trim();let r=(e.textContent??"").trim();return r&&r.length<200?r:""}function K(e){if(!e.isConnected)return!1;let n=e.ownerDocument.defaultView?.getComputedStyle(e);return n?!(n.display==="none"||n.visibility==="hidden"||n.opacity==="0"):!0}function Le(e,n,t){let o=H(e.name);if(o.size===0)return 0;let r=0;for(let m of t)o.has(m)&&r++;let a=new Set([...t,...o]).size,i=a===0?0:r/a,s=0,l=n.toLowerCase();for(let m of Ee)if(l.includes(m.keyword)&&(m.matchTag.test(e.element.tagName)||e.role===m.matchRole)){s=.15;break}let c=e.element.getAttribute("data-tour-stop"),p=0;if(c){let m=H(c.replace(/-/g," ")),v=0;for(let A of t)m.has(A)&&v++;v>0&&(p=.5*(v/t.size))}return Math.min(1,i+s+p)}function He(e){return e.replace(/(["\\])/g,"\\$1")}var Ne="data-shoppingmate-bot-cursor",j="data-shoppingmate-cursor-keyframes",k=null,N=window.innerWidth-80,P=window.innerHeight-80;function F(){if(k&&k.isConnected)return k;Pe();let e=document.createElement("div");return e.setAttribute(Ne,""),e.innerHTML=`
    <svg width="22" height="22" viewBox="0 0 22 22" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path d="M3 2 L3 17 L7 13 L9.5 19 L12 18 L9.5 12 L15 12 Z"
            fill="#111827" stroke="#fff" stroke-width="1.2" stroke-linejoin="round"/>
    </svg>
  `,Object.assign(e.style,{position:"fixed",left:"0",top:"0",transform:`translate(${N}px, ${P}px)`,transition:"transform 480ms cubic-bezier(0.22, 1, 0.36, 1), opacity 200ms",pointerEvents:"none",zIndex:"2147483647",opacity:"0",willChange:"transform, opacity",filter:"drop-shadow(0 2px 6px rgba(0,0,0,0.25))"}),document.body.appendChild(e),k=e,e}function Pe(){if(document.head.querySelector(`style[${j}]`))return;let e=document.createElement("style");e.setAttribute(j,""),e.textContent=`
    @keyframes shoppingmate-cursor-click {
      0%   { transform: var(--sm-cursor-pos) scale(1); }
      40%  { transform: var(--sm-cursor-pos) scale(0.72); }
      100% { transform: var(--sm-cursor-pos) scale(1); }
    }
  `,document.head.appendChild(e)}function Re(e){let n=e.getBoundingClientRect();return{x:n.left+n.width/2-6,y:n.top+n.height/2-6}}function M(e,n=480){let t=F(),{x:o,y:r}=Re(e);return t.style.transitionDuration=`${n}ms, 200ms`,t.style.opacity="1",t.style.transform=`translate(${o}px, ${r}px)`,N=o,P=r,new Promise(a=>setTimeout(a,n))}function R(){let e=F();return e.style.setProperty("--sm-cursor-pos",`translate(${N}px, ${P}px)`),e.style.animation="shoppingmate-cursor-click 280ms ease-out",new Promise(n=>{let t=()=>{e.style.animation="",e.removeEventListener("animationend",t),n()};e.addEventListener("animationend",t),setTimeout(t,360)})}function T(e=600){let n=k;n&&setTimeout(()=>{n.style.opacity="0"},e)}var $e="data-shoppingmate-pulse-ring";function G(e,n){let t=e.getBoundingClientRect(),o=document.createElement("div");o.setAttribute($e,""),Object.assign(o.style,{position:"fixed",left:`${t.left-6}px`,top:`${t.top-6}px`,width:`${t.width+12}px`,height:`${t.height+12}px`,borderRadius:"14px",boxShadow:"0 0 0 3px rgba(139,92,246,0.85), 0 0 24px rgba(139,92,246,0.55)",pointerEvents:"none",zIndex:"2147483646",animation:"shoppingmate-pulse 1.2s ease-in-out infinite"}),De(),document.body.appendChild(o);let r=!1,a=()=>{r||(r=!0,o.remove())};return setTimeout(a,n),a}var q=!1;function De(){if(q)return;q=!0;let e=document.createElement("style");e.textContent=`@keyframes shoppingmate-pulse {
    0%, 100% { transform: scale(1); opacity: 1; }
    50% { transform: scale(1.04); opacity: 0.85; }
  }`,document.head.appendChild(e)}async function Y(e){switch(e.type){case"navigate":return Ue(e.path);case"scroll_to":return We(e.intent);case"highlight":return Be(e.intent,e.durationMs??2e3);case"click":return ze(e.intent)}}function Oe(e){let n=window.__shoppingmateNavigate__;if(typeof n=="function")try{return n(e),!0}catch{return!1}return!1}async function Ue(e){try{let n=new URL(e,window.location.href);if(n.origin!==window.location.origin)return{ok:!1,reason:"cross_origin"};let t=Ve(n.pathname);t&&(await M(t,520),await R());let o=n.pathname+n.search+n.hash;return Oe(o)||window.location.assign(o),T(800),{ok:!0}}catch{return{ok:!1,reason:"route_not_found"}}}function Ve(e){let n=document.querySelectorAll("a[href]");for(let t of n)try{if(new URL(t.href,window.location.href).pathname===e)return t}catch{}return null}async function We(e){let n=_(e);return n?(await M(n,480),n.scrollIntoView({behavior:"smooth",block:"center"}),T(800),{ok:!0}):{ok:!1,reason:"not_found"}}function Be(e,n){let t=_(e);return t?(G(t,n),{ok:!0}):{ok:!1,reason:"not_found"}}async function ze(e){let n=_(e);return n?n.isConnected?(await M(n,420),await R(),n.isConnected?(n.click(),T(800),{ok:!0}):{ok:!1,reason:"stale_target"}):{ok:!1,reason:"stale_target"}:{ok:!1,reason:"not_found"}}var J={"calm-clinician":"Sage",stylist:"Lumi",coach:"Kai",concierge:"Olivia",curator:"Theo",guide:"Maya",expert:"Arjun",host:"Ana"};function Ke(){let e="https://shoppingmate-web.vercel.app/widget/personas";return e&&typeof e=="string"?e.replace(/\/$/,""):"https://cdn.shoppingmate.ai/v1/personas"}var X={id:"pending",name:"Assistant",initial:"A",avatarUrl:""};function Z(){return X}function Q(e){if(!e||!J[e])return X;let n=J[e];return{id:e,name:n,initial:n.charAt(0).toUpperCase(),avatarUrl:`${Ke()}/${e}.png`}}var ee=0,h=()=>(ee+=1,`t${ee}`);function je(e,n){switch(n.type){case"set_mode":return{...e,mode:n.mode};case"set_voice_state":return{...e,voiceState:n.state};case"set_connection":return{...e,connection:n.status};case"reset":return{...e,transcript:[],thinking:!1,closed:!1,closedReason:null,checkoutUrl:null,capWarning:null};case"user_input":return{...e,transcript:[...e.transcript,{id:h(),role:"user",kind:"text",text:n.text,ts:Date.now()}]};case"agent_event":{let t=n.event;switch(t.type){case"thinking":return{...e,thinking:!0};case"end_of_turn":return{...e,thinking:!1};case"say":{let o=e.transcript[e.transcript.length-1];return o&&o.role==="agent"&&o.kind==="text"&&o.partial?{...e,thinking:!1,transcript:[...e.transcript.slice(0,-1),{...o,text:t.text,partial:!1,ts:Date.now()}]}:{...e,thinking:!1,transcript:[...e.transcript,{id:h(),role:"agent",kind:"text",text:t.text,ts:Date.now()}]}}case"say_partial":{let o=e.transcript[e.transcript.length-1];return o&&o.role==="agent"&&o.kind==="text"&&o.partial?{...e,thinking:!1,transcript:[...e.transcript.slice(0,-1),{...o,text:t.text,ts:Date.now()}]}:{...e,thinking:!1,transcript:[...e.transcript,{id:h(),role:"agent",kind:"text",text:t.text,ts:Date.now(),partial:!0}]}}case"user_text":return{...e,transcript:[...e.transcript,{id:h(),role:"user",kind:"text",text:t.text,ts:Date.now()}]};case"cards":return{...e,transcript:[...e.transcript,{id:h(),role:"agent",kind:"cards",items:t.items,ts:Date.now()}]};case"tool_result":return e;case"checkout_redirect":return{...e,checkoutUrl:t.url};case"cap_warning":return{...e,capWarning:{reason:t.reason,remaining:t.remaining},transcript:[...e.transcript,{id:h(),role:"system",kind:"cap_warning",remaining:t.remaining,ts:Date.now()}]};case"session_closed":return{...e,closed:!0,closedReason:t.reason,transcript:[...e.transcript,{id:h(),role:"system",kind:"closed",reason:t.reason,ts:Date.now()}]};default:return e}}default:return e}}function $(e){let n={sessionId:e.sessionId,mode:"pill",voiceState:"idle",transcript:[],thinking:!1,closed:!1,closedReason:null,checkoutUrl:null,capWarning:null,connection:"connecting"},t=[];return{get:()=>n,dispatch:o=>{n=je(n,o);for(let r of t)r(n)},subscribe:o=>(t.push(o),()=>{let r=t.indexOf(o);r>=0&&t.splice(r,1)})}}var te=`
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
`;var ne=[1e3,2e3,4e3,8e3,16e3],Fe=5;function oe(e,n){let t=null,o=0,r=!1,a=[];function i(){r||(n.onStatus(o>0?"reconnecting":"connecting"),t=new WebSocket(e),t.onopen=()=>{n.onStatus("connected"),o>0&&t?.send(JSON.stringify({type:"session_resume",sessionId:n.sessionId})),o=0;for(let s of a)t?.send(s);a=[]},t.onmessage=s=>n.onEvent(typeof s.data=="string"?s.data:""),t.onerror=()=>{},t.onclose=()=>{if(r)return;if(o+=1,o>=Fe){n.onStatus("disconnected");return}let s=Math.min(o-1,ne.length-1),l=ne[s]??3e4;n.onStatus("reconnecting"),setTimeout(i,l)})}return i(),{send:s=>{t&&t.readyState===1?t.send(s):a.push(s)},close:()=>{r=!0,t?.close()}}}var d={trayConnected:"CONNECTED",trayConnecting:"CONNECTING\u2026",trayOffline:"OFFLINE",micStart:"Start voice call",micMute:"Mute mic",micUnmute:"Unmute mic",endCallAria:"End call",closeAria:"Close",openAria:"Open shoppingmate",panelHelpHeading:"Hi, I'm",panelHelpSubtitle:"I'm here to help you:",panelBullets:["Find the right product fast","Compare options out loud","Check out without leaving the page"],poweredBy:"Powered by shoppingmate",chatPlaceholder:"Type a quick question\u2026",reconnecting:"Reconnecting\u2026",disconnected:"Connection lost \u2014 reload to retry",closed:{user:"Conversation ended",cap:"Time to wrap up \u2014 reload for a new chat",error:"Something went wrong"},payNow:"Pay now \u2192",capWarning:"A couple minutes left",thinking:"thinking\u2026",micDenied:"Mic blocked \u2014 switching to text"};var y=e=>`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${e}</svg>`,Ht=y('<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>'),E=y('<path d="M18 6 6 18"/><path d="m6 6 12 12"/>'),Nt=y('<path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>'),re=y('<path d="M10.68 13.31a16 16 0 0 0 3.41 2.6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7 2 2 0 0 1 1.72 2v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.42 19.42 0 0 1-3.33-2.67"/><path d="M5 5a2 2 0 0 1 2-2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L10.9 11.1"/><line x1="22" y1="2" x2="2" y2="22"/>'),ie=y('<path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="22"/>'),ae=y('<line x1="2" y1="2" x2="22" y2="22"/><path d="M18.89 13.23A7.12 7.12 0 0 0 19 12v-2"/><path d="M5 10v2a7 7 0 0 0 12 5"/><path d="M15 9.34V5a3 3 0 0 0-5.68-1.33"/><path d="M9 9v3a3 3 0 0 0 5.12 2.12"/><line x1="12" y1="19" x2="12" y2="22"/>'),se=y('<path d="M22 2 11 13"/><path d="M22 2l-7 20-4-9-9-4 20-7z"/>');function C(e){return e.replace(/[&<>"']/g,n=>n==="&"?"&amp;":n==="<"?"&lt;":n===">"?"&gt;":n==='"'?"&quot;":"&#39;")}function qe(e,n){let t=document.createElement("button");return t.className="card",t.type="button",t.dataset.sku=e.sku,t.innerHTML=`
    ${e.image?`<img src="${C(e.image)}" alt="${C(e.title)}" />`:'<div class="card-img-fallback"></div>'}
    <div class="title">${C(e.title)}</div>
    <div class="price">${C(e.priceFormatted)}</div>
  `,t.addEventListener("click",()=>n({sku:e.sku,variantId:e.variantId})),t}function Ge(e,n){if(e.kind==="text"){let o=document.createElement("div");return o.className=`bubble ${e.role}`,o.textContent=e.text,o}if(e.kind==="cards"){let o=document.createElement("div");o.className="cards-row";for(let r of e.items)o.appendChild(qe(r,n));return o}if(e.kind==="cap_warning"){let o=document.createElement("div");return o.className="bubble system",o.textContent=d.capWarning,o}let t=document.createElement("div");return t.className="bubble system",t.textContent=d.closed[e.reason],t}var ce=new WeakMap;function I(e,n,t){let o=ce.get(e)??[],r=new Map(o.map(l=>[l.id,l])),a=new Set(n.map(l=>l.id));for(let l of o)a.has(l.id)||l.el.remove();let i=[],s=!1;for(let l=0;l<n.length;l++){let c=n[l];if(!c)continue;let p=r.get(c.id);if(p)c.kind==="text"&&p.text!==c.text&&(p.el.textContent=c.text,p.text=c.text,s=!0),i.push(p);else{let m=Ge(c,t);e.appendChild(m),i.push({id:c.id,el:m,text:c.kind==="text"?c.text:void 0}),s=!0}}ce.set(e,i),s&&(e.scrollTop=e.scrollHeight)}function le(e){return e.muted?"you're muted":e.voiceState==="connecting"?`connecting to ${e.personaName}\u2026`:e.voiceState==="speaking"?`${e.personaName} is speaking\u2026`:`${e.personaName} is listening\u2026`}function Ye(e){return`${e.checkoutUrl??""}|${e.personaName}`}function de(e,n){let t=Ye(n);e.dataset.chromeKey!==t&&(e.innerHTML=`
      <div class="panel call-panel">
        <button class="panel-close" data-action="close" aria-label="${d.closeAria}">${E}</button>
        <div class="status-line" data-region="status">${le(n)}</div>
        <div class="transcript" data-region="transcript" aria-live="polite"></div>
        ${n.checkoutUrl?`<a class="checkout-cta" data-action="checkout" href="${n.checkoutUrl}" target="_blank" rel="noopener">${d.payNow}</a>`:""}
        <div class="panel-footer">${d.poweredBy}</div>
      </div>
    `,e.querySelector('[data-action="close"]')?.addEventListener("click",n.onClose),e.querySelector('[data-action="checkout"]')?.addEventListener("click",n.onCheckout),e.dataset.chromeKey=t);let o=e.querySelector('[data-region="status"]');if(o instanceof HTMLElement){let a=le(n);o.textContent!==a&&(o.textContent=a)}let r=e.querySelector('[data-region="transcript"]');r instanceof HTMLElement&&I(r,n.transcript,n.onCardTap)}function Je(e){return`${e.transcript.length===0?"1":"0"}|${e.checkoutUrl??""}|${e.closed?"1":"0"}|${e.personaName}|${e.personaInitial}|${e.personaAvatarUrl}`}function pe(e,n){let t=Je(n);if(e.dataset.chromeKey!==t){let r=n.transcript.length===0,a=d.panelBullets.map(c=>`<li>${c}</li>`).join(""),i=r?`
        <div class="welcome">
          <div class="welcome-avatar">
            <img src="${n.personaAvatarUrl}" alt="" onerror="this.style.display='none'; this.nextElementSibling.style.display='grid';" />
            <span class="welcome-avatar-fallback" aria-hidden="true">${n.personaInitial}</span>
          </div>
          <h2 class="welcome-heading">${d.panelHelpHeading} ${n.personaName}.</h2>
          <p class="welcome-sub">${d.panelHelpSubtitle}</p>
          <ul class="welcome-bullets">${a}</ul>
        </div>
      `:"";e.innerHTML=`
      <div class="panel">
        <button class="panel-close" data-action="close" aria-label="${d.closeAria}">${E}</button>
        ${i}
        <div class="transcript ${r?"transcript-empty":""}" data-region="transcript" aria-live="polite"></div>
        ${n.checkoutUrl?`<a class="checkout-cta" href="${n.checkoutUrl}" target="_blank" rel="noopener">${d.payNow}</a>`:""}
        <form class="input-row">
          <input type="text" placeholder="${d.chatPlaceholder}" ${n.closed?"disabled":""} />
          <button class="send" type="submit" aria-label="Send" ${n.closed?"disabled":""}>${se}</button>
        </form>
        <div class="panel-footer">${d.poweredBy}</div>
      </div>
    `,e.querySelector('[data-action="close"]')?.addEventListener("click",n.onClose);let s=e.querySelector("form"),l=e.querySelector("input");s instanceof HTMLFormElement&&l instanceof HTMLInputElement&&s.addEventListener("submit",c=>{c.preventDefault();let p=l.value.trim();p&&(l.value="",n.onSend(p))}),e.dataset.chromeKey=t}let o=e.querySelector('[data-region="transcript"]');o instanceof HTMLElement&&I(o,n.transcript,n.onCardTap)}function Xe(e){return[e.mode,e.callable?"1":"0",e.voiceState,e.personaName,e.personaInitial,e.personaAvatarUrl].join("|")}function ue(e,n){let t=Xe(n);if(e.dataset.trayKey===t)return;let o=n.mode==="call"||n.voiceState!=="idle",r=n.voiceState==="muted",a=n.voiceState==="speaking",i=n.voiceState==="connecting",s=n.voiceState!=="idle"&&!i,l=s&&!r,c=n.mode==="chat"||n.mode==="call"||n.mode==="expanded",p=i?d.trayConnecting:s?d.trayConnected:d.trayOffline,m=i?"tray-status connecting":s?"tray-status connected":"tray-status idle",v=`
    <div class="tray-waveform ${l?"active":""} ${a?"speaking":""}" aria-hidden="true">
      ${Array.from({length:18}).map(()=>'<span class="bar"></span>').join("")}
    </div>
  `,A=n.callable?o?r?d.micUnmute:d.micMute:d.micStart:d.micStart,ye=r?ae:ie,be=!o;e.innerHTML=`
    <div class="tray" role="region" aria-label="shoppingmate">
      <button class="tray-avatar" data-action="toggle" aria-expanded="${c}" aria-label="${d.openAria}">
        <img src="${n.personaAvatarUrl}" alt="" class="tray-avatar-img" onerror="this.style.display='none'; this.nextElementSibling.style.display='grid';" />
        <span class="tray-avatar-fallback" aria-hidden="true">${n.personaInitial}</span>
        <span class="tray-presence ${i?"connecting":s?"connected":"idle"}"></span>
      </button>
      <div class="tray-meta">
        <div class="tray-name">${n.personaName}</div>
        <div class="${m}"><span class="tray-status-dot"></span>${p}</div>
      </div>
      ${v}
      <div class="tray-controls">
        <button class="tray-btn ${r?"muted":""}" data-action="mic" aria-pressed="${r}" aria-label="${A}">${ye}</button>
        <button class="tray-btn end ${be?"hidden":""}" data-action="end" aria-label="${d.endCallAria}">${re}</button>
      </div>
    </div>
  `,e.querySelector('[data-action="toggle"]')?.addEventListener("click",()=>{c?n.onClose():n.onChat()}),e.querySelector('[data-action="mic"]')?.addEventListener("click",()=>{o?n.onMute(!r):n.onCall()}),e.querySelector('[data-action="end"]')?.addEventListener("click",n.onEnd),e.dataset.trayKey=t}var Ze="data-shoppingmate-soft-prompt";function me(e,n){let t=null,o=!1,r=!1,a=null;t=setTimeout(()=>{o||r||(r=!0,a=Qe(e,()=>{n.onAccept(),i()},()=>{n.onDismiss(),i()}))},5e3);function i(){a&&a.parentNode&&a.parentNode.removeChild(a),a=null}return{cancel(){o=!0,t&&clearTimeout(t),i()}}}function Qe(e,n,t){let o=document.createElement("div");return o.setAttribute(Ze,""),Object.assign(o.style,{position:"fixed",right:"24px",bottom:"96px",maxWidth:"320px",background:"white",color:"#0b0b14",padding:"14px 16px",borderRadius:"16px",boxShadow:"0 10px 30px rgba(0,0,0,0.18)",fontFamily:"system-ui, -apple-system, sans-serif",fontSize:"14px",lineHeight:"1.4",zIndex:"2147483645"}),o.innerHTML=`
    <div style="font-weight:600;margin-bottom:6px;">Want a quick tour?</div>
    <div style="opacity:.85;margin-bottom:10px;">Sage will walk you through what shoppingmate does in about a minute.</div>
    <div style="display:flex;gap:8px;">
      <button data-action="accept" style="flex:1;padding:8px 12px;border:0;border-radius:10px;background:#8b5cf6;color:white;font-weight:600;cursor:pointer;">Yes, show me</button>
      <button data-action="dismiss" style="padding:8px 12px;border:1px solid #e5e7eb;background:white;border-radius:10px;cursor:pointer;">Not now</button>
    </div>
  `,o.querySelector('[data-action="accept"]')?.addEventListener("click",n),o.querySelector('[data-action="dismiss"]')?.addEventListener("click",t),e.appendChild(o),o}var ge="shoppingmate-widget";function fe(){return"live-kit"==="web-speech"?"web-speech":"live-kit"}var D=class extends HTMLElement{constructor(){super(...arguments);u(this,"rootEl",null);u(this,"pillHost",null);u(this,"panelHost",null);u(this,"store",$({sessionId:"pending"}));u(this,"socket",null);u(this,"voiceMode",b(null,w()));u(this,"voice",null);u(this,"persona",Z());u(this,"apiBase","");u(this,"merchantId","");u(this,"domain",window.location.host);u(this,"stopActivityTracker",null)}connectedCallback(){if(this.shadowRoot)return;let t=this.getAttribute("data-id"),o=this.getAttribute("data-api")??this.apiBase;if(!t){console.warn("[shoppingmate] data-id missing on widget element");return}this.merchantId=t,this.apiBase=o;let r=this.attachShadow({mode:"open"}),a=document.createElement("style");a.textContent=te,r.appendChild(a);let i=document.createElement("div");i.className="root",r.appendChild(i),this.rootEl=i,this.panelHost=document.createElement("div"),this.pillHost=document.createElement("div"),i.appendChild(this.panelHost),i.appendChild(this.pillHost),this.store.subscribe(()=>this.render()),this.render(),fe()==="live-kit"&&U(),this.start()}disconnectedCallback(){this.socket?.close(),this.voiceMode.stop(),this.stopActivityTracker?.()}async start(){let t=await B({apiBase:this.apiBase,merchantId:this.merchantId,domain:this.domain});if(t.kind==="err"){console.warn("[shoppingmate] bootstrap failed:",t.reason);return}this.store=$({sessionId:t.sessionId}),this.store.subscribe(()=>this.render()),this.voice=t.voice,this.persona=Q(t.personaId??t.voice?.personaId??null);let o=fe(),r=x();if(o==="live-kit"&&this.voice){let i=S({stack:"live-kit",livekit:{sessionId:t.sessionId,wsUrl:this.voice.wsUrl,token:this.voice.token,roomName:this.voice.roomName,onTranscriptEvent:s=>this.handleLiveKitData(s)}});i&&(this.voiceMode=i,this.voiceMode.warm?.())}else{let i=S({stack:"web-speech"});i&&(this.voiceMode=i),r?.onFinal(s=>{this.store.dispatch({type:"user_input",text:s,mode:"voice"}),this.socket?.send(g({type:"user_text",sessionId:t.sessionId,text:s,mode:"voice"}))})}this.voiceMode.onStateChange(i=>this.store.dispatch({type:"set_voice_state",state:i})),this.socket=oe(t.wsUrl,{sessionId:t.sessionId,onEvent:i=>{let s=L(i);s&&this.handleAgentEvent(s)},onStatus:i=>this.store.dispatch({type:"set_connection",status:i})}),this.merchantId==="SM-XPK2EN"&&me(document.body,{onAccept:()=>{this.publishWidgetMessage({type:"tour_request"}),this.openCall()},onDismiss:()=>{}}),this.stopActivityTracker=z({sessionId:t.sessionId,hints:new Map,send:i=>this.publishWidgetMessage(i)})}async handleAgentEvent(t,o="ws"){if(t.type==="host_action_request"){let r=await Y(t.action);this.publishWidgetMessage({type:"host_action_result",callId:t.callId,result:r},o);return}if(t.type!=="persona_swap"&&t.type!=="agent_warmed"){if(t.type==="agent_ready"){this.voiceMode.signalAgentReady?.();return}this.store.dispatch({type:"agent_event",event:t}),t.type==="say"&&this.voiceMode.speak(t.text)}}publishWidgetMessage(t,o="ws"){let r=g(t);if(o==="livekit"&&this.voiceMode.publishData){let a=new TextEncoder().encode(r);this.voiceMode.publishData(a);return}this.socket?.send(r)}render(){if(!this.pillHost||!this.panelHost)return;let t=this.store.get(),o=x()!==null;t.mode==="call"?de(this.panelHost,{voiceState:t.voiceState,muted:t.voiceState==="muted",transcript:t.transcript,checkoutUrl:t.checkoutUrl,personaName:this.persona.name,onClose:()=>this.store.dispatch({type:"set_mode",mode:"pill"}),onCardTap:r=>this.cardTap(r),onCheckout:()=>{}}):t.mode==="chat"||t.mode==="expanded"?pe(this.panelHost,{transcript:t.transcript,checkoutUrl:t.checkoutUrl,personaName:this.persona.name,personaInitial:this.persona.initial,personaAvatarUrl:this.persona.avatarUrl,onSend:r=>this.userText(r,"text"),onCall:()=>this.openCall(),onClose:()=>this.store.dispatch({type:"set_mode",mode:"pill"}),onCardTap:r=>this.cardTap(r),closed:t.closed}):this.panelHost.innerHTML="",ue(this.pillHost,{mode:t.mode,callable:o,voiceState:t.voiceState,personaName:this.persona.name,personaInitial:this.persona.initial,personaAvatarUrl:this.persona.avatarUrl,onCall:()=>this.openCall(),onMute:r=>this.voiceMode.setMuted(r),onEnd:()=>{this.voiceMode.stop(),this.store.dispatch({type:"set_mode",mode:"pill"})},onChat:()=>this.store.dispatch({type:"set_mode",mode:"chat"}),onClose:()=>this.store.dispatch({type:"set_mode",mode:"pill"})})}openCall(){this.store.dispatch({type:"set_mode",mode:"call"}),this.voiceMode.start()}userText(t,o){this.store.dispatch({type:"user_input",text:t,mode:o});let r=this.store.get().sessionId;this.socket?.send(g({type:"user_text",sessionId:r,text:t,mode:o}))}handleLiveKitData(t){let o;try{o=new TextDecoder().decode(t)}catch{return}let r=L(o);r&&this.handleAgentEvent(r,"livekit")}cardTap(t){let o=this.store.get().sessionId;this.socket?.send(g({type:"card_tap",sessionId:o,action:"cartAdd",sku:t.sku,variantId:t.variantId,qty:1}))}};function he(){customElements.get(ge)||customElements.define(ge,D)}function et(){let e=document.currentScript instanceof HTMLScriptElement?document.currentScript:null,n=e?.dataset.id;if(!n){console.warn("[shoppingmate] data-id missing on script tag");return}if(document.querySelector("shoppingmate-widget"))return;he();let t=document.createElement("shoppingmate-widget");t.setAttribute("data-id",n);let o=e?.dataset.api;t.setAttribute("data-api",o??"https://api-production-1ea1.up.railway.app"),document.body?document.body.appendChild(t):document.addEventListener("DOMContentLoaded",()=>document.body.appendChild(t),{once:!0})}et();})();
