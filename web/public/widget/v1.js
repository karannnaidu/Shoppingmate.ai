"use strict";(()=>{var he=Object.defineProperty;var ye=(t,n,e)=>n in t?he(t,n,{enumerable:!0,configurable:!0,writable:!0,value:e}):t[n]=e;var g=(t,n,e)=>ye(t,typeof n!="symbol"?n+"":n,e);function M(){let t=globalThis,n=t.SpeechRecognition??t.webkitSpeechRecognition;if(!n)return null;let e=new n;e.continuous=!0,e.interimResults=!1,e.lang="en-US";let o=!1,r=[],i=[];return e.onresult=a=>{for(let s=0;s<a.results.length;s+=1){let c=a.results[s];if(c?.isFinal){let l=c[0]?.transcript?.trim();if(l)for(let u of r)u(l)}}},e.onerror=a=>{for(let s of i)s(String(a?.error??"unknown"))},e.onend=()=>{o=!1},{start:()=>{if(!o){o=!0;try{e.start()}catch{}}},stop:()=>{if(o){o=!1;try{e.stop()}catch{}}},onFinal:a=>{r.push(a)},onError:a=>{i.push(a)},isActive:()=>o}}function O(){let t=globalThis.speechSynthesis;if(!t)return{speak:async()=>{},cancel:()=>{},available:()=>!1};function n(){if(!t)return null;let e=t.getVoices();return e.find(o=>o.lang.startsWith("en-")&&o.default)??e.find(o=>o.lang.startsWith("en-"))??e[0]??null}return{speak:e=>new Promise(o=>{let r=new SpeechSynthesisUtterance(e),i=n();i&&(r.voice=i),r.rate=1,r.onend=()=>o(),r.onerror=()=>o(),t.speak(r)}),cancel:()=>t.cancel(),available:()=>!0}}function S(t,n){let e="idle",o=!1,r=[],i=a=>{if(e!==a){e=a;for(let s of r)s(a)}};return{start:()=>{if(e==="idle"){if(o){i("muted");return}t?.start(),i("listening")}},stop:()=>{t?.stop(),n.cancel(),i("idle")},speak:async a=>{e!=="idle"&&(t?.stop(),i("speaking"),await n.speak(a),o?i("muted"):(t?.start(),i("listening")))},setMuted:a=>{o=a,a?(t?.stop(),e==="listening"&&i("muted")):e==="muted"&&(t?.start(),i("listening"))},getState:()=>e,onStateChange:a=>{r.push(a)}}}function be(t){if(!t||typeof t.type!="string")return!1;switch(t.type){case"navigate":return typeof t.path=="string";case"scroll_to":case"highlight":case"click":case"point_at":case"demo_click":return typeof t.intent=="string";case"cart_add":case"cart_set_qty":return typeof t.sku=="string"&&typeof t.qty=="number";case"open_cart":case"cart_clear":case"checkout_place":case"checkout_state":return!0;case"apply_coupon":return typeof t.code=="string";case"checkout_fill":return!!t.details&&typeof t.details.name=="string"&&typeof t.details.phone=="string"&&typeof t.details.email=="string"&&typeof t.details.address=="string"&&typeof t.details.city=="string"&&typeof t.details.state=="string"&&typeof t.details.pincode=="string"&&(t.details.payment==="cod"||t.details.payment==="prepaid");case"form_fill":return Array.isArray(t.fields)&&t.fields.every(n=>n&&typeof n.field=="string"&&typeof n.value=="string");case"form_read":return t.fields===void 0||Array.isArray(t.fields);default:return!1}}function x(t){return JSON.stringify(t)}function K(t){let n;try{n=JSON.parse(t)}catch{return null}if(!n||typeof n!="object")return null;let e=n;switch(e.type){case"thinking":return{type:"thinking"};case"say":return typeof e.text=="string"?{type:"say",text:e.text}:null;case"say_partial":return typeof e.text=="string"?{type:"say_partial",text:e.text}:null;case"user_text":return typeof e.text=="string"?{type:"user_text",text:e.text}:null;case"cards":return Array.isArray(e.items)?{type:"cards",items:e.items}:null;case"tool_result":return typeof e.toolName!="string"||typeof e.ok!="boolean"?null:{type:"tool_result",toolName:e.toolName,ok:e.ok,summary:typeof e.summary=="string"?e.summary:void 0};case"checkout_redirect":return typeof e.url=="string"?{type:"checkout_redirect",url:e.url}:null;case"cap_warning":return e.reason!=="turns"&&e.reason!=="voice_ms"&&e.reason!=="duration_ms"||typeof e.remaining!="number"?null:{type:"cap_warning",reason:e.reason,remaining:e.remaining};case"end_of_turn":return{type:"end_of_turn"};case"session_closed":return e.reason!=="user"&&e.reason!=="cap"&&e.reason!=="error"?null:{type:"session_closed",reason:e.reason};case"host_action_request":{if(typeof e.callId!="string"||!e.action)return null;let o=e.action;return be(o)?{type:"host_action_request",callId:e.callId,action:o}:null}case"persona_swap":return typeof e.personaId=="string"?{type:"persona_swap",personaId:e.personaId}:null;case"agent_warmed":return{type:"agent_warmed"};case"agent_ready":return{type:"agent_ready"};default:return null}}var at="https://cdn.jsdelivr.net/npm",ve="2.7.0",ke="0.3.0",D=null;function xe(){return D||(D=import(`${at}/@livekit/krisp-noise-filter@${ke}/dist/index.mjs`).catch(()=>null),D)}async function we(t){let n=await xe();if(!n?.KrispNoiseFilter||n.isKrispNoiseFilterSupported&&!n.isKrispNoiseFilterSupported())return;let e=t.localParticipant.getTrackPublication?.("microphone"),o=e?.audioTrack??e?.track;o?.setProcessor&&await o.setProcessor(n.KrispNoiseFilter())}var w=null;function st(){return w||(typeof globalThis.__SHOPPINGMATE_LIVEKIT_LOADER__=="function"?(w=globalThis.__SHOPPINGMATE_LIVEKIT_LOADER__(),w):(w=import(`${at}/livekit-client@${ve}/dist/livekit-client.esm.mjs`),w))}function ct(){st().catch(()=>{w=null})}function _e(){try{if(typeof window<"u"){let n=window;if(typeof n.__SM_AUDIO_FULL__=="boolean")return n.__SM_AUDIO_FULL__}let t=new URLSearchParams(location.search).get("smAudioFull");return!(t==="0"||t==="false")}catch{return!0}}async function lt(t){let n=await st(),e=_e(),o=new n.Room({audioCaptureDefaults:{echoCancellation:!0,noiseSuppression:!0,autoGainControl:e,channelCount:1}}),r=new Map,i=!1;o.on("trackSubscribed",s=>{let c=s;if(c.kind!=="audio")return;let l=c.attach();l.style.display="none",l.muted=i,document.body.appendChild(l),r.set(s,l)}),o.on("trackUnsubscribed",s=>{let c=r.get(s);c&&(c.remove(),r.delete(s)),s.detach?.()});let a=[];return o.on("activeSpeakersChanged",s=>{let l=(s??[]).some(u=>!u.isLocal);for(let u of a)u(l)}),await o.connect(t.wsUrl,t.token),{setMicEnabled:async s=>{await o.localParticipant.setMicrophoneEnabled(s),s&&e&&we(o).catch(()=>{})},onData:s=>{o.on("dataReceived",c=>{c instanceof Uint8Array&&s(c)})},onAgentSpeaking:s=>{a.push(s)},setAgentAudioMuted:s=>{i=s;for(let c of r.values())c.muted=s},onReconnected:s=>{o.on("reconnected",()=>s())},publishData:s=>o.localParticipant.publishData(s,{reliable:!0}),disconnect:async()=>{for(let s of r.values())s.remove();r.clear(),await o.disconnect()}}}function dt(t){let n="idle",e=null,o=null,r=!1,i=!1,a=!1,s=[],c=[],l=d=>{if(n!==d){n=d;for(let h of s)h(d)}},u=d=>{let h=d instanceof Error?d.message:String(d),E=d instanceof Error?d.name:"",f;/permissions? policy|feature policy/i.test(h)?f="mic_policy_blocked":E==="NotAllowedError"||/denied|permission/i.test(h)?f="mic_denied":E==="NotFoundError"||/no.*microphone|not.*found/i.test(h)?f="mic_unavailable":/connect|network|websocket|timeout|token/i.test(h)?f="connect_failed":f="unknown";for(let b of c)b({code:f,message:h})},m=async d=>{await d.setMicEnabled(!r);let h=new TextEncoder().encode(x({type:"start_voice",sessionId:t.sessionId}));await d.publishData(h)},y=()=>e?Promise.resolve(e):o||(o=(async()=>{let d=await lt({wsUrl:t.wsUrl,token:t.token,roomName:t.roomName});return d.onData(h=>t.onTranscriptEvent(h)),d.onAgentSpeaking(h=>{r||(h&&(i=!0),i&&l(h?"speaking":"listening"))}),d.onReconnected(()=>{a&&(l("connecting"),i=!1,m(d).catch(h=>console.warn("[voiceModeLiveKit] re-start after reconnect failed",h)))}),e=d,d})(),o.catch(()=>{o=null}),o);return{warm:()=>{y().catch(d=>console.warn("[voiceModeLiveKit] warm failed",d))},start:()=>{n==="idle"&&(l("connecting"),i=!1,(async()=>{try{let d=await y();await m(d),a=!0,r&&l("muted")}catch(d){throw l("idle"),u(d),d}})().catch(d=>{console.warn("[voiceModeLiveKit] start failed",d)}))},stop:()=>{e?.disconnect().catch(()=>{}),e=null,o=null,a=!1,l("idle")},speak:async()=>{},setMuted:d=>{r=d,e?.setMicEnabled(!d).catch(()=>{}),e?.setAgentAudioMuted(d),d?l("muted"):n==="muted"&&l("listening")},getState:()=>n,onStateChange:d=>{s.push(d)},onError:d=>{c.push(d)},signalAgentReady:()=>{i=!0,n==="connecting"&&l(r?"muted":"listening")},publishData:async d=>{e&&await e.publishData(d)}}}function V(t){return t.stack==="web-speech"?S(M(),O()):t.stack==="live-kit"?t.livekit?dt(t.livekit):(console.warn("[voiceModeFactory] live-kit stack requires livekit opts; returning null \u2192 caller falls back to chat"),null):null}var pt={start:()=>{},stop:()=>{}};function W(t){if(!t||typeof window>"u")return pt;let n=window.AudioContext??window.webkitAudioContext;if(!n)return pt;let e=null,o=null;return{start(){if(!e)try{e=new n;let r=Math.floor(e.sampleRate*2),i=e.createBuffer(1,r,e.sampleRate),a=i.getChannelData(0),s=0;for(let u=0;u<r;u++){let m=Math.random()*2-1;s=(s+.02*m)/1.02,a[u]=s*3.5}o=e.createBufferSource(),o.buffer=i,o.loop=!0;let c=e.createBiquadFilter();c.type="lowpass",c.frequency.value=900;let l=e.createGain();l.gain.value=.02,o.connect(c).connect(l).connect(e.destination),o.start(),e.resume?.().catch(()=>{})}catch{this.stop()}},stop(){try{o?.stop()}catch{}o=null;try{e?.close()}catch{}e=null}}}var U="sm_visitor_id";function Se(){let t=new Uint8Array(8);return(globalThis.crypto??window.crypto).getRandomValues(t),`v_${Array.from(t,e=>e.toString(16).padStart(2,"0")).join("")}`}function Ce(){try{let n=localStorage.getItem(U);if(n){let e=JSON.parse(n);if(e?.id&&typeof e.expiresAt=="number")return e}}catch{}let t=document.cookie.match(new RegExp(`(?:^|; )${U}=([^;]+)`));return t?{id:decodeURIComponent(t[1]??""),expiresAt:Date.now()+1}:null}function ut(t){try{localStorage.setItem(U,JSON.stringify(t));let n=Math.floor(6048e5/1e3);document.cookie=`${U}=${t.id}; max-age=${n}; path=/; SameSite=Lax; Secure`}catch{}}function I(){let t=Date.now(),n=Ce();if(n&&n.expiresAt>t)return ut({id:n.id,expiresAt:t+6048e5}),n.id;let e=Se();return ut({id:e,expiresAt:t+6048e5}),e}var Te=new Set(["the","a","an","to","of","on","in","and","or","section","button","link","card","tile","now"]),Ae=[{keyword:"button",matchTag:/^(button)$/i,matchRole:"button"},{keyword:"link",matchTag:/^(a)$/i,matchRole:"link"},{keyword:"card",matchTag:/^(article|div|section)$/i},{keyword:"section",matchTag:/^(section|main|article)$/i}],Ee=.4;function C(t,n){if(n){let i=n.get(t.toLowerCase().trim());if(i)try{let a=document.querySelector(i);if(a instanceof HTMLElement&&F(a))return a}catch{}}let e=L(t);if(e.size===0)return null;let o=Me(document.body),r=null;for(let i of o){if(!i.visible)continue;let a=Le(i,t,e);a<Ee||(!r||a>r.score)&&(r={c:i,score:a})}return r?.c.element??null}function L(t){return new Set(t.toLowerCase().replace(/[^a-z0-9 ]/g," ").split(/\s+/).filter(n=>n.length>0&&!Te.has(n)))}function Me(t){let n=[],e=document.createTreeWalker(t,NodeFilter.SHOW_ELEMENT),o=e.nextNode();for(;o;){if(o instanceof HTMLElement){let r=Ie(o);r&&n.push({element:o,role:o.getAttribute("role")??o.tagName.toLowerCase(),name:r,visible:F(o)})}o=e.nextNode()}return n}function Ie(t){let n=t.getAttribute("aria-labelledby");if(n){let i=n.split(/\s+/).map(a=>document.getElementById(a)?.textContent?.trim()??"").filter(Boolean);if(i.length>0)return i.join(" ")}let e=t.getAttribute("aria-label");if(e)return e.trim();if(t.id){let i=document.querySelector(`label[for="${ft(t.id)}"]`);if(i?.textContent)return i.textContent.trim()}let o=t.getAttribute("alt")??t.getAttribute("title");if(o)return o.trim();let r=(t.textContent??"").trim();return r&&r.length<200?r:""}function F(t){if(!t.isConnected)return!1;let n=t.ownerDocument.defaultView?.getComputedStyle(t);return n?!(n.display==="none"||n.visibility==="hidden"||n.opacity==="0"):!0}function Le(t,n,e){let o=L(t.name);if(o.size===0)return 0;let r=0;for(let m of e)o.has(m)&&r++;let i=new Set([...e,...o]).size,a=i===0?0:r/i,s=0,c=n.toLowerCase();for(let m of Ae)if(c.includes(m.keyword)&&(m.matchTag.test(t.element.tagName)||t.role===m.matchRole)){s=.15;break}let l=t.element.getAttribute("data-tour-stop"),u=0;if(l){let m=L(l.replace(/-/g," ")),y=0;for(let d of e)m.has(d)&&y++;y>0&&(u=.5*(y/e.size))}return Math.min(1,a+s+u)}function ft(t){return t.replace(/(["\\])/g,"\\$1")}function z(t,n){if(n){let i=n.get(t.toLowerCase().trim());if(i)try{let a=document.querySelector(i);if(a instanceof HTMLElement&&F(a))return a}catch{}}let e=L(t);if(e.size===0)return null;let o=Array.from(document.querySelectorAll("input, textarea, select")).filter(i=>F(i)&&!He(i)),r=null;for(let i of o){let a=Ne(i,e);a<=0||(!r||a>r.score)&&(r={el:i,score:a})}return r?.el??null}function He(t){let n=(t.getAttribute("type")??"").toLowerCase();return n==="hidden"||n==="submit"||n==="button"||t.disabled}function Pe(t){let n=[],e=t.id;if(e){n.push(e);let c=document.querySelector(`label[for="${ft(e)}"]`);c?.textContent&&n.push(c.textContent)}let o=t.getAttribute("name");o&&n.push(o);let r=t.getAttribute("data-field")??t.getAttribute("data-testid");r&&n.push(r);let i=t.getAttribute("aria-label");i&&n.push(i);let a=t.getAttribute("placeholder");a&&n.push(a);let s=t.closest("label");return s?.textContent&&n.push(s.textContent),n}var Re=[["phone","mobile","cell","contact","phonenumber","tel","whatsapp"],["pincode","pin","postal","postcode","zip","zipcode"],["name","fullname"],["email","mail","emailaddress"],["address","street","addr","address1"],["city","town"],["state","province","region"],["landmark","apartment","flat","floor"]],gt=new Map;for(let t of Re)for(let n of t)gt.set(n,t[0]);function mt(t){return gt.get(t)??t}function Ne(t,n){let e=new Set([...n].map(mt)),o=0;for(let r of Pe(t)){let i=new Set([...L(r)].map(mt));if(i.size===0)continue;let a=0;for(let c of e)i.has(c)&&a++;if(a===0)continue;let s=a/e.size;s>o&&(o=s)}return o}var $e="data-shoppingmate-bot-cursor",ht="data-shoppingmate-cursor-keyframes",H=null,G=window.innerWidth-80,Y=window.innerHeight-80;function yt(){if(H&&H.isConnected)return H;Oe();let t=document.createElement("div");return t.setAttribute($e,""),t.innerHTML=`
    <svg width="22" height="22" viewBox="0 0 22 22" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path d="M3 2 L3 17 L7 13 L9.5 19 L12 18 L9.5 12 L15 12 Z"
            fill="#111827" stroke="#fff" stroke-width="1.2" stroke-linejoin="round"/>
    </svg>
  `,Object.assign(t.style,{position:"fixed",left:"0",top:"0",transform:`translate(${G}px, ${Y}px)`,transition:"transform 480ms cubic-bezier(0.22, 1, 0.36, 1), opacity 200ms",pointerEvents:"none",zIndex:"2147483647",opacity:"0",willChange:"transform, opacity",filter:"drop-shadow(0 2px 6px rgba(0,0,0,0.25))"}),document.body.appendChild(t),H=t,t}function Oe(){if(document.head.querySelector(`style[${ht}]`))return;let t=document.createElement("style");t.setAttribute(ht,""),t.textContent=`
    @keyframes shoppingmate-cursor-click {
      0%   { transform: var(--sm-cursor-pos) scale(1); }
      40%  { transform: var(--sm-cursor-pos) scale(0.72); }
      100% { transform: var(--sm-cursor-pos) scale(1); }
    }
  `,document.head.appendChild(t)}function De(t){let n=t.getBoundingClientRect();return{x:n.left+n.width/2-6,y:n.top+n.height/2-6}}function T(t,n=480){let e=yt(),{x:o,y:r}=De(t);return e.style.transitionDuration=`${n}ms, 200ms`,e.style.opacity="1",e.style.transform=`translate(${o}px, ${r}px)`,G=o,Y=r,new Promise(i=>setTimeout(i,n))}function q(){let t=yt();return t.style.setProperty("--sm-cursor-pos",`translate(${G}px, ${Y}px)`),t.style.animation="shoppingmate-cursor-click 280ms ease-out",new Promise(n=>{let e=()=>{t.style.animation="",t.removeEventListener("animationend",e),n()};t.addEventListener("animationend",e),setTimeout(e,360)})}function P(t=600){let n=H;n&&setTimeout(()=>{n.style.opacity="0"},t)}var Ve="data-shoppingmate-pulse-ring";function vt(t,n){let e=t.getBoundingClientRect(),o=document.createElement("div");o.setAttribute(Ve,""),Object.assign(o.style,{position:"fixed",left:`${e.left-6}px`,top:`${e.top-6}px`,width:`${e.width+12}px`,height:`${e.height+12}px`,borderRadius:"14px",boxShadow:"0 0 0 3px rgba(139,92,246,0.85), 0 0 24px rgba(139,92,246,0.55)",pointerEvents:"none",zIndex:"2147483646",animation:"shoppingmate-pulse 1.2s ease-in-out infinite"}),Ue(),document.body.appendChild(o);let r=!1,i=()=>{r||(r=!0,o.remove())};return setTimeout(i,n),i}var bt=!1;function Ue(){if(bt)return;bt=!0;let t=document.createElement("style");t.textContent=`@keyframes shoppingmate-pulse {
    0%, 100% { transform: scale(1); opacity: 1; }
    50% { transform: scale(1.04); opacity: 0.85; }
  }`,document.head.appendChild(t)}function Fe(t,n){let e=t instanceof HTMLTextAreaElement?HTMLTextAreaElement.prototype:t instanceof HTMLSelectElement?HTMLSelectElement.prototype:HTMLInputElement.prototype,o=Object.getOwnPropertyDescriptor(e,"value");o?.set?o.set.call(t,n):t.value=n,t.dispatchEvent(new Event("input",{bubbles:!0})),t.dispatchEvent(new Event("change",{bubbles:!0}))}function J(t){return t.value??""}var kt="sm_selector_cache_v1";function qe(){try{return JSON.parse(localStorage.getItem(kt)??"{}")}catch{return{}}}function je(t){try{localStorage.setItem(kt,JSON.stringify(t))}catch{}}function Be(t){return`${location.pathname}::${t}`}function Ke(t){let n=t.getAttribute("data-sm-field");if(n)return`[data-sm-field="${CSS.escape(n)}"]`;if(t.id)return`#${CSS.escape(t.id)}`;let e=t.getAttribute("name");return e?`[name="${CSS.escape(e)}"]`:null}function We(t,n){let e=qe(),o=Be(t),r=e[o];if(r)try{let a=document.querySelector(r);if(a?.isConnected)return a}catch{}let i=null;try{i=document.querySelector(`[data-sm-field="${CSS.escape(t)}"]`)}catch{i=null}if(i||(i=z(t,n)),i){let a=Ke(i);a&&(e[o]=a,je(e))}return i}function xt(t,n){let e={},o=[],r=!1;for(let{field:i,value:a}of t){let s=We(i,n);if(!s){o.push({field:i,ok:!1,value:""});continue}r=!0,Fe(s,a);let c=J(s);e[i]=c,o.push({field:i,ok:c===a,value:c})}return r?{ok:!0,values:e,filled:o}:{ok:!1,reason:"not_found"}}function wt(t,n){let e={};if(t&&t.length>0){for(let r of t){let i=z(r,n);i&&(e[r]=J(i))}return{ok:!0,values:e}}let o=document.querySelectorAll("input, textarea, select");for(let r of o){let i=(r.getAttribute("type")??"").toLowerCase();if(i==="password"||i==="hidden")continue;let a=r.getAttribute("name")??r.id;a&&(e[a]=J(r))}return{ok:!0,values:e}}async function _t(t){if(t.platform!=="shopify")return;let n=t.fetchFn??fetch;try{await n("/cart/update.js",{method:"POST",credentials:"same-origin",headers:{"Content-Type":"application/json"},body:JSON.stringify({attributes:{sm_visitor_id:t.visitorId}})})}catch{}}var X={"Content-Type":"application/json"};function St(t){let n=Number(String(t).trim());return Number.isFinite(n)&&n>0?n:null}function Q(t){try{let n={cart:t},e=["cart:refresh","cart:updated","cart:change","cart:build","cart:rerender","ajaxCart:afterCartLoad","cart.requestComplete","added.ajaxProduct"];for(let i of e)document.dispatchEvent(new CustomEvent(i,{bubbles:!0,detail:n})),window.dispatchEvent(new CustomEvent(i,{bubbles:!0,detail:n}));let o=window;typeof o.getCartUpdate=="function"&&o.getCartUpdate(),typeof o.after_add_to_cart=="function"&&o.after_add_to_cart(t);let r=o.jQuery;if(r)try{r(document.body).trigger("cart:updated",[t]),r(document.body).trigger("added.ajaxProduct")}catch{}}catch{}}async function Z(t){try{let n=await t("/cart.js",{credentials:"same-origin"});return n.ok?await n.json():null}catch{return null}}function tt(t){let n=(t.items??[]).map(e=>`${e.product_title??"item"}${e.variant_title?` ${e.variant_title}`:""} x${e.quantity}`).join(", ");return{count:String(t.item_count??0),items:n,subtotal:t.total_price!=null?(t.total_price/100).toFixed(2):""}}async function Ct(t,n,e=fetch){let o=St(t);if(o==null)return{ok:!1,reason:"not_found"};try{if(!(await e("/cart/add.js",{method:"POST",credentials:"same-origin",headers:X,body:JSON.stringify({id:o,quantity:n>0?n:1})})).ok)return{ok:!1,reason:"not_found"};let i=await Z(e);return i&&i.items.some(a=>a.id===o)?(Q(i),{ok:!0,values:tt(i)}):{ok:!1,reason:"not_found"}}catch{return{ok:!1,reason:"not_found"}}}async function Tt(t=fetch){let n=await Z(t);return n?{ok:!0,values:tt(n)}:{ok:!1,reason:"not_found"}}async function At(t,n,e=fetch){let o=St(t);if(o==null)return{ok:!1,reason:"not_found"};try{let r=await e("/cart/change.js",{method:"POST",credentials:"same-origin",headers:X,body:JSON.stringify({id:o,quantity:Math.max(0,n)})});if(!r.ok)return{ok:!1,reason:"not_found"};let i=await r.json().catch(()=>null);return Q(i),i?{ok:!0,values:tt(i)}:{ok:!0}}catch{return{ok:!1,reason:"not_found"}}}async function Et(t=fetch){try{return(await t("/cart/clear.js",{method:"POST",credentials:"same-origin",headers:X})).ok?(Q(await Z(t)),{ok:!0}):{ok:!1,reason:"not_found"}}catch{return{ok:!1,reason:"not_found"}}}async function Mt(t,n=fetch){let e=String(t??"").trim();if(!e)return{ok:!1,reason:"not_found"};try{return await n(`/discount/${encodeURIComponent(e)}`,{method:"GET",credentials:"same-origin",redirect:"manual"})?{ok:!0}:{ok:!1,reason:"not_found"}}catch{return{ok:!1,reason:"not_found"}}}var et=null;function Lt(t){et=t??null}function A(){if(et==="shopify")return!0;if(et)return!1;try{return typeof window.Shopify<"u"}catch{return!1}}async function Ht(t){switch(t.type){case"navigate":return It(t.path);case"scroll_to":return rn(t.intent);case"highlight":return an(t.intent,t.durationMs??2e3);case"click":return sn(t.intent);case"point_at":return cn(t.intent);case"demo_click":return ln(t.intent);case"cart_add":return A()?Ct(t.sku,t.qty):Je(t.sku,t.qty);case"open_cart":return A()?It("/cart"):Xe();case"cart_set_qty":return A()?At(t.sku,t.qty):tn(t.sku,t.qty);case"cart_clear":return A()?Et():Ze();case"cart_get":return A()?Tt():Qe();case"apply_coupon":return A()?Mt(t.code):en(t.code);case"checkout_fill":return Ge(t.details);case"checkout_place":return Ye();case"checkout_state":return ze();case"form_fill":return xt(t.fields);case"form_read":return wt(t.fields)}}async function ze(){let t=window.__shoppingmateCheckoutState__;if(typeof t!="function")return{ok:!1,reason:"not_found"};try{return await t()?{ok:!0}:{ok:!1,reason:"not_found"}}catch{return{ok:!1,reason:"not_found"}}}async function Ge(t){let n=window.__shoppingmateCheckoutFill__;if(typeof n!="function")return{ok:!1,reason:"not_found"};try{return await n(t)?{ok:!0}:{ok:!1,reason:"not_found"}}catch{return{ok:!1,reason:"not_found"}}}async function Ye(){let t=window.__shoppingmatePlaceOrder__;if(typeof t!="function")return{ok:!1,reason:"not_found"};try{return await t()?{ok:!0}:{ok:!1,reason:"not_found"}}catch{return{ok:!1,reason:"not_found"}}}function Je(t,n){let e=window.__shoppingmateCartAdd__;if(typeof e!="function")return{ok:!1,reason:"not_found"};try{return e(t,n)?{ok:!0}:{ok:!1,reason:"not_found"}}catch{return{ok:!1,reason:"not_found"}}}function Xe(){let t=window.__shoppingmateOpenCart__;if(typeof t!="function")return{ok:!1,reason:"not_found"};try{return t(),{ok:!0}}catch{return{ok:!1,reason:"not_found"}}}function Qe(){let t=window.__shoppingmateGetCart__;if(typeof t!="function")return{ok:!1,reason:"not_found"};try{let n=t(),e=(n?.items??[]).map(o=>`${o.sku??o.name??"item"} x${o.quantity??1}`).join(", ");return{ok:!0,values:{count:String(n?.count??0),items:e,subtotal:n?.subtotal!=null?String(n.subtotal):""}}}catch{return{ok:!1,reason:"not_found"}}}function Ze(){let t=window.__shoppingmateClearCart__;if(typeof t!="function")return{ok:!1,reason:"not_found"};try{return t()?{ok:!0}:{ok:!1,reason:"not_found"}}catch{return{ok:!1,reason:"not_found"}}}function tn(t,n){let e=window.__shoppingmateCartSetQty__;if(typeof e!="function")return{ok:!1,reason:"not_found"};try{return e(t,n)?{ok:!0}:{ok:!1,reason:"not_found"}}catch{return{ok:!1,reason:"not_found"}}}async function en(t){let n=window.__shoppingmateApplyCoupon__;if(typeof n!="function")return{ok:!1,reason:"not_found"};try{return await n(t)?{ok:!0}:{ok:!1,reason:"not_found"}}catch{return{ok:!1,reason:"not_found"}}}function nn(t){let n=window.__shoppingmateNavigate__;if(typeof n=="function")try{return n(t),!0}catch{return!1}return!1}async function It(t){try{let n=new URL(t,window.location.href);if(n.origin!==window.location.origin)return{ok:!1,reason:"cross_origin"};let e=on(n.pathname);e&&(await T(e,520),await q());let o=n.pathname+n.search+n.hash;return nn(o)||window.location.assign(o),P(800),{ok:!0}}catch{return{ok:!1,reason:"route_not_found"}}}function on(t){let n=document.querySelectorAll("a[href]");for(let e of n)try{if(new URL(e.href,window.location.href).pathname===t)return e}catch{}return null}async function rn(t){let n=C(t);return n?(await T(n,480),n.scrollIntoView({behavior:"smooth",block:"center"}),P(800),{ok:!0}):{ok:!1,reason:"not_found"}}function an(t,n){let e=C(t);return e?(vt(e,n),{ok:!0}):{ok:!1,reason:"not_found"}}async function sn(t){let n=C(t);return n?n.isConnected?(await T(n,420),await q(),n.isConnected?(n.click(),P(800),{ok:!0}):{ok:!1,reason:"stale_target"}):{ok:!1,reason:"stale_target"}:{ok:!1,reason:"not_found"}}async function Pt(t){let n=t.getBoundingClientRect(),e=window.innerHeight;(n.bottom<80||n.top>e-80)&&(t.scrollIntoView({behavior:"smooth",block:"center"}),await new Promise(r=>setTimeout(r,350)))}async function cn(t){let n=C(t);return n?n.isConnected?(await Pt(n),await T(n,480),{ok:!0}):{ok:!1,reason:"stale_target"}:{ok:!1,reason:"not_found"}}async function ln(t){let n=C(t);return n?n.isConnected?(await Pt(n),await T(n,420),await q(),await new Promise(e=>setTimeout(e,120)),n.isConnected?(n.click(),P(800),{ok:!0}):{ok:!1,reason:"stale_target"}):{ok:!1,reason:"stale_target"}:{ok:!1,reason:"not_found"}}var R=[200,500],Rt=t=>new Promise(n=>setTimeout(n,t));async function nt(t,n){let e;for(let o=0;o<=R.length;o++)try{let r=await fetch(t,n);if(r.status>=500&&o<R.length){await Rt(R[o]??0);continue}return r}catch(r){if(e=r,o<R.length){await Rt(R[o]??0);continue}throw r}throw e}async function Nt(t){try{let n=I(),e=await nt(`${t.apiBase}/v1/install`,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({merchantId:t.merchantId,domain:t.domain,userAgent:navigator.userAgent,referrer:document.referrer||null})});if(!e.ok)return{kind:"err",reason:`install_${e.status}`};let o=await e.json();Lt(o.platform??null),_t({visitorId:n,platform:o.platform??"custom"});let r=await nt(`${t.apiBase}/v1/session`,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({merchantId:t.merchantId,domain:t.domain})});if(!r.ok)return{kind:"err",reason:`session_${r.status}`};let i=await r.json(),a=null;try{let s=await nt(`${t.apiBase}/v1/voice/token`,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({sessionId:i.sessionId,merchantId:t.merchantId,visitorId:n})});s.ok?a=await s.json():console.warn("[shoppingmate] voice unavailable \u2014 status",s.status)}catch(s){console.warn("[shoppingmate] voice unavailable \u2014",s)}return{kind:"ok",sessionId:i.sessionId,wsUrl:i.wsUrl,merchantStatus:o.status,personaId:o.personaId??a?.personaId??null,widgetPosition:o.widgetPosition??null,voice:a,visitorId:n}}catch(n){return{kind:"err",reason:n instanceof Error?n.message:"network"}}}function $t(t){let n=0,e=a=>{let s=Date.now();s-n<200||(n=s,t.send(a))},o=a=>{let s=a.target;if(!s)return;let c=dn(s),l=c?pn(c,t.hints):null;e({type:"visitor_action",sessionId:t.sessionId,action:"click",intentKey:l,url:window.location.href,elementLabel:c,timestamp:Date.now()})},r=()=>{e({type:"visitor_action",sessionId:t.sessionId,action:"route_change",intentKey:null,url:window.location.href,elementLabel:null,timestamp:Date.now()})},i=a=>{let s=a.target;if(!s)return;let c=s.tagName?.toLowerCase();c!=="input"&&c!=="textarea"&&c!=="select"||s.type==="password"||e({type:"visitor_action",sessionId:t.sessionId,action:"form_focus",intentKey:null,url:window.location.href,elementLabel:s.name||s.id||null,timestamp:Date.now()})};return document.addEventListener("click",o,{passive:!0,capture:!0}),window.addEventListener("popstate",r),document.addEventListener("focusin",i,{passive:!0}),()=>{document.removeEventListener("click",o,!0),window.removeEventListener("popstate",r),document.removeEventListener("focusin",i)}}function dn(t){return t.getAttribute("aria-label")??t.getAttribute("title")??(t.textContent??"").trim().slice(0,80)??null}function pn(t,n){let e=t.toLowerCase();if(n.has(e))return e;for(let o of n.keys())if(e.includes(o)||o.includes(e))return o;return null}var Ot={"calm-clinician":"Sage","calmosis-clinician":"Calmio",stylist:"Lumi",coach:"Kai",concierge:"Olivia",curator:"Theo",guide:"Maya",expert:"Arjun",host:"Ana"},un={"calmosis-clinician":"calm-clinician"};function mn(){let t="https://shoppingmate-web.vercel.app/widget/personas";return t&&typeof t=="string"?t.replace(/\/$/,""):"https://cdn.shoppingmate.ai/v1/personas"}var Dt={id:"pending",name:"Assistant",initial:"A",avatarUrl:""};function Vt(){return Dt}function Ut(t){if(!t||!Ot[t])return Dt;let n=Ot[t],e=un[t]??t;return{id:t,name:n,initial:n.charAt(0).toUpperCase(),avatarUrl:`${mn()}/${e}.png`}}var Ft=0,_=()=>(Ft+=1,`t${Ft}`);function fn(t,n){switch(n.type){case"set_mode":return{...t,mode:n.mode};case"set_voice_state":return n.state!=="idle"?{...t,voiceState:n.state,voiceError:null,invited:!1}:{...t,voiceState:n.state};case"set_connection":return{...t,connection:n.status};case"set_voice_error":return{...t,voiceError:n.error};case"set_invited":return{...t,invited:n.invited};case"reset":return{...t,transcript:[],thinking:!1,closed:!1,closedReason:null,checkoutUrl:null,capWarning:null};case"user_input":return{...t,transcript:[...t.transcript,{id:_(),role:"user",kind:"text",text:n.text,ts:Date.now()}]};case"agent_event":{let e=n.event;switch(e.type){case"thinking":return{...t,thinking:!0};case"end_of_turn":return{...t,thinking:!1};case"say":{let o=t.transcript[t.transcript.length-1];return o&&o.role==="agent"&&o.kind==="text"&&o.partial?{...t,thinking:!1,transcript:[...t.transcript.slice(0,-1),{...o,text:e.text,partial:!1,ts:Date.now()}]}:{...t,thinking:!1,transcript:[...t.transcript,{id:_(),role:"agent",kind:"text",text:e.text,ts:Date.now()}]}}case"say_partial":{let o=t.transcript[t.transcript.length-1];return o&&o.role==="agent"&&o.kind==="text"&&o.partial?{...t,thinking:!1,transcript:[...t.transcript.slice(0,-1),{...o,text:e.text,ts:Date.now()}]}:{...t,thinking:!1,transcript:[...t.transcript,{id:_(),role:"agent",kind:"text",text:e.text,ts:Date.now(),partial:!0}]}}case"user_text":return{...t,transcript:[...t.transcript,{id:_(),role:"user",kind:"text",text:e.text,ts:Date.now()}]};case"cards":return{...t,transcript:[...t.transcript,{id:_(),role:"agent",kind:"cards",items:e.items,ts:Date.now()}]};case"tool_result":return t;case"checkout_redirect":return{...t,checkoutUrl:e.url};case"cap_warning":return{...t,capWarning:{reason:e.reason,remaining:e.remaining},transcript:[...t.transcript,{id:_(),role:"system",kind:"cap_warning",remaining:e.remaining,ts:Date.now()}]};case"session_closed":return{...t,closed:!0,closedReason:e.reason,transcript:[...t.transcript,{id:_(),role:"system",kind:"closed",reason:e.reason,ts:Date.now()}]};default:return t}}default:return t}}function ot(t){let n={sessionId:t.sessionId,mode:"pill",voiceState:"idle",transcript:[],thinking:!1,closed:!1,closedReason:null,checkoutUrl:null,capWarning:null,connection:"connecting",voiceError:null,invited:!1},e=[];return{get:()=>n,dispatch:o=>{n=fn(n,o);for(let r of e)r(n)},subscribe:o=>(e.push(o),()=>{let r=e.indexOf(o);r>=0&&e.splice(r,1)})}}var qt=`
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

/* Hidden while the storefront's own cart drawer / cart page is open, so the
   launcher never covers the cart. Toggled from widget.ts by detecting the
   theme's cart-open state. */
.root.cart-open-hidden { opacity: 0; visibility: hidden; pointer-events: none; transition: opacity 150ms ease-out; }

/* Placement overrides \u2014 host sets data-position on <shoppingmate-widget>.
   Default is bottom-right. Center pins the tray to viewport middle. */
.root.pos-bottom-right { bottom: 20px; right: 20px; align-items: flex-end; }
.root.pos-bottom-left  { bottom: 20px; left: 20px; right: auto; align-items: flex-start; }
.root.pos-bottom-center{ bottom: 20px; left: 50%; right: auto; transform: translateX(-50%); align-items: center; }
.root.pos-center       { top: 50%; left: 50%; right: auto; bottom: auto; transform: translate(-50%, -50%); align-items: center; }
.root.pos-center-left  { top: 50%; left: 20px; right: auto; bottom: auto; transform: translateY(-50%); align-items: flex-start; }
.root.pos-center-right { top: 50%; right: 20px; left: auto; bottom: auto; transform: translateY(-50%); align-items: flex-end; }
.root.pos-top-right    { top: 20px; right: 20px; bottom: auto; align-items: flex-end; }
.root.pos-top-left     { top: 20px; left: 20px; bottom: auto; right: auto; align-items: flex-start; }

/* ---- Visitor-dragged placement ---- */
/* Once the visitor moves the launcher, inline left/top/right/bottom take over
   and these classes decide which way the panel stacks + how the tray aligns so
   the panel always opens toward screen-centre (never off-edge). */
.root.dragged { transform: none !important; }
.root.dragging { user-select: none; -webkit-user-select: none; }
.root.dock-bottom { flex-direction: column; }
.root.dock-top    { flex-direction: column-reverse; }
.root.dock-left   { align-items: flex-start; }
.root.dock-right  { align-items: flex-end; }
/* Grab affordance on the non-button areas of the launcher. */
.tray-meta { cursor: grab; }
.root.dragging .tray,
.root.dragging .tray * { cursor: grabbing !important; }
/* Pointer-drag hygiene: without these the browser starts a native image drag
   (the avatar <img>) or a text selection on first move, which cancels the
   pointer stream and makes the launcher "jump 1px then stop". Disable native
   drag + selection up front, and take over touch so the gesture isn't a scroll. */
.tray { touch-action: none; user-select: none; -webkit-user-select: none; }
.tray img { -webkit-user-drag: none; user-select: none; }

/* ---- Tray (always-visible launcher) ---- */
.tray {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  background: #0a0a0a;
  border: 1px solid rgba(255,255,255,0.08);
  border-radius: 9999px;
  padding: 6px 8px 6px 6px;
  box-shadow:
    0 24px 48px -16px rgba(0,0,0,0.65),
    0 8px 20px -8px rgba(0,0,0,0.5);
  animation: tray-in 280ms cubic-bezier(0.34, 1.56, 0.64, 1) both;
  transition: box-shadow 300ms ease-out, border-color 300ms ease-out, padding 200ms ease-out;
}

/* ---- Minimized launcher (collapse-to-avatar) ---- */
/* To stay out of the way of the page's own CTAs, the resting launcher shrinks
   to just the persona avatar after a few idle seconds (and on first load), then
   expands back to the full "Talk to {persona}" pill on hover / keyboard focus /
   tap. Scoped to phase-resting so a live call or an incoming-call invite always
   keep their controls \u2014 collapsing never hides an active call's buttons. */
.root.collapsed .tray.phase-resting { padding: 5px; gap: 0; }
.root.collapsed .tray.phase-resting .tray-meta,
.root.collapsed .tray.phase-resting .tray-controls { display: none; }
.root.collapsed .tray.phase-resting:hover,
.root.collapsed .tray.phase-resting:focus-within { padding: 6px 8px 6px 6px; gap: 10px; }
.root.collapsed .tray.phase-resting:hover .tray-meta,
.root.collapsed .tray.phase-resting:focus-within .tray-meta { display: flex; }
.root.collapsed .tray.phase-resting:hover .tray-controls,
.root.collapsed .tray.phase-resting:focus-within .tray-controls { display: flex; }
/* Incoming-call attention: magenta glow + a gentle breathing nudge so the
   launcher reads as "ringing" without being obnoxious. */
.tray.phase-incoming {
  border-color: rgba(232,121,249,0.45);
  box-shadow:
    0 24px 48px -16px rgba(0,0,0,0.65),
    0 0 0 1px rgba(232,121,249,0.25),
    0 0 28px -4px rgba(232,121,249,0.5);
  animation: tray-in 280ms cubic-bezier(0.34, 1.56, 0.64, 1) both, tray-ring 1.6s ease-in-out 0.3s infinite;
}
@keyframes tray-in {
  0% { opacity: 0; transform: translateY(8px) scale(0.96); }
  100% { opacity: 1; transform: translateY(0) scale(1); }
}
@keyframes tray-ring {
  0%, 100% { transform: translateY(0) scale(1); }
  50% { transform: translateY(-1px) scale(1.012); }
}

.tray-avatar {
  position: relative;
  width: 42px; height: 42px;
  border-radius: 9999px;
  border: none; padding: 0;
  cursor: pointer;
  background: transparent;
  flex-shrink: 0;
  transition: transform 200ms cubic-bezier(0.34, 1.56, 0.64, 1);
}
.tray-avatar:hover { transform: scale(1.04); }
.tray-avatar:active { transform: scale(0.96); }
/* Pink\u2192purple gradient ring (matches the reference). A slow spin gives the
   launcher a subtle "alive" feel; it stops under reduced-motion. */
.tray-avatar-ring {
  position: absolute; inset: 0;
  border-radius: 9999px;
  background: conic-gradient(from 0deg, #f0abfc, #a855f7, #6366f1, #f0abfc);
  z-index: 0;
  animation: ring-spin 6s linear infinite;
}
.phase-incoming .tray-avatar-ring { animation-duration: 2.4s; }
@keyframes ring-spin { to { transform: rotate(360deg); } }
.tray-avatar-img {
  position: absolute; inset: 2px;
  width: calc(100% - 4px); height: calc(100% - 4px);
  object-fit: cover;
  border-radius: 9999px;
  display: block;
  z-index: 1;
  background: #1a1a1a;
}
.tray-avatar-fallback {
  display: none;
  position: absolute; inset: 2px;
  width: calc(100% - 4px); height: calc(100% - 4px);
  place-items: center;
  border-radius: 9999px;
  background: linear-gradient(135deg, #2a2a2a, #1a1a1a);
  color: #fff;
  font-weight: 600; font-size: 16px;
  letter-spacing: 0.02em;
  z-index: 1;
}
.tray-presence {
  position: absolute;
  bottom: 0; right: 0;
  width: 11px; height: 11px;
  border-radius: 9999px;
  box-shadow: 0 0 0 2px #0a0a0a;
  z-index: 2;
}
.tray-presence.online {
  background: #22c55e;
  box-shadow: 0 0 0 2px #0a0a0a, 0 0 10px rgba(34,197,94,0.7);
  animation: pulse 2.4s ease-in-out infinite;
}
.tray-presence.offline {
  background: #52525b;
}
@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.55; }
}

.tray-meta {
  display: flex; flex-direction: column;
  line-height: 1.15;
  min-width: 0;
  margin-right: 2px;
}
.tray-name {
  font-size: 13px; font-weight: 600; color: #fafafa;
  letter-spacing: -0.01em;
  white-space: nowrap;
}
.tray-caption {
  font-size: 9.5px;
  text-transform: uppercase;
  letter-spacing: 0.18em;
  font-family: 'JetBrains Mono', ui-monospace, monospace;
  margin-top: 3px;
  white-space: nowrap;
}
.tray-caption.resting   { color: rgba(255,255,255,0.42); }
.tray-caption.thinking,
.tray-caption.connected { color: #22c55e; }
.tray-caption.retry     { color: #fb7185; }
.tray-caption.incoming  {
  color: #e879f9;
  animation: caption-blink 1.1s ease-in-out infinite;
}
@keyframes caption-blink {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.45; }
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
  margin-left: 2px;
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
.tray-btn:hover:not(:disabled) { background: rgba(255,255,255,0.12); transform: translateY(-1px); }
.tray-btn:active:not(:disabled) { transform: translateY(0) scale(0.96); }
.tray-btn:disabled { opacity: 0.45; cursor: default; }
.tray-btn.ghost { background: transparent; }
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

/* Green Call / Accept button \u2014 the ONLY control that starts a call. */
.tray-call {
  display: inline-flex; align-items: center; gap: 6px;
  height: 34px;
  padding: 0 14px 0 12px;
  border: none; border-radius: 9999px;
  background: #16a34a;
  color: #fff;
  font-family: inherit;
  font-size: 13px; font-weight: 600;
  letter-spacing: 0.01em;
  cursor: pointer;
  box-shadow: 0 6px 16px -6px rgba(22,163,74,0.8);
  transition: transform 150ms ease-out, background 150ms ease-out, box-shadow 150ms ease-out;
}
.tray-call:hover { background: #15803d; transform: translateY(-1px); }
.tray-call:active { transform: translateY(0) scale(0.97); }
.tray-call :where(svg) { width: 15px; height: 15px; }
.tray-call-label { line-height: 1; }
.phase-incoming .tray-call {
  background: #22c55e;
  box-shadow: 0 6px 18px -4px rgba(34,197,94,0.85);
  animation: call-pulse 1.6s ease-in-out infinite;
}
@keyframes call-pulse {
  0%, 100% { box-shadow: 0 6px 18px -4px rgba(34,197,94,0.55); }
  50% { box-shadow: 0 6px 22px -2px rgba(34,197,94,0.95); }
}

/* Connecting spinner \u2014 sits where the waveform/mic will be once live. */
.tray-spinner {
  width: 18px; height: 18px;
  border-radius: 9999px;
  border: 2px solid rgba(255,255,255,0.18);
  border-top-color: #22c55e;
  animation: spin 0.7s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }

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
.welcome-bullet {
  font: inherit;
  font-size: 13px; color: rgba(255,255,255,0.85);
  padding: 10px 12px;
  background: rgba(255,255,255,0.04);
  border: 1px solid rgba(255,255,255,0.06);
  border-radius: 10px;
  width: 100%;
  min-height: 44px; /* comfortable tap target on mobile */
  text-align: left;
  cursor: pointer;
  display: flex; align-items: center; justify-content: space-between; gap: 8px;
  transition: background 160ms ease, border-color 160ms ease, transform 120ms ease;
}
.welcome-bullet:hover { background: rgba(255,255,255,0.08); border-color: rgba(255,255,255,0.16); }
.welcome-bullet:active { transform: scale(0.985); }
.welcome-bullet:disabled { cursor: default; opacity: 0.55; }
.welcome-bullet-arrow {
  color: rgba(255,255,255,0.4); font-size: 14px; flex-shrink: 0;
  transition: transform 160ms ease, color 160ms ease;
}
.welcome-bullet:hover .welcome-bullet-arrow { color: rgba(255,255,255,0.7); transform: translateX(2px); }

.status-line {
  text-align: center;
  font-size: 11px;
  color: rgba(255,255,255,0.55);
  font-family: 'JetBrains Mono', ui-monospace, monospace;
  text-transform: uppercase;
  letter-spacing: 0.16em;
  padding: 18px 20px 8px;
}

/* ---- Failed-call card (image 4) ---- */
.call-error {
  margin: 18px 16px 8px;
  padding: 16px 16px 14px;
  border-radius: 14px;
  background: rgba(244,63,94,0.08);
  border: 1px solid rgba(244,63,94,0.22);
}
.call-error-title {
  margin: 0;
  font-size: 14px; font-weight: 600;
  color: #fafafa;
  letter-spacing: -0.01em;
}
.call-error-hint {
  margin: 6px 0 0;
  font-size: 12.5px; line-height: 1.4;
  color: rgba(255,255,255,0.6);
}

/* ---- "How can I help you?" prompt (image 5) ---- */
.call-prompt {
  padding: 24px 22px 8px;
}
.call-prompt-heading {
  margin: 0 0 12px;
  font-size: 19px; font-weight: 600;
  letter-spacing: -0.015em;
  color: #fafafa;
}
.call-prompt-bullets {
  list-style: none; padding: 0; margin: 0;
  display: grid; gap: 9px;
}
.call-prompt-bullets li {
  position: relative;
  padding-left: 18px;
  font-size: 13.5px; line-height: 1.35;
  color: rgba(255,255,255,0.82);
}
.call-prompt-bullets li::before {
  content: '';
  position: absolute; left: 2px; top: 7px;
  width: 6px; height: 6px; border-radius: 9999px;
  background: #22c55e;
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
  .tray, .tray.phase-incoming, .panel, .bubble, .tray-avatar, .tray-btn, .card, .input-row .send, .input-row input { animation: none !important; transition: none !important; }
  .tray-avatar-ring { animation: none !important; }
  .tray-caption.incoming { animation: none !important; }
  .tray-call, .phase-incoming .tray-call { animation: none !important; }
  .tray-spinner { animation: spin 1.2s linear infinite; }
  .tray-presence.online { animation: none !important; }
  .tray-waveform.active .bar { animation: none !important; }
}
`;var jt=[1e3,2e3,4e3,8e3,16e3],gn=5;function Bt(t,n){let e=null,o=0,r=!1,i=[];function a(){r||(n.onStatus(o>0?"reconnecting":"connecting"),e=new WebSocket(t),e.onopen=()=>{n.onStatus("connected"),o>0&&e?.send(JSON.stringify({type:"session_resume",sessionId:n.sessionId})),o=0;for(let s of i)e?.send(s);i=[]},e.onmessage=s=>n.onEvent(typeof s.data=="string"?s.data:""),e.onerror=()=>{},e.onclose=()=>{if(r)return;if(o+=1,o>=gn){n.onStatus("disconnected");return}let s=Math.min(o-1,jt.length-1),c=jt[s]??3e4;n.onStatus("reconnecting"),setTimeout(a,c)})}return a(),{send:s=>{e&&e.readyState===1?e.send(s):i.push(s)},close:()=>{r=!0,e?.close()}}}function hn(t,n,e,o,r,i,a=8){let s=Math.max(a,r-e-a),c=Math.max(a,i-o-a);return{x:Math.min(Math.max(a,t),s),y:Math.min(Math.max(a,n),c)}}function yn(t,n,e,o=8){let r=(t.left+t.right)/2,i=(t.top+t.bottom)/2,a=r>n/2?"right":"left",s=i>e/2?"bottom":"top",c=Math.max(o,a==="right"?n-t.right:t.left),l=Math.max(o,s==="bottom"?e-t.bottom:t.top);return{hSide:a,hVal:c,vSide:s,vVal:l}}function rt(t,n){t.classList.add("dragged"),t.style.transform="none",n.hSide==="right"?(t.style.right=`${n.hVal}px`,t.style.left="auto"):(t.style.left=`${n.hVal}px`,t.style.right="auto"),n.vSide==="bottom"?(t.style.bottom=`${n.vVal}px`,t.style.top="auto"):(t.style.top=`${n.vVal}px`,t.style.bottom="auto"),t.classList.toggle("dock-top",n.vSide==="top"),t.classList.toggle("dock-bottom",n.vSide==="bottom"),t.classList.toggle("dock-left",n.hSide==="left"),t.classList.toggle("dock-right",n.hSide==="right")}function Kt(t){try{let n=window.localStorage.getItem(t);if(!n)return null;let e=JSON.parse(n);if((e.hSide==="left"||e.hSide==="right")&&(e.vSide==="top"||e.vSide==="bottom")&&typeof e.hVal=="number"&&typeof e.vVal=="number")return e}catch{}return null}function bn(t,n){try{window.localStorage.setItem(t,JSON.stringify(n))}catch{}}function Wt(t,n){let e=n.offsetWidth||0,o=n.offsetHeight||0,r=window.innerWidth,i=window.innerHeight;return{...t,hVal:Math.min(Math.max(8,t.hVal),Math.max(8,r-e-8)),vVal:Math.min(Math.max(8,t.vVal),Math.max(8,i-o-8))}}function zt(t){let{root:n,surface:e,storageKey:o}=t,r=()=>e.querySelector(".tray")??e,i=Kt(o);i&&rt(n,Wt(i,r()));let a=0,s=0,c=0,l=0,u=!1,m=null,y=f=>{if(m!==null&&f.pointerId!==m)return;let b=f.clientX-a,k=f.clientY-s;if(!u&&Math.hypot(b,k)<6)return;if(!u)try{m!=null&&e.setPointerCapture(m)}catch{}u=!0,n.classList.add("dragging","dragged"),n.style.transform="none";let N=n.offsetWidth,$=n.offsetHeight,{x:fe,y:ge}=hn(c+b,l+k,N,$,window.innerWidth,window.innerHeight);n.style.left=`${fe}px`,n.style.top=`${ge}px`,n.style.right="auto",n.style.bottom="auto",n.classList.remove("dock-top","dock-bottom","dock-left","dock-right"),f.preventDefault()},d=f=>{if(window.removeEventListener("pointermove",y),window.removeEventListener("pointerup",d),m=null,!u)return;u=!1,n.classList.remove("dragging");let b=$=>{$.stopPropagation(),$.preventDefault()};e.addEventListener("click",b,{capture:!0,once:!0}),window.setTimeout(()=>e.removeEventListener("click",b,{capture:!0}),350);let k=r().getBoundingClientRect(),N=yn({top:k.top,left:k.left,right:k.right,bottom:k.bottom},window.innerWidth,window.innerHeight);rt(n,N),bn(o,N),f.preventDefault()},h=f=>{if(f.button!=null&&f.button!==0)return;let b=r().getBoundingClientRect();a=f.clientX,s=f.clientY,c=b.left,l=b.top,u=!1,m=f.pointerId??null,window.addEventListener("pointermove",y),window.addEventListener("pointerup",d)},E=()=>{let f=Kt(o);f&&rt(n,Wt(f,r()))};return e.addEventListener("pointerdown",h),window.addEventListener("resize",E),()=>{e.removeEventListener("pointerdown",h),window.removeEventListener("pointermove",y),window.removeEventListener("pointerup",d),window.removeEventListener("resize",E)}}var p={captionResting:"AI ASSISTANT",captionIncoming:"INCOMING CALL",captionThinking:"THINKING",captionConnected:"CONNECTED",captionRetry:"TAP TO RETRY",captionOffline:"OFFLINE",talkToPrefix:"Talk to",callCta:"Call",acceptCta:"Accept",callAria:"Start voice call",acceptAria:"Accept call",micMute:"Mute mic",micUnmute:"Unmute mic",retryAria:"Retry call",endCallAria:"End call",closeAria:"Close",openAria:"Open shoppingmate",callFailedTitle:"Could not start the call. Please try again.",callHelpHeading:"How can I help you?",callBullets:["Find the right product","Compare options out loud","Check out on this page"],panelHelpHeading:"Hi, I'm",panelHelpSubtitle:"I'm here to help you:",panelBullets:["Find the right product fast","Compare options out loud","Check out without leaving the page"],panelPrompts:["Help me find the right product","Can you compare your products for me?","I'd like to check out"],poweredBy:"Powered by shoppingmate",chatPlaceholder:"Type a quick question\u2026",reconnecting:"Reconnecting\u2026",disconnected:"Connection lost \u2014 reload to retry",closed:{user:"Conversation ended",cap:"Time to wrap up \u2014 reload for a new chat",error:"Something went wrong"},payNow:"Pay now \u2192",capWarning:"A couple minutes left",thinking:"thinking\u2026",micDenied:"Mic blocked \u2014 switching to text"};var v=t=>`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${t}</svg>`,Gt=v('<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>'),Yt=v('<path d="M18 6 6 18"/><path d="m6 6 12 12"/>'),Jt=v('<path d="M5 12h14"/>'),Xt=v('<path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>'),Qt=v('<path d="M10.68 13.31a16 16 0 0 0 3.41 2.6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7 2 2 0 0 1 1.72 2v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.42 19.42 0 0 1-3.33-2.67"/><path d="M5 5a2 2 0 0 1 2-2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L10.9 11.1"/><line x1="22" y1="2" x2="2" y2="22"/>'),Zt=v('<path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="22"/>'),te=v('<line x1="2" y1="2" x2="22" y2="22"/><path d="M18.89 13.23A7.12 7.12 0 0 0 19 12v-2"/><path d="M5 10v2a7 7 0 0 0 12 5"/><path d="M15 9.34V5a3 3 0 0 0-5.68-1.33"/><path d="M9 9v3a3 3 0 0 0 5.12 2.12"/><line x1="12" y1="19" x2="12" y2="22"/>'),ee=v('<path d="M22 2 11 13"/><path d="M22 2l-7 20-4-9-9-4 20-7z"/>');function j(t){return t.replace(/[&<>"']/g,n=>n==="&"?"&amp;":n==="<"?"&lt;":n===">"?"&gt;":n==='"'?"&quot;":"&#39;")}function vn(t,n){let e=document.createElement("button");return e.className="card",e.type="button",e.dataset.sku=t.sku,e.innerHTML=`
    ${t.image?`<img src="${j(t.image)}" alt="${j(t.title)}" />`:'<div class="card-img-fallback"></div>'}
    <div class="title">${j(t.title)}</div>
    <div class="price">${j(t.priceFormatted)}</div>
  `,e.addEventListener("click",()=>n({sku:t.sku,variantId:t.variantId})),e}function kn(t,n){if(t.kind==="text"){let o=document.createElement("div");return o.className=`bubble ${t.role}`,o.textContent=t.text,o}if(t.kind==="cards"){let o=document.createElement("div");o.className="cards-row";for(let r of t.items)o.appendChild(vn(r,n));return o}if(t.kind==="cap_warning"){let o=document.createElement("div");return o.className="bubble system",o.textContent=p.capWarning,o}let e=document.createElement("div");return e.className="bubble system",e.textContent=p.closed[t.reason],e}var ne=new WeakMap;function B(t,n,e){let o=ne.get(t)??[],r=new Map(o.map(c=>[c.id,c])),i=new Set(n.map(c=>c.id));for(let c of o)i.has(c.id)||c.el.remove();let a=[],s=!1;for(let c=0;c<n.length;c++){let l=n[c];if(!l)continue;let u=r.get(l.id);if(u)l.kind==="text"&&u.text!==l.text&&(u.el.textContent=l.text,u.text=l.text,s=!0),a.push(u);else{let m=kn(l,e);t.appendChild(m),a.push({id:l.id,el:m,text:l.kind==="text"?l.text:void 0}),s=!0}}ne.set(t,a),s&&(t.scrollTop=t.scrollHeight)}function xn(t){switch(t){case"mic_policy_blocked":return"Voice is disabled on this page \u2014 text chat still works.";case"mic_denied":return"Microphone blocked. Allow mic access in your browser, then tap Call.";case"mic_unavailable":return"No microphone found \u2014 check your audio device, then tap Call.";case"connect_failed":return"Couldn't reach voice. Tap Call to retry.";default:return"Tap Call to try again."}}function oe(t){return t.muted?"you're muted":t.voiceState==="connecting"?`connecting to ${t.personaName}\u2026`:t.voiceState==="speaking"?`${t.personaName} is speaking\u2026`:t.voiceState==="listening"?`${t.personaName} is listening\u2026`:`${t.personaName} is ready`}function re(t){return t.voiceState==="idle"&&t.voiceError?"error":t.transcript.length===0?"prompt":"transcript"}function wn(t){return`${re(t)}|${t.checkoutUrl??""}|${t.personaName}|${t.voiceError?.code??""}`}function ie(t,n){let e=wn(n),o=re(n);if(t.dataset.chromeKey!==e){let a=o==="error"?`
          <div class="call-error">
            <p class="call-error-title">${p.callFailedTitle}</p>
            <p class="call-error-hint">${xn(n.voiceError?.code??"unknown")}</p>
          </div>`:"",s=o==="prompt"?`
          <div class="call-prompt">
            <h2 class="call-prompt-heading">${p.callHelpHeading}</h2>
            <ul class="call-prompt-bullets">
              ${p.callBullets.map(l=>`<li>${l}</li>`).join("")}
            </ul>
          </div>`:"",c=o!=="transcript";t.innerHTML=`
      <div class="panel call-panel">
        <button class="panel-close" data-action="close" aria-label="${p.closeAria}">${Jt}</button>
        ${a}
        ${s}
        <div class="status-line ${o==="error"?"hidden":""}" data-region="status">${oe(n)}</div>
        <div class="transcript ${c?"hidden":""}" data-region="transcript" aria-live="polite"></div>
        ${n.checkoutUrl?`<a class="checkout-cta" data-action="checkout" href="${n.checkoutUrl}" target="_blank" rel="noopener">${p.payNow}</a>`:""}
        <div class="panel-footer">${p.poweredBy}</div>
      </div>
    `,t.querySelector('[data-action="close"]')?.addEventListener("click",n.onClose),t.querySelector('[data-action="checkout"]')?.addEventListener("click",n.onCheckout),t.dataset.chromeKey=e}let r=t.querySelector('[data-region="status"]');if(r instanceof HTMLElement){let a=oe(n);r.textContent!==a&&(r.textContent=a)}let i=t.querySelector('[data-region="transcript"]');i instanceof HTMLElement&&o==="transcript"&&B(i,n.transcript,n.onCardTap)}function _n(t){return`${t.transcript.length===0?"1":"0"}|${t.checkoutUrl??""}|${t.closed?"1":"0"}|${t.personaName}|${t.personaInitial}|${t.personaAvatarUrl}`}function ae(t,n){let e=_n(n);if(t.dataset.chromeKey!==e){let r=n.transcript.length===0,i=p.panelBullets.map((l,u)=>`<button type="button" class="welcome-bullet" data-prompt="${u}" ${n.closed?"disabled":""}>${l}<span class="welcome-bullet-arrow" aria-hidden="true">\u2192</span></button>`).join(""),a=r?`
        <div class="welcome">
          <div class="welcome-avatar">
            <img src="${n.personaAvatarUrl}" alt="" onerror="this.style.display='none'; this.nextElementSibling.style.display='grid';" />
            <span class="welcome-avatar-fallback" aria-hidden="true">${n.personaInitial}</span>
          </div>
          <h2 class="welcome-heading">${p.panelHelpHeading} ${n.personaName}.</h2>
          <p class="welcome-sub">${p.panelHelpSubtitle}</p>
          <div class="welcome-bullets">${i}</div>
        </div>
      `:"";t.innerHTML=`
      <div class="panel">
        <button class="panel-close" data-action="close" aria-label="${p.closeAria}">${Yt}</button>
        ${a}
        <div class="transcript ${r?"transcript-empty":""}" data-region="transcript" aria-live="polite"></div>
        ${n.checkoutUrl?`<a class="checkout-cta" href="${n.checkoutUrl}" target="_blank" rel="noopener">${p.payNow}</a>`:""}
        <form class="input-row">
          <input type="text" placeholder="${p.chatPlaceholder}" ${n.closed?"disabled":""} />
          <button class="send" type="submit" aria-label="Send" ${n.closed?"disabled":""}>${ee}</button>
        </form>
        <div class="panel-footer">${p.poweredBy}</div>
      </div>
    `,t.querySelector('[data-action="close"]')?.addEventListener("click",n.onClose),t.querySelectorAll(".welcome-bullet").forEach(l=>{l.addEventListener("click",()=>{if(n.closed)return;let u=Number(l.dataset.prompt),m=p.panelPrompts[u]??p.panelBullets[u];m&&n.onSend(m)})});let s=t.querySelector("form"),c=t.querySelector("input");s instanceof HTMLFormElement&&c instanceof HTMLInputElement&&s.addEventListener("submit",l=>{l.preventDefault();let u=c.value.trim();u&&(c.value="",n.onSend(u))}),t.dataset.chromeKey=e}let o=t.querySelector('[data-region="transcript"]');o instanceof HTMLElement&&B(o,n.transcript,n.onCardTap)}function Sn(t){return t.voiceState==="connecting"?"connecting":t.voiceState!=="idle"?"connected":t.voiceError?"error":t.invited?"incoming":"resting"}function Cn(t,n){return[n,t.mode,t.callable?"1":"0",t.voiceState,t.connection,t.invited?"1":"0",t.personaName,t.personaInitial,t.personaAvatarUrl].join("|")}function Tn(t,n){let e=t.voiceState==="muted",o=t.voiceState==="speaking",r=t.connection==="disconnected",i=(y,d)=>`
    <button class="tray-call" data-action="call" aria-label="${d}">
      ${Xt}<span class="tray-call-label">${y}</span>
    </button>`,a=`
    <button class="tray-btn ghost" data-action="chat" aria-label="${p.openAria}">${Gt}</button>`,s=y=>`
    <button class="tray-btn ${e?"muted":""}" data-action="mic" ${y?"disabled":""}
      aria-pressed="${e}" aria-label="${e?p.micUnmute:p.micMute}">${e?te:Zt}</button>`,c=`
    <button class="tray-btn end" data-action="end" aria-label="${p.endCallAria}">${Qt}</button>`,l='<span class="tray-spinner" aria-hidden="true"></span>',u=`
    <div class="tray-waveform active ${o?"speaking":""}" aria-hidden="true">
      ${Array.from({length:14}).map(()=>'<span class="bar"></span>').join("")}
    </div>`,m=r?"offline":"online";switch(n){case"incoming":return{caption:p.captionIncoming,captionClass:"incoming",presenceClass:m,nameText:t.personaName,controls:`${i(p.acceptCta,p.acceptAria)}${a}`};case"connecting":return{caption:p.captionThinking,captionClass:"thinking",presenceClass:"online",nameText:t.personaName,controls:`${l}${s(!0)}${c}`};case"connected":return{caption:p.captionConnected,captionClass:"connected",presenceClass:"online",nameText:t.personaName,controls:`${u}${s(!1)}${c}`};case"error":return{caption:p.captionRetry,captionClass:"retry",presenceClass:"offline",nameText:t.personaName,controls:`${i(p.callCta,p.retryAria)}${c}`};default:return{caption:r?p.captionOffline:p.captionResting,captionClass:r?"retry":"resting",presenceClass:m,nameText:`${p.talkToPrefix} ${t.personaName}`,controls:t.callable?i(p.callCta,p.callAria):a}}}function se(t,n){let e=Sn(n),o=Cn(n,e);if(t.dataset.trayKey===o)return;let r=Tn(n,e),i=n.mode==="chat"||n.mode==="call"||n.mode==="expanded";t.innerHTML=`
    <div class="tray phase-${e}" role="region" aria-label="shoppingmate">
      <button class="tray-avatar" data-action="toggle" aria-expanded="${i}" aria-label="${p.openAria}">
        <span class="tray-avatar-ring" aria-hidden="true"></span>
        <img src="${n.personaAvatarUrl}" alt="" class="tray-avatar-img" draggable="false" onerror="this.style.display='none'; this.nextElementSibling.style.display='grid';" />
        <span class="tray-avatar-fallback" aria-hidden="true">${n.personaInitial}</span>
        <span class="tray-presence ${r.presenceClass}"></span>
      </button>
      <div class="tray-meta">
        <div class="tray-name">${r.nameText}</div>
        <div class="tray-caption ${r.captionClass}">${r.caption}</div>
      </div>
      <div class="tray-controls">${r.controls}</div>
    </div>
  `,t.querySelector('[data-action="toggle"]')?.addEventListener("click",()=>{i?n.onClose():n.onChat()}),t.querySelector('[data-action="call"]')?.addEventListener("click",n.onCall),t.querySelector('[data-action="chat"]')?.addEventListener("click",n.onChat),t.querySelector('[data-action="mic"]')?.addEventListener("click",()=>{n.onMute(n.voiceState!=="muted")}),t.querySelector('[data-action="end"]')?.addEventListener("click",n.onEnd),t.dataset.trayKey=o}var ce="shoppingmate-widget",le="SM-XPK2EN",de="SM-2SCCLZ",pe=new Set(["bottom-right","bottom-left","bottom-center","center","center-left","center-right","top-right","top-left"]),An=6e3,En=12e3,Mn=["cart-sidebar-show","cart-open","cart--open","cart-drawer-open","cart-drawer--active","cart-drawer-is-open","js-drawer-open","drawer-open","drawer--open","js-drawer-open-right","cart-active","is-cart-open","cart-is-open","cart-visible","show-cart","cart-show","mini-cart-active","minicart-active","mini-cart--active","ajaxcart-open","header-cart-open"];function In(){try{let t=window.location.pathname||"";if(t==="/cart"||t.startsWith("/cart/")||t.startsWith("/cart?"))return!0;let n=`${document.documentElement.className} ${document.body?document.body.className:""}`.toLowerCase();return Mn.some(e=>n.includes(e))}catch{return!1}}function ue(){return"live-kit"==="web-speech"?"web-speech":"live-kit"}var it=class extends HTMLElement{constructor(){super(...arguments);g(this,"rootEl",null);g(this,"pillHost",null);g(this,"panelHost",null);g(this,"store",ot({sessionId:"pending"}));g(this,"socket",null);g(this,"voiceMode",S(null,O()));g(this,"voice",null);g(this,"persona",Vt());g(this,"apiBase","");g(this,"merchantId","");g(this,"domain",window.location.host);g(this,"stopActivityTracker",null);g(this,"inviteTimer",null);g(this,"inviteDismissTimer",null);g(this,"collapseTimer",null);g(this,"stopCollapse",null);g(this,"cartObserver",null);g(this,"stopDrag",null);g(this,"ambience",W(!1));g(this,"onCartVisibilityChange",()=>{if(!this.rootEl)return;let e=this.store.get(),o=e.mode==="call"||e.voiceState!=="idle";this.rootEl.classList.toggle("cart-open-hidden",In()&&!o)})}connectedCallback(){if(this.shadowRoot)return;let e=this.getAttribute("data-id"),o=this.getAttribute("data-api")??this.apiBase;if(!e){console.warn("[shoppingmate] data-id missing on widget element");return}this.merchantId=e,this.apiBase=o,this.ambience=W(this.getAttribute("data-ambience")!=="off");let r=this.attachShadow({mode:"open"}),i=document.createElement("style");i.textContent=qt,r.appendChild(i);let a=document.createElement("div"),s=this.merchantId===de?"center-left":"bottom-right",c=(this.getAttribute("data-position")??s).toLowerCase(),l=pe.has(c)?`pos-${c}`:"pos-bottom-right";a.className=`root ${l}`,r.appendChild(a),this.rootEl=a,this.panelHost=document.createElement("div"),this.pillHost=document.createElement("div"),a.appendChild(this.panelHost),a.appendChild(this.pillHost),this.store.subscribe(()=>this.render()),this.render(),this.stopDrag=zt({root:a,surface:this.pillHost,storageKey:`sm-widget-pos:${this.merchantId}`}),this.stopCollapse=this.setupAutoCollapse(a,this.pillHost),this.setupCartVisibility(a),ue()==="live-kit"&&ct(),this.start()}applyServerPosition(e){let o=this.rootEl;if(!o||o.classList.contains("dragged"))return;let r=e.toLowerCase();if(pe.has(r)){for(let i of Array.from(o.classList))i.startsWith("pos-")&&o.classList.remove(i);o.classList.add(`pos-${r}`)}}disconnectedCallback(){this.socket?.close(),this.voiceMode.stop(),this.ambience.stop(),this.stopActivityTracker?.(),this.inviteTimer&&clearTimeout(this.inviteTimer),this.inviteDismissTimer&&clearTimeout(this.inviteDismissTimer),this.collapseTimer&&clearTimeout(this.collapseTimer),this.stopCollapse?.(),this.cartObserver?.disconnect(),window.removeEventListener("popstate",this.onCartVisibilityChange),this.stopDrag?.()}setupCartVisibility(e){this.onCartVisibilityChange(),this.cartObserver=new MutationObserver(this.onCartVisibilityChange),this.cartObserver.observe(document.documentElement,{attributes:!0,attributeFilter:["class"]}),document.body&&this.cartObserver.observe(document.body,{attributes:!0,attributeFilter:["class"]}),window.addEventListener("popstate",this.onCartVisibilityChange)}setupAutoCollapse(e,o){let r=()=>{this.collapseTimer&&clearTimeout(this.collapseTimer),this.collapseTimer=setTimeout(()=>e.classList.add("collapsed"),An)},i=()=>{e.classList.remove("collapsed"),r()};return o.addEventListener("pointerenter",i),o.addEventListener("pointerdown",i),o.addEventListener("focusin",i),o.addEventListener("pointerleave",r),r(),()=>{o.removeEventListener("pointerenter",i),o.removeEventListener("pointerdown",i),o.removeEventListener("focusin",i),o.removeEventListener("pointerleave",r)}}async start(){let e=await Nt({apiBase:this.apiBase,merchantId:this.merchantId,domain:this.domain});if(e.kind==="err"){console.warn("[shoppingmate] bootstrap failed:",e.reason);return}this.store=ot({sessionId:e.sessionId}),this.store.subscribe(()=>this.render()),this.voice=e.voice,this.persona=Ut(e.personaId??e.voice?.personaId??null),e.widgetPosition&&this.applyServerPosition(e.widgetPosition);let o=ue(),r=M();if(o==="live-kit"&&this.voice){let i=V({stack:"live-kit",livekit:{sessionId:e.sessionId,wsUrl:this.voice.wsUrl,token:this.voice.token,roomName:this.voice.roomName,onTranscriptEvent:a=>this.handleLiveKitData(a)}});i&&(this.voiceMode=i,this.voiceMode.warm?.())}else{let i=V({stack:"web-speech"});i&&(this.voiceMode=i),r?.onFinal(a=>{this.store.dispatch({type:"user_input",text:a,mode:"voice"}),this.socket?.send(x({type:"user_text",sessionId:e.sessionId,text:a,mode:"voice",visitorId:I()}))})}this.voiceMode.onStateChange(i=>this.store.dispatch({type:"set_voice_state",state:i})),this.voiceMode.onError?.(i=>{console.warn("[shoppingmate] voice error",i),this.store.dispatch({type:"set_voice_error",error:i})}),this.socket=Bt(e.wsUrl,{sessionId:e.sessionId,onEvent:i=>{let a=K(i);a&&this.handleAgentEvent(a)},onStatus:i=>this.store.dispatch({type:"set_connection",status:i})}),(this.merchantId===le||this.merchantId===de)&&(this.inviteTimer=setTimeout(()=>{this.store.get().voiceState==="idle"&&this.store.get().mode==="pill"&&(this.store.dispatch({type:"set_invited",invited:!0}),this.inviteDismissTimer=setTimeout(()=>{let i=this.store.get();i.invited&&i.voiceState==="idle"&&i.mode==="pill"&&this.store.dispatch({type:"set_invited",invited:!1})},En))},5e3)),this.stopActivityTracker=$t({sessionId:e.sessionId,hints:new Map,send:i=>this.publishWidgetMessage(i)})}async handleAgentEvent(e,o="ws"){if(e.type==="host_action_request"){let r=await Ht(e.action);this.publishWidgetMessage({type:"host_action_result",callId:e.callId,result:r},o);return}if(e.type!=="persona_swap"&&e.type!=="agent_warmed"){if(e.type==="agent_ready"){this.voiceMode.signalAgentReady?.();return}this.store.dispatch({type:"agent_event",event:e}),e.type==="say"&&this.voiceMode.speak(e.text)}}publishWidgetMessage(e,o="ws"){let r=x(e);if(o==="livekit"&&this.voiceMode.publishData){let i=new TextEncoder().encode(r);this.voiceMode.publishData(i);return}this.socket?.send(r)}render(){if(!this.pillHost||!this.panelHost)return;let e=this.store.get();this.onCartVisibilityChange();let o=M()!==null;e.mode==="call"?ie(this.panelHost,{voiceState:e.voiceState,muted:e.voiceState==="muted",transcript:e.transcript,checkoutUrl:e.checkoutUrl,personaName:this.persona.name,voiceError:e.voiceError,onClose:()=>this.store.dispatch({type:"set_mode",mode:"pill"}),onCardTap:r=>this.cardTap(r),onCheckout:()=>{}}):e.mode==="chat"||e.mode==="expanded"?ae(this.panelHost,{transcript:e.transcript,checkoutUrl:e.checkoutUrl,personaName:this.persona.name,personaInitial:this.persona.initial,personaAvatarUrl:this.persona.avatarUrl,onSend:r=>this.userText(r,"text"),onCall:()=>this.openCall(),onClose:()=>this.store.dispatch({type:"set_mode",mode:"pill"}),onCardTap:r=>this.cardTap(r),closed:e.closed}):this.panelHost.innerHTML="",se(this.pillHost,{mode:e.mode,callable:o,voiceState:e.voiceState,connection:e.connection,voiceError:e.voiceError,invited:e.invited,personaName:this.persona.name,personaInitial:this.persona.initial,personaAvatarUrl:this.persona.avatarUrl,onCall:()=>this.openCall(),onMute:r=>this.voiceMode.setMuted(r),onEnd:()=>{this.voiceMode.stop(),this.ambience.stop(),this.store.dispatch({type:"set_mode",mode:"pill"})},onChat:()=>{e.invited&&this.store.dispatch({type:"set_invited",invited:!1}),this.store.dispatch({type:"set_mode",mode:"chat"})},onClose:()=>this.store.dispatch({type:"set_mode",mode:"pill"})})}openCall(){this.store.get().invited&&(this.merchantId===le&&this.publishWidgetMessage({type:"tour_request"}),this.store.dispatch({type:"set_invited",invited:!1})),this.inviteTimer&&(clearTimeout(this.inviteTimer),this.inviteTimer=null),this.store.dispatch({type:"set_mode",mode:"call"}),this.voiceMode.start(),this.ambience.start()}userText(e,o){this.store.dispatch({type:"user_input",text:e,mode:o});let r=this.store.get().sessionId;this.socket?.send(x({type:"user_text",sessionId:r,text:e,mode:o,visitorId:I()}))}handleLiveKitData(e){let o;try{o=new TextDecoder().decode(e)}catch{return}let r=K(o);r&&this.handleAgentEvent(r,"livekit")}cardTap(e){let o=this.store.get().sessionId;this.socket?.send(x({type:"card_tap",sessionId:o,action:"cartAdd",sku:e.sku,variantId:e.variantId,qty:1}))}};function me(){customElements.get(ce)||customElements.define(ce,it)}function Ln(){let t=document.currentScript instanceof HTMLScriptElement?document.currentScript:null,n=t?.dataset.id;if(!n){console.warn("[shoppingmate] data-id missing on script tag");return}let o=(t?.dataset.api??"https://api-production-1ea1.up.railway.app").trim(),r=document.querySelector("shoppingmate-widget");r&&(r.getAttribute("data-api")||r.setAttribute("data-api",o),r.getAttribute("data-id")||r.setAttribute("data-id",n)),me();let i=()=>{let a=document.querySelector("shoppingmate-widget");if(a){a.getAttribute("data-api")||a.setAttribute("data-api",o),a.getAttribute("data-id")||a.setAttribute("data-id",n);return}let s=document.createElement("shoppingmate-widget");s.setAttribute("data-id",n),s.setAttribute("data-api",o),document.body.appendChild(s)};document.readyState==="loading"?document.addEventListener("DOMContentLoaded",i,{once:!0}):i()}Ln();})();
