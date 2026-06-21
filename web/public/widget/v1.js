"use strict";(()=>{var et=Object.defineProperty;var tt=(e,n,t)=>n in e?et(e,n,{enumerable:!0,configurable:!0,writable:!0,value:t}):e[n]=t;var g=(e,n,t)=>tt(e,typeof n!="symbol"?n+"":n,t);function A(){let e=globalThis,n=e.SpeechRecognition??e.webkitSpeechRecognition;if(!n)return null;let t=new n;t.continuous=!0,t.interimResults=!1,t.lang="en-US";let o=!1,i=[],r=[];return t.onresult=a=>{for(let s=0;s<a.results.length;s+=1){let c=a.results[s];if(c?.isFinal){let d=c[0]?.transcript?.trim();if(d)for(let u of i)u(d)}}},t.onerror=a=>{for(let s of r)s(String(a?.error??"unknown"))},t.onend=()=>{o=!1},{start:()=>{if(!o){o=!0;try{t.start()}catch{}}},stop:()=>{if(o){o=!1;try{t.stop()}catch{}}},onFinal:a=>{i.push(a)},onError:a=>{r.push(a)},isActive:()=>o}}function N(){let e=globalThis.speechSynthesis;if(!e)return{speak:async()=>{},cancel:()=>{},available:()=>!1};function n(){if(!e)return null;let t=e.getVoices();return t.find(o=>o.lang.startsWith("en-")&&o.default)??t.find(o=>o.lang.startsWith("en-"))??t[0]??null}return{speak:t=>new Promise(o=>{let i=new SpeechSynthesisUtterance(t),r=n();r&&(i.voice=r),i.rate=1,i.onend=()=>o(),i.onerror=()=>o(),e.speak(i)}),cancel:()=>e.cancel(),available:()=>!0}}function S(e,n){let t="idle",o=!1,i=[],r=a=>{if(t!==a){t=a;for(let s of i)s(a)}};return{start:()=>{if(t==="idle"){if(o){r("muted");return}e?.start(),r("listening")}},stop:()=>{e?.stop(),n.cancel(),r("idle")},speak:async a=>{t!=="idle"&&(e?.stop(),r("speaking"),await n.speak(a),o?r("muted"):(e?.start(),r("listening")))},setMuted:a=>{o=a,a?(e?.stop(),t==="listening"&&r("muted")):t==="muted"&&(e?.start(),r("listening"))},getState:()=>t,onStateChange:a=>{i.push(a)}}}function nt(e){if(!e||typeof e.type!="string")return!1;switch(e.type){case"navigate":return typeof e.path=="string";case"scroll_to":case"highlight":case"click":case"point_at":case"demo_click":return typeof e.intent=="string";case"cart_add":case"cart_set_qty":return typeof e.sku=="string"&&typeof e.qty=="number";case"open_cart":case"cart_clear":case"checkout_place":case"checkout_state":return!0;case"apply_coupon":return typeof e.code=="string";case"checkout_fill":return!!e.details&&typeof e.details.name=="string"&&typeof e.details.phone=="string"&&typeof e.details.email=="string"&&typeof e.details.address=="string"&&typeof e.details.city=="string"&&typeof e.details.state=="string"&&typeof e.details.pincode=="string"&&(e.details.payment==="cod"||e.details.payment==="prepaid");case"form_fill":return Array.isArray(e.fields)&&e.fields.every(n=>n&&typeof n.field=="string"&&typeof n.value=="string");case"form_read":return e.fields===void 0||Array.isArray(e.fields);default:return!1}}function k(e){return JSON.stringify(e)}function K(e){let n;try{n=JSON.parse(e)}catch{return null}if(!n||typeof n!="object")return null;let t=n;switch(t.type){case"thinking":return{type:"thinking"};case"say":return typeof t.text=="string"?{type:"say",text:t.text}:null;case"say_partial":return typeof t.text=="string"?{type:"say_partial",text:t.text}:null;case"user_text":return typeof t.text=="string"?{type:"user_text",text:t.text}:null;case"cards":return Array.isArray(t.items)?{type:"cards",items:t.items}:null;case"tool_result":return typeof t.toolName!="string"||typeof t.ok!="boolean"?null:{type:"tool_result",toolName:t.toolName,ok:t.ok,summary:typeof t.summary=="string"?t.summary:void 0};case"checkout_redirect":return typeof t.url=="string"?{type:"checkout_redirect",url:t.url}:null;case"cap_warning":return t.reason!=="turns"&&t.reason!=="voice_ms"&&t.reason!=="duration_ms"||typeof t.remaining!="number"?null:{type:"cap_warning",reason:t.reason,remaining:t.remaining};case"end_of_turn":return{type:"end_of_turn"};case"session_closed":return t.reason!=="user"&&t.reason!=="cap"&&t.reason!=="error"?null:{type:"session_closed",reason:t.reason};case"host_action_request":{if(typeof t.callId!="string"||!t.action)return null;let o=t.action;return nt(o)?{type:"host_action_request",callId:t.callId,action:o}:null}case"persona_swap":return typeof t.personaId=="string"?{type:"persona_swap",personaId:t.personaId}:null;case"agent_warmed":return{type:"agent_warmed"};case"agent_ready":return{type:"agent_ready"};default:return null}}var Z="https://cdn.jsdelivr.net/npm",ot="2.7.0",rt="0.3.0",$=null;function it(){return $||($=import(`${Z}/@livekit/krisp-noise-filter@${rt}/dist/index.mjs`).catch(()=>null),$)}async function at(e){let n=await it();if(!n?.KrispNoiseFilter||n.isKrispNoiseFilterSupported&&!n.isKrispNoiseFilterSupported())return;let t=e.localParticipant.getTrackPublication?.("microphone"),o=t?.audioTrack??t?.track;o?.setProcessor&&await o.setProcessor(n.KrispNoiseFilter())}var w=null;function ee(){return w||(typeof globalThis.__SHOPPINGMATE_LIVEKIT_LOADER__=="function"?(w=globalThis.__SHOPPINGMATE_LIVEKIT_LOADER__(),w):(w=import(`${Z}/livekit-client@${ot}/dist/livekit-client.esm.mjs`),w))}function te(){ee().catch(()=>{w=null})}async function ne(e){let n=await ee(),t=new n.Room({audioCaptureDefaults:{echoCancellation:!0,noiseSuppression:!0,autoGainControl:!0,channelCount:1}}),o=new Map;t.on("trackSubscribed",r=>{let a=r;if(a.kind!=="audio")return;let s=a.attach();s.style.display="none",document.body.appendChild(s),o.set(r,s)}),t.on("trackUnsubscribed",r=>{let a=o.get(r);a&&(a.remove(),o.delete(r)),r.detach?.()});let i=[];return t.on("activeSpeakersChanged",r=>{let s=(r??[]).some(c=>!c.isLocal);for(let c of i)c(s)}),await t.connect(e.wsUrl,e.token),{setMicEnabled:async r=>{await t.localParticipant.setMicrophoneEnabled(r),r&&at(t).catch(()=>{})},onData:r=>{t.on("dataReceived",a=>{a instanceof Uint8Array&&r(a)})},onAgentSpeaking:r=>{i.push(r)},publishData:r=>t.localParticipant.publishData(r,{reliable:!0}),disconnect:async()=>{for(let r of o.values())r.remove();o.clear(),await t.disconnect()}}}function oe(e){let n="idle",t=null,o=null,i=!1,r=!1,a=[],s=[],c=l=>{if(n!==l){n=l;for(let m of a)m(l)}},d=l=>{let m=l instanceof Error?l.message:String(l),h=l instanceof Error?l.name:"",y;/permissions? policy|feature policy/i.test(m)?y="mic_policy_blocked":h==="NotAllowedError"||/denied|permission/i.test(m)?y="mic_denied":h==="NotFoundError"||/no.*microphone|not.*found/i.test(m)?y="mic_unavailable":/connect|network|websocket|timeout|token/i.test(m)?y="connect_failed":y="unknown";for(let H of s)H({code:y,message:m})},u=()=>t?Promise.resolve(t):o||(o=(async()=>{let l=await ne({wsUrl:e.wsUrl,token:e.token,roomName:e.roomName});return l.onData(m=>e.onTranscriptEvent(m)),l.onAgentSpeaking(m=>{i||(m&&(r=!0),r&&c(m?"speaking":"listening"))}),t=l,l})(),o.catch(()=>{o=null}),o);return{warm:()=>{u().catch(l=>console.warn("[voiceModeLiveKit] warm failed",l))},start:()=>{n==="idle"&&(c("connecting"),r=!1,(async()=>{try{let l=await u();await l.setMicEnabled(!i);let m=new TextEncoder().encode(k({type:"start_voice",sessionId:e.sessionId}));await l.publishData(m),i&&c("muted")}catch(l){throw c("idle"),d(l),l}})().catch(l=>{console.warn("[voiceModeLiveKit] start failed",l)}))},stop:()=>{t?.disconnect().catch(()=>{}),t=null,o=null,c("idle")},speak:async()=>{},setMuted:l=>{i=l,t?.setMicEnabled(!l).catch(()=>{}),l?c("muted"):n==="muted"&&c("listening")},getState:()=>n,onStateChange:l=>{a.push(l)},onError:l=>{s.push(l)},signalAgentReady:()=>{r=!0,n==="connecting"&&c(i?"muted":"listening")},publishData:async l=>{t&&await t.publishData(l)}}}function O(e){return e.stack==="web-speech"?S(A(),N()):e.stack==="live-kit"?e.livekit?oe(e.livekit):(console.warn("[voiceModeFactory] live-kit stack requires livekit opts; returning null \u2192 caller falls back to chat"),null):null}var re={start:()=>{},stop:()=>{}};function z(e){if(!e||typeof window>"u")return re;let n=window.AudioContext??window.webkitAudioContext;if(!n)return re;let t=null,o=null;return{start(){if(!t)try{t=new n;let i=Math.floor(t.sampleRate*2),r=t.createBuffer(1,i,t.sampleRate),a=r.getChannelData(0),s=0;for(let u=0;u<i;u++){let l=Math.random()*2-1;s=(s+.02*l)/1.02,a[u]=s*3.5}o=t.createBufferSource(),o.buffer=r,o.loop=!0;let c=t.createBiquadFilter();c.type="lowpass",c.frequency.value=900;let d=t.createGain();d.gain.value=.02,o.connect(c).connect(d).connect(t.destination),o.start(),t.resume?.().catch(()=>{})}catch{this.stop()}},stop(){try{o?.stop()}catch{}o=null;try{t?.close()}catch{}t=null}}}var D="sm_visitor_id";function st(){let e=new Uint8Array(8);return(globalThis.crypto??window.crypto).getRandomValues(e),`v_${Array.from(e,t=>t.toString(16).padStart(2,"0")).join("")}`}function ct(){try{let n=localStorage.getItem(D);if(n){let t=JSON.parse(n);if(t?.id&&typeof t.expiresAt=="number")return t}}catch{}let e=document.cookie.match(new RegExp(`(?:^|; )${D}=([^;]+)`));return e?{id:decodeURIComponent(e[1]??""),expiresAt:Date.now()+1}:null}function ie(e){try{localStorage.setItem(D,JSON.stringify(e));let n=Math.floor(6048e5/1e3);document.cookie=`${D}=${e.id}; max-age=${n}; path=/; SameSite=Lax; Secure`}catch{}}function ae(){let e=Date.now(),n=ct();if(n&&n.expiresAt>e)return ie({id:n.id,expiresAt:e+6048e5}),n.id;let t=st();return ie({id:t,expiresAt:e+6048e5}),t}async function se(e){if(e.platform!=="shopify")return;let n=e.fetchFn??fetch;try{await n("/cart/update.js",{method:"POST",credentials:"same-origin",headers:{"Content-Type":"application/json"},body:JSON.stringify({attributes:{sm_visitor_id:e.visitorId}})})}catch{}}var M=[200,500],ce=e=>new Promise(n=>setTimeout(n,e));async function W(e,n){let t;for(let o=0;o<=M.length;o++)try{let i=await fetch(e,n);if(i.status>=500&&o<M.length){await ce(M[o]??0);continue}return i}catch(i){if(t=i,o<M.length){await ce(M[o]??0);continue}throw i}throw t}async function le(e){try{let n=ae(),t=await W(`${e.apiBase}/v1/install`,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({merchantId:e.merchantId,domain:e.domain,userAgent:navigator.userAgent,referrer:document.referrer||null})});if(!t.ok)return{kind:"err",reason:`install_${t.status}`};let o=await t.json();se({visitorId:n,platform:o.platform??"custom"});let i=await W(`${e.apiBase}/v1/session`,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({merchantId:e.merchantId,domain:e.domain})});if(!i.ok)return{kind:"err",reason:`session_${i.status}`};let r=await i.json(),a=null;try{let s=await W(`${e.apiBase}/v1/voice/token`,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({sessionId:r.sessionId,merchantId:e.merchantId,visitorId:n})});s.ok?a=await s.json():console.warn("[shoppingmate] voice unavailable \u2014 status",s.status)}catch(s){console.warn("[shoppingmate] voice unavailable \u2014",s)}return{kind:"ok",sessionId:r.sessionId,wsUrl:r.wsUrl,merchantStatus:o.status,personaId:o.personaId??a?.personaId??null,voice:a,visitorId:n}}catch(n){return{kind:"err",reason:n instanceof Error?n.message:"network"}}}function de(e){let n=0,t=a=>{let s=Date.now();s-n<200||(n=s,e.send(a))},o=a=>{let s=a.target;if(!s)return;let c=lt(s),d=c?dt(c,e.hints):null;t({type:"visitor_action",sessionId:e.sessionId,action:"click",intentKey:d,url:window.location.href,elementLabel:c,timestamp:Date.now()})},i=()=>{t({type:"visitor_action",sessionId:e.sessionId,action:"route_change",intentKey:null,url:window.location.href,elementLabel:null,timestamp:Date.now()})},r=a=>{let s=a.target;if(!s)return;let c=s.tagName?.toLowerCase();c!=="input"&&c!=="textarea"&&c!=="select"||s.type==="password"||t({type:"visitor_action",sessionId:e.sessionId,action:"form_focus",intentKey:null,url:window.location.href,elementLabel:s.name||s.id||null,timestamp:Date.now()})};return document.addEventListener("click",o,{passive:!0,capture:!0}),window.addEventListener("popstate",i),document.addEventListener("focusin",r,{passive:!0}),()=>{document.removeEventListener("click",o,!0),window.removeEventListener("popstate",i),document.removeEventListener("focusin",r)}}function lt(e){return e.getAttribute("aria-label")??e.getAttribute("title")??(e.textContent??"").trim().slice(0,80)??null}function dt(e,n){let t=e.toLowerCase();if(n.has(t))return t;for(let o of n.keys())if(t.includes(o)||o.includes(t))return o;return null}var pt=new Set(["the","a","an","to","of","on","in","and","or","section","button","link","card","tile","now"]),ut=[{keyword:"button",matchTag:/^(button)$/i,matchRole:"button"},{keyword:"link",matchTag:/^(a)$/i,matchRole:"link"},{keyword:"card",matchTag:/^(article|div|section)$/i},{keyword:"section",matchTag:/^(section|main|article)$/i}],mt=.4;function C(e,n){if(n){let r=n.get(e.toLowerCase().trim());if(r)try{let a=document.querySelector(r);if(a instanceof HTMLElement&&V(a))return a}catch{}}let t=E(e);if(t.size===0)return null;let o=gt(document.body),i=null;for(let r of o){if(!r.visible)continue;let a=ht(r,e,t);a<mt||(!i||a>i.score)&&(i={c:r,score:a})}return i?.c.element??null}function E(e){return new Set(e.toLowerCase().replace(/[^a-z0-9 ]/g," ").split(/\s+/).filter(n=>n.length>0&&!pt.has(n)))}function gt(e){let n=[],t=document.createTreeWalker(e,NodeFilter.SHOW_ELEMENT),o=t.nextNode();for(;o;){if(o instanceof HTMLElement){let i=ft(o);i&&n.push({element:o,role:o.getAttribute("role")??o.tagName.toLowerCase(),name:i,visible:V(o)})}o=t.nextNode()}return n}function ft(e){let n=e.getAttribute("aria-labelledby");if(n){let r=n.split(/\s+/).map(a=>document.getElementById(a)?.textContent?.trim()??"").filter(Boolean);if(r.length>0)return r.join(" ")}let t=e.getAttribute("aria-label");if(t)return t.trim();if(e.id){let r=document.querySelector(`label[for="${ue(e.id)}"]`);if(r?.textContent)return r.textContent.trim()}let o=e.getAttribute("alt")??e.getAttribute("title");if(o)return o.trim();let i=(e.textContent??"").trim();return i&&i.length<200?i:""}function V(e){if(!e.isConnected)return!1;let n=e.ownerDocument.defaultView?.getComputedStyle(e);return n?!(n.display==="none"||n.visibility==="hidden"||n.opacity==="0"):!0}function ht(e,n,t){let o=E(e.name);if(o.size===0)return 0;let i=0;for(let l of t)o.has(l)&&i++;let r=new Set([...t,...o]).size,a=r===0?0:i/r,s=0,c=n.toLowerCase();for(let l of ut)if(c.includes(l.keyword)&&(l.matchTag.test(e.element.tagName)||e.role===l.matchRole)){s=.15;break}let d=e.element.getAttribute("data-tour-stop"),u=0;if(d){let l=E(d.replace(/-/g," ")),m=0;for(let h of t)l.has(h)&&m++;m>0&&(u=.5*(m/t.size))}return Math.min(1,a+s+u)}function ue(e){return e.replace(/(["\\])/g,"\\$1")}function q(e,n){if(n){let r=n.get(e.toLowerCase().trim());if(r)try{let a=document.querySelector(r);if(a instanceof HTMLElement&&V(a))return a}catch{}}let t=E(e);if(t.size===0)return null;let o=Array.from(document.querySelectorAll("input, textarea, select")).filter(r=>V(r)&&!yt(r)),i=null;for(let r of o){let a=xt(r,t);a<=0||(!i||a>i.score)&&(i={el:r,score:a})}return i?.el??null}function yt(e){let n=(e.getAttribute("type")??"").toLowerCase();return n==="hidden"||n==="submit"||n==="button"||e.disabled}function bt(e){let n=[],t=e.id;if(t){n.push(t);let c=document.querySelector(`label[for="${ue(t)}"]`);c?.textContent&&n.push(c.textContent)}let o=e.getAttribute("name");o&&n.push(o);let i=e.getAttribute("data-field")??e.getAttribute("data-testid");i&&n.push(i);let r=e.getAttribute("aria-label");r&&n.push(r);let a=e.getAttribute("placeholder");a&&n.push(a);let s=e.closest("label");return s?.textContent&&n.push(s.textContent),n}var vt=[["phone","mobile","cell","contact","phonenumber","tel","whatsapp"],["pincode","pin","postal","postcode","zip","zipcode"],["name","fullname"],["email","mail","emailaddress"],["address","street","addr","address1"],["city","town"],["state","province","region"],["landmark","apartment","flat","floor"]],me=new Map;for(let e of vt)for(let n of e)me.set(n,e[0]);function pe(e){return me.get(e)??e}function xt(e,n){let t=new Set([...n].map(pe)),o=0;for(let i of bt(e)){let r=new Set([...E(i)].map(pe));if(r.size===0)continue;let a=0;for(let c of t)r.has(c)&&a++;if(a===0)continue;let s=a/t.size;s>o&&(o=s)}return o}var kt="data-shoppingmate-bot-cursor",ge="data-shoppingmate-cursor-keyframes",I=null,j=window.innerWidth-80,G=window.innerHeight-80;function fe(){if(I&&I.isConnected)return I;wt();let e=document.createElement("div");return e.setAttribute(kt,""),e.innerHTML=`
    <svg width="22" height="22" viewBox="0 0 22 22" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path d="M3 2 L3 17 L7 13 L9.5 19 L12 18 L9.5 12 L15 12 Z"
            fill="#111827" stroke="#fff" stroke-width="1.2" stroke-linejoin="round"/>
    </svg>
  `,Object.assign(e.style,{position:"fixed",left:"0",top:"0",transform:`translate(${j}px, ${G}px)`,transition:"transform 480ms cubic-bezier(0.22, 1, 0.36, 1), opacity 200ms",pointerEvents:"none",zIndex:"2147483647",opacity:"0",willChange:"transform, opacity",filter:"drop-shadow(0 2px 6px rgba(0,0,0,0.25))"}),document.body.appendChild(e),I=e,e}function wt(){if(document.head.querySelector(`style[${ge}]`))return;let e=document.createElement("style");e.setAttribute(ge,""),e.textContent=`
    @keyframes shoppingmate-cursor-click {
      0%   { transform: var(--sm-cursor-pos) scale(1); }
      40%  { transform: var(--sm-cursor-pos) scale(0.72); }
      100% { transform: var(--sm-cursor-pos) scale(1); }
    }
  `,document.head.appendChild(e)}function _t(e){let n=e.getBoundingClientRect();return{x:n.left+n.width/2-6,y:n.top+n.height/2-6}}function T(e,n=480){let t=fe(),{x:o,y:i}=_t(e);return t.style.transitionDuration=`${n}ms, 200ms`,t.style.opacity="1",t.style.transform=`translate(${o}px, ${i}px)`,j=o,G=i,new Promise(r=>setTimeout(r,n))}function U(){let e=fe();return e.style.setProperty("--sm-cursor-pos",`translate(${j}px, ${G}px)`),e.style.animation="shoppingmate-cursor-click 280ms ease-out",new Promise(n=>{let t=()=>{e.style.animation="",e.removeEventListener("animationend",t),n()};e.addEventListener("animationend",t),setTimeout(t,360)})}function L(e=600){let n=I;n&&setTimeout(()=>{n.style.opacity="0"},e)}var St="data-shoppingmate-pulse-ring";function ye(e,n){let t=e.getBoundingClientRect(),o=document.createElement("div");o.setAttribute(St,""),Object.assign(o.style,{position:"fixed",left:`${t.left-6}px`,top:`${t.top-6}px`,width:`${t.width+12}px`,height:`${t.height+12}px`,borderRadius:"14px",boxShadow:"0 0 0 3px rgba(139,92,246,0.85), 0 0 24px rgba(139,92,246,0.55)",pointerEvents:"none",zIndex:"2147483646",animation:"shoppingmate-pulse 1.2s ease-in-out infinite"}),Ct(),document.body.appendChild(o);let i=!1,r=()=>{i||(i=!0,o.remove())};return setTimeout(r,n),r}var he=!1;function Ct(){if(he)return;he=!0;let e=document.createElement("style");e.textContent=`@keyframes shoppingmate-pulse {
    0%, 100% { transform: scale(1); opacity: 1; }
    50% { transform: scale(1.04); opacity: 0.85; }
  }`,document.head.appendChild(e)}function Tt(e,n){let t=e instanceof HTMLTextAreaElement?HTMLTextAreaElement.prototype:e instanceof HTMLSelectElement?HTMLSelectElement.prototype:HTMLInputElement.prototype,o=Object.getOwnPropertyDescriptor(t,"value");o?.set?o.set.call(e,n):e.value=n,e.dispatchEvent(new Event("input",{bubbles:!0})),e.dispatchEvent(new Event("change",{bubbles:!0}))}function Y(e){return e.value??""}var be="sm_selector_cache_v1";function At(){try{return JSON.parse(localStorage.getItem(be)??"{}")}catch{return{}}}function Mt(e){try{localStorage.setItem(be,JSON.stringify(e))}catch{}}function Et(e){return`${location.pathname}::${e}`}function It(e){let n=e.getAttribute("data-sm-field");if(n)return`[data-sm-field="${CSS.escape(n)}"]`;if(e.id)return`#${CSS.escape(e.id)}`;let t=e.getAttribute("name");return t?`[name="${CSS.escape(t)}"]`:null}function Lt(e,n){let t=At(),o=Et(e),i=t[o];if(i)try{let a=document.querySelector(i);if(a?.isConnected)return a}catch{}let r=null;try{r=document.querySelector(`[data-sm-field="${CSS.escape(e)}"]`)}catch{r=null}if(r||(r=q(e,n)),r){let a=It(r);a&&(t[o]=a,Mt(t))}return r}function ve(e,n){let t={},o=[],i=!1;for(let{field:r,value:a}of e){let s=Lt(r,n);if(!s){o.push({field:r,ok:!1,value:""});continue}i=!0,Tt(s,a);let c=Y(s);t[r]=c,o.push({field:r,ok:c===a,value:c})}return i?{ok:!0,values:t,filled:o}:{ok:!1,reason:"not_found"}}function xe(e,n){let t={};if(e&&e.length>0){for(let i of e){let r=q(i,n);r&&(t[i]=Y(r))}return{ok:!0,values:t}}let o=document.querySelectorAll("input, textarea, select");for(let i of o){let r=(i.getAttribute("type")??"").toLowerCase();if(r==="password"||r==="hidden")continue;let a=i.getAttribute("name")??i.id;a&&(t[a]=Y(i))}return{ok:!0,values:t}}async function ke(e){switch(e.type){case"navigate":return Ft(e.path);case"scroll_to":return Kt(e.intent);case"highlight":return zt(e.intent,e.durationMs??2e3);case"click":return Wt(e.intent);case"point_at":return qt(e.intent);case"demo_click":return jt(e.intent);case"cart_add":return Nt(e.sku,e.qty);case"open_cart":return $t();case"cart_set_qty":return Dt(e.sku,e.qty);case"cart_clear":return Ot();case"apply_coupon":return Vt(e.code);case"checkout_fill":return Pt(e.details);case"checkout_place":return Rt();case"checkout_state":return Ht();case"form_fill":return ve(e.fields);case"form_read":return xe(e.fields)}}async function Ht(){let e=window.__shoppingmateCheckoutState__;if(typeof e!="function")return{ok:!1,reason:"not_found"};try{return await e()?{ok:!0}:{ok:!1,reason:"not_found"}}catch{return{ok:!1,reason:"not_found"}}}async function Pt(e){let n=window.__shoppingmateCheckoutFill__;if(typeof n!="function")return{ok:!1,reason:"not_found"};try{return await n(e)?{ok:!0}:{ok:!1,reason:"not_found"}}catch{return{ok:!1,reason:"not_found"}}}async function Rt(){let e=window.__shoppingmatePlaceOrder__;if(typeof e!="function")return{ok:!1,reason:"not_found"};try{return await e()?{ok:!0}:{ok:!1,reason:"not_found"}}catch{return{ok:!1,reason:"not_found"}}}function Nt(e,n){let t=window.__shoppingmateCartAdd__;if(typeof t!="function")return{ok:!1,reason:"not_found"};try{return t(e,n)?{ok:!0}:{ok:!1,reason:"not_found"}}catch{return{ok:!1,reason:"not_found"}}}function $t(){let e=window.__shoppingmateOpenCart__;if(typeof e!="function")return{ok:!1,reason:"not_found"};try{return e(),{ok:!0}}catch{return{ok:!1,reason:"not_found"}}}function Ot(){let e=window.__shoppingmateClearCart__;if(typeof e!="function")return{ok:!1,reason:"not_found"};try{return e()?{ok:!0}:{ok:!1,reason:"not_found"}}catch{return{ok:!1,reason:"not_found"}}}function Dt(e,n){let t=window.__shoppingmateCartSetQty__;if(typeof t!="function")return{ok:!1,reason:"not_found"};try{return t(e,n)?{ok:!0}:{ok:!1,reason:"not_found"}}catch{return{ok:!1,reason:"not_found"}}}async function Vt(e){let n=window.__shoppingmateApplyCoupon__;if(typeof n!="function")return{ok:!1,reason:"not_found"};try{return await n(e)?{ok:!0}:{ok:!1,reason:"not_found"}}catch{return{ok:!1,reason:"not_found"}}}function Ut(e){let n=window.__shoppingmateNavigate__;if(typeof n=="function")try{return n(e),!0}catch{return!1}return!1}async function Ft(e){try{let n=new URL(e,window.location.href);if(n.origin!==window.location.origin)return{ok:!1,reason:"cross_origin"};let t=Bt(n.pathname);t&&(await T(t,520),await U());let o=n.pathname+n.search+n.hash;return Ut(o)||window.location.assign(o),L(800),{ok:!0}}catch{return{ok:!1,reason:"route_not_found"}}}function Bt(e){let n=document.querySelectorAll("a[href]");for(let t of n)try{if(new URL(t.href,window.location.href).pathname===e)return t}catch{}return null}async function Kt(e){let n=C(e);return n?(await T(n,480),n.scrollIntoView({behavior:"smooth",block:"center"}),L(800),{ok:!0}):{ok:!1,reason:"not_found"}}function zt(e,n){let t=C(e);return t?(ye(t,n),{ok:!0}):{ok:!1,reason:"not_found"}}async function Wt(e){let n=C(e);return n?n.isConnected?(await T(n,420),await U(),n.isConnected?(n.click(),L(800),{ok:!0}):{ok:!1,reason:"stale_target"}):{ok:!1,reason:"stale_target"}:{ok:!1,reason:"not_found"}}async function we(e){let n=e.getBoundingClientRect(),t=window.innerHeight;(n.bottom<80||n.top>t-80)&&(e.scrollIntoView({behavior:"smooth",block:"center"}),await new Promise(i=>setTimeout(i,350)))}async function qt(e){let n=C(e);return n?n.isConnected?(await we(n),await T(n,480),{ok:!0}):{ok:!1,reason:"stale_target"}:{ok:!1,reason:"not_found"}}async function jt(e){let n=C(e);return n?n.isConnected?(await we(n),await T(n,420),await U(),await new Promise(t=>setTimeout(t,120)),n.isConnected?(n.click(),L(800),{ok:!0}):{ok:!1,reason:"stale_target"}):{ok:!1,reason:"stale_target"}:{ok:!1,reason:"not_found"}}var _e={"calm-clinician":"Sage","calmosis-clinician":"Calmio",stylist:"Lumi",coach:"Kai",concierge:"Olivia",curator:"Theo",guide:"Maya",expert:"Arjun",host:"Ana"},Gt={"calmosis-clinician":"calm-clinician"};function Yt(){let e="https://shoppingmate-web.vercel.app/widget/personas";return e&&typeof e=="string"?e.replace(/\/$/,""):"https://cdn.shoppingmate.ai/v1/personas"}var Se={id:"pending",name:"Assistant",initial:"A",avatarUrl:""};function Ce(){return Se}function Te(e){if(!e||!_e[e])return Se;let n=_e[e],t=Gt[e]??e;return{id:e,name:n,initial:n.charAt(0).toUpperCase(),avatarUrl:`${Yt()}/${t}.png`}}var Ae=0,_=()=>(Ae+=1,`t${Ae}`);function Jt(e,n){switch(n.type){case"set_mode":return{...e,mode:n.mode};case"set_voice_state":return n.state!=="idle"?{...e,voiceState:n.state,voiceError:null,invited:!1}:{...e,voiceState:n.state};case"set_connection":return{...e,connection:n.status};case"set_voice_error":return{...e,voiceError:n.error};case"set_invited":return{...e,invited:n.invited};case"reset":return{...e,transcript:[],thinking:!1,closed:!1,closedReason:null,checkoutUrl:null,capWarning:null};case"user_input":return{...e,transcript:[...e.transcript,{id:_(),role:"user",kind:"text",text:n.text,ts:Date.now()}]};case"agent_event":{let t=n.event;switch(t.type){case"thinking":return{...e,thinking:!0};case"end_of_turn":return{...e,thinking:!1};case"say":{let o=e.transcript[e.transcript.length-1];return o&&o.role==="agent"&&o.kind==="text"&&o.partial?{...e,thinking:!1,transcript:[...e.transcript.slice(0,-1),{...o,text:t.text,partial:!1,ts:Date.now()}]}:{...e,thinking:!1,transcript:[...e.transcript,{id:_(),role:"agent",kind:"text",text:t.text,ts:Date.now()}]}}case"say_partial":{let o=e.transcript[e.transcript.length-1];return o&&o.role==="agent"&&o.kind==="text"&&o.partial?{...e,thinking:!1,transcript:[...e.transcript.slice(0,-1),{...o,text:t.text,ts:Date.now()}]}:{...e,thinking:!1,transcript:[...e.transcript,{id:_(),role:"agent",kind:"text",text:t.text,ts:Date.now(),partial:!0}]}}case"user_text":return{...e,transcript:[...e.transcript,{id:_(),role:"user",kind:"text",text:t.text,ts:Date.now()}]};case"cards":return{...e,transcript:[...e.transcript,{id:_(),role:"agent",kind:"cards",items:t.items,ts:Date.now()}]};case"tool_result":return e;case"checkout_redirect":return{...e,checkoutUrl:t.url};case"cap_warning":return{...e,capWarning:{reason:t.reason,remaining:t.remaining},transcript:[...e.transcript,{id:_(),role:"system",kind:"cap_warning",remaining:t.remaining,ts:Date.now()}]};case"session_closed":return{...e,closed:!0,closedReason:t.reason,transcript:[...e.transcript,{id:_(),role:"system",kind:"closed",reason:t.reason,ts:Date.now()}]};default:return e}}default:return e}}function J(e){let n={sessionId:e.sessionId,mode:"pill",voiceState:"idle",transcript:[],thinking:!1,closed:!1,closedReason:null,checkoutUrl:null,capWarning:null,connection:"connecting",voiceError:null,invited:!1},t=[];return{get:()=>n,dispatch:o=>{n=Jt(n,o);for(let i of t)i(n)},subscribe:o=>(t.push(o),()=>{let i=t.indexOf(o);i>=0&&t.splice(i,1)})}}var Me=`
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

/* Placement overrides \u2014 host sets data-position on <shoppingmate-widget>.
   Default is bottom-right. Center pins the tray to viewport middle. */
.root.pos-bottom-right { bottom: 20px; right: 20px; align-items: flex-end; }
.root.pos-bottom-left  { bottom: 20px; left: 20px; right: auto; align-items: flex-start; }
.root.pos-bottom-center{ bottom: 20px; left: 50%; right: auto; transform: translateX(-50%); align-items: center; }
.root.pos-center       { top: 50%; left: 50%; right: auto; bottom: auto; transform: translate(-50%, -50%); align-items: center; }
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
  transition: box-shadow 300ms ease-out, border-color 300ms ease-out;
}
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
`;var Ee=[1e3,2e3,4e3,8e3,16e3],Xt=5;function Ie(e,n){let t=null,o=0,i=!1,r=[];function a(){i||(n.onStatus(o>0?"reconnecting":"connecting"),t=new WebSocket(e),t.onopen=()=>{n.onStatus("connected"),o>0&&t?.send(JSON.stringify({type:"session_resume",sessionId:n.sessionId})),o=0;for(let s of r)t?.send(s);r=[]},t.onmessage=s=>n.onEvent(typeof s.data=="string"?s.data:""),t.onerror=()=>{},t.onclose=()=>{if(i)return;if(o+=1,o>=Xt){n.onStatus("disconnected");return}let s=Math.min(o-1,Ee.length-1),c=Ee[s]??3e4;n.onStatus("reconnecting"),setTimeout(a,c)})}return a(),{send:s=>{t&&t.readyState===1?t.send(s):r.push(s)},close:()=>{i=!0,t?.close()}}}function Qt(e,n,t,o,i,r,a=8){let s=Math.max(a,i-t-a),c=Math.max(a,r-o-a);return{x:Math.min(Math.max(a,e),s),y:Math.min(Math.max(a,n),c)}}function Zt(e,n,t,o=8){let i=(e.left+e.right)/2,r=(e.top+e.bottom)/2,a=i>n/2?"right":"left",s=r>t/2?"bottom":"top",c=Math.max(o,a==="right"?n-e.right:e.left),d=Math.max(o,s==="bottom"?t-e.bottom:e.top);return{hSide:a,hVal:c,vSide:s,vVal:d}}function X(e,n){e.classList.add("dragged"),e.style.transform="none",n.hSide==="right"?(e.style.right=`${n.hVal}px`,e.style.left="auto"):(e.style.left=`${n.hVal}px`,e.style.right="auto"),n.vSide==="bottom"?(e.style.bottom=`${n.vVal}px`,e.style.top="auto"):(e.style.top=`${n.vVal}px`,e.style.bottom="auto"),e.classList.toggle("dock-top",n.vSide==="top"),e.classList.toggle("dock-bottom",n.vSide==="bottom"),e.classList.toggle("dock-left",n.hSide==="left"),e.classList.toggle("dock-right",n.hSide==="right")}function Le(e){try{let n=window.localStorage.getItem(e);if(!n)return null;let t=JSON.parse(n);if((t.hSide==="left"||t.hSide==="right")&&(t.vSide==="top"||t.vSide==="bottom")&&typeof t.hVal=="number"&&typeof t.vVal=="number")return t}catch{}return null}function en(e,n){try{window.localStorage.setItem(e,JSON.stringify(n))}catch{}}function He(e,n){let t=n.offsetWidth||0,o=n.offsetHeight||0,i=window.innerWidth,r=window.innerHeight;return{...e,hVal:Math.min(Math.max(8,e.hVal),Math.max(8,i-t-8)),vVal:Math.min(Math.max(8,e.vVal),Math.max(8,r-o-8))}}function Pe(e){let{root:n,surface:t,storageKey:o}=e,i=()=>t.querySelector(".tray")??t,r=Le(o);r&&X(n,He(r,i()));let a=0,s=0,c=0,d=0,u=!1,l=null,m=f=>{if(l!==null&&f.pointerId!==l)return;let b=f.clientX-a,x=f.clientY-s;if(!u&&Math.hypot(b,x)<6)return;if(!u)try{l!=null&&t.setPointerCapture(l)}catch{}u=!0,n.classList.add("dragging","dragged"),n.style.transform="none";let P=n.offsetWidth,R=n.offsetHeight,{x:Qe,y:Ze}=Qt(c+b,d+x,P,R,window.innerWidth,window.innerHeight);n.style.left=`${Qe}px`,n.style.top=`${Ze}px`,n.style.right="auto",n.style.bottom="auto",n.classList.remove("dock-top","dock-bottom","dock-left","dock-right"),f.preventDefault()},h=f=>{if(window.removeEventListener("pointermove",m),window.removeEventListener("pointerup",h),l=null,!u)return;u=!1,n.classList.remove("dragging");let b=R=>{R.stopPropagation(),R.preventDefault()};t.addEventListener("click",b,{capture:!0,once:!0}),window.setTimeout(()=>t.removeEventListener("click",b,{capture:!0}),350);let x=i().getBoundingClientRect(),P=Zt({top:x.top,left:x.left,right:x.right,bottom:x.bottom},window.innerWidth,window.innerHeight);X(n,P),en(o,P),f.preventDefault()},y=f=>{if(f.button!=null&&f.button!==0)return;let b=i().getBoundingClientRect();a=f.clientX,s=f.clientY,c=b.left,d=b.top,u=!1,l=f.pointerId??null,window.addEventListener("pointermove",m),window.addEventListener("pointerup",h)},H=()=>{let f=Le(o);f&&X(n,He(f,i()))};return t.addEventListener("pointerdown",y),window.addEventListener("resize",H),()=>{t.removeEventListener("pointerdown",y),window.removeEventListener("pointermove",m),window.removeEventListener("pointerup",h),window.removeEventListener("resize",H)}}var p={captionResting:"AI ASSISTANT",captionIncoming:"INCOMING CALL",captionThinking:"THINKING",captionConnected:"CONNECTED",captionRetry:"TAP TO RETRY",captionOffline:"OFFLINE",talkToPrefix:"Talk to",callCta:"Call",acceptCta:"Accept",callAria:"Start voice call",acceptAria:"Accept call",micMute:"Mute mic",micUnmute:"Unmute mic",retryAria:"Retry call",endCallAria:"End call",closeAria:"Close",openAria:"Open shoppingmate",callFailedTitle:"Could not start the call. Please try again.",callHelpHeading:"How can I help you?",callBullets:["Find the right product","Compare options out loud","Check out on this page"],panelHelpHeading:"Hi, I'm",panelHelpSubtitle:"I'm here to help you:",panelBullets:["Find the right product fast","Compare options out loud","Check out without leaving the page"],panelPrompts:["Help me find the right product","Can you compare your products for me?","I'd like to check out"],poweredBy:"Powered by shoppingmate",chatPlaceholder:"Type a quick question\u2026",reconnecting:"Reconnecting\u2026",disconnected:"Connection lost \u2014 reload to retry",closed:{user:"Conversation ended",cap:"Time to wrap up \u2014 reload for a new chat",error:"Something went wrong"},payNow:"Pay now \u2192",capWarning:"A couple minutes left",thinking:"thinking\u2026",micDenied:"Mic blocked \u2014 switching to text"};var v=e=>`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${e}</svg>`,Re=v('<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>'),Ne=v('<path d="M18 6 6 18"/><path d="m6 6 12 12"/>'),$e=v('<path d="M5 12h14"/>'),Oe=v('<path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>'),De=v('<path d="M10.68 13.31a16 16 0 0 0 3.41 2.6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7 2 2 0 0 1 1.72 2v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.42 19.42 0 0 1-3.33-2.67"/><path d="M5 5a2 2 0 0 1 2-2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L10.9 11.1"/><line x1="22" y1="2" x2="2" y2="22"/>'),Ve=v('<path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="22"/>'),Ue=v('<line x1="2" y1="2" x2="22" y2="22"/><path d="M18.89 13.23A7.12 7.12 0 0 0 19 12v-2"/><path d="M5 10v2a7 7 0 0 0 12 5"/><path d="M15 9.34V5a3 3 0 0 0-5.68-1.33"/><path d="M9 9v3a3 3 0 0 0 5.12 2.12"/><line x1="12" y1="19" x2="12" y2="22"/>'),Fe=v('<path d="M22 2 11 13"/><path d="M22 2l-7 20-4-9-9-4 20-7z"/>');function F(e){return e.replace(/[&<>"']/g,n=>n==="&"?"&amp;":n==="<"?"&lt;":n===">"?"&gt;":n==='"'?"&quot;":"&#39;")}function tn(e,n){let t=document.createElement("button");return t.className="card",t.type="button",t.dataset.sku=e.sku,t.innerHTML=`
    ${e.image?`<img src="${F(e.image)}" alt="${F(e.title)}" />`:'<div class="card-img-fallback"></div>'}
    <div class="title">${F(e.title)}</div>
    <div class="price">${F(e.priceFormatted)}</div>
  `,t.addEventListener("click",()=>n({sku:e.sku,variantId:e.variantId})),t}function nn(e,n){if(e.kind==="text"){let o=document.createElement("div");return o.className=`bubble ${e.role}`,o.textContent=e.text,o}if(e.kind==="cards"){let o=document.createElement("div");o.className="cards-row";for(let i of e.items)o.appendChild(tn(i,n));return o}if(e.kind==="cap_warning"){let o=document.createElement("div");return o.className="bubble system",o.textContent=p.capWarning,o}let t=document.createElement("div");return t.className="bubble system",t.textContent=p.closed[e.reason],t}var Be=new WeakMap;function B(e,n,t){let o=Be.get(e)??[],i=new Map(o.map(c=>[c.id,c])),r=new Set(n.map(c=>c.id));for(let c of o)r.has(c.id)||c.el.remove();let a=[],s=!1;for(let c=0;c<n.length;c++){let d=n[c];if(!d)continue;let u=i.get(d.id);if(u)d.kind==="text"&&u.text!==d.text&&(u.el.textContent=d.text,u.text=d.text,s=!0),a.push(u);else{let l=nn(d,t);e.appendChild(l),a.push({id:d.id,el:l,text:d.kind==="text"?d.text:void 0}),s=!0}}Be.set(e,a),s&&(e.scrollTop=e.scrollHeight)}function on(e){switch(e){case"mic_policy_blocked":return"Voice is disabled on this page \u2014 text chat still works.";case"mic_denied":return"Microphone blocked. Allow mic access in your browser, then tap Call.";case"mic_unavailable":return"No microphone found \u2014 check your audio device, then tap Call.";case"connect_failed":return"Couldn't reach voice. Tap Call to retry.";default:return"Tap Call to try again."}}function Ke(e){return e.muted?"you're muted":e.voiceState==="connecting"?`connecting to ${e.personaName}\u2026`:e.voiceState==="speaking"?`${e.personaName} is speaking\u2026`:e.voiceState==="listening"?`${e.personaName} is listening\u2026`:`${e.personaName} is ready`}function ze(e){return e.voiceState==="idle"&&e.voiceError?"error":e.transcript.length===0?"prompt":"transcript"}function rn(e){return`${ze(e)}|${e.checkoutUrl??""}|${e.personaName}|${e.voiceError?.code??""}`}function We(e,n){let t=rn(n),o=ze(n);if(e.dataset.chromeKey!==t){let a=o==="error"?`
          <div class="call-error">
            <p class="call-error-title">${p.callFailedTitle}</p>
            <p class="call-error-hint">${on(n.voiceError?.code??"unknown")}</p>
          </div>`:"",s=o==="prompt"?`
          <div class="call-prompt">
            <h2 class="call-prompt-heading">${p.callHelpHeading}</h2>
            <ul class="call-prompt-bullets">
              ${p.callBullets.map(d=>`<li>${d}</li>`).join("")}
            </ul>
          </div>`:"",c=o!=="transcript";e.innerHTML=`
      <div class="panel call-panel">
        <button class="panel-close" data-action="close" aria-label="${p.closeAria}">${$e}</button>
        ${a}
        ${s}
        <div class="status-line ${o==="error"?"hidden":""}" data-region="status">${Ke(n)}</div>
        <div class="transcript ${c?"hidden":""}" data-region="transcript" aria-live="polite"></div>
        ${n.checkoutUrl?`<a class="checkout-cta" data-action="checkout" href="${n.checkoutUrl}" target="_blank" rel="noopener">${p.payNow}</a>`:""}
        <div class="panel-footer">${p.poweredBy}</div>
      </div>
    `,e.querySelector('[data-action="close"]')?.addEventListener("click",n.onClose),e.querySelector('[data-action="checkout"]')?.addEventListener("click",n.onCheckout),e.dataset.chromeKey=t}let i=e.querySelector('[data-region="status"]');if(i instanceof HTMLElement){let a=Ke(n);i.textContent!==a&&(i.textContent=a)}let r=e.querySelector('[data-region="transcript"]');r instanceof HTMLElement&&o==="transcript"&&B(r,n.transcript,n.onCardTap)}function an(e){return`${e.transcript.length===0?"1":"0"}|${e.checkoutUrl??""}|${e.closed?"1":"0"}|${e.personaName}|${e.personaInitial}|${e.personaAvatarUrl}`}function qe(e,n){let t=an(n);if(e.dataset.chromeKey!==t){let i=n.transcript.length===0,r=p.panelBullets.map((d,u)=>`<button type="button" class="welcome-bullet" data-prompt="${u}" ${n.closed?"disabled":""}>${d}<span class="welcome-bullet-arrow" aria-hidden="true">\u2192</span></button>`).join(""),a=i?`
        <div class="welcome">
          <div class="welcome-avatar">
            <img src="${n.personaAvatarUrl}" alt="" onerror="this.style.display='none'; this.nextElementSibling.style.display='grid';" />
            <span class="welcome-avatar-fallback" aria-hidden="true">${n.personaInitial}</span>
          </div>
          <h2 class="welcome-heading">${p.panelHelpHeading} ${n.personaName}.</h2>
          <p class="welcome-sub">${p.panelHelpSubtitle}</p>
          <div class="welcome-bullets">${r}</div>
        </div>
      `:"";e.innerHTML=`
      <div class="panel">
        <button class="panel-close" data-action="close" aria-label="${p.closeAria}">${Ne}</button>
        ${a}
        <div class="transcript ${i?"transcript-empty":""}" data-region="transcript" aria-live="polite"></div>
        ${n.checkoutUrl?`<a class="checkout-cta" href="${n.checkoutUrl}" target="_blank" rel="noopener">${p.payNow}</a>`:""}
        <form class="input-row">
          <input type="text" placeholder="${p.chatPlaceholder}" ${n.closed?"disabled":""} />
          <button class="send" type="submit" aria-label="Send" ${n.closed?"disabled":""}>${Fe}</button>
        </form>
        <div class="panel-footer">${p.poweredBy}</div>
      </div>
    `,e.querySelector('[data-action="close"]')?.addEventListener("click",n.onClose),e.querySelectorAll(".welcome-bullet").forEach(d=>{d.addEventListener("click",()=>{if(n.closed)return;let u=Number(d.dataset.prompt),l=p.panelPrompts[u]??p.panelBullets[u];l&&n.onSend(l)})});let s=e.querySelector("form"),c=e.querySelector("input");s instanceof HTMLFormElement&&c instanceof HTMLInputElement&&s.addEventListener("submit",d=>{d.preventDefault();let u=c.value.trim();u&&(c.value="",n.onSend(u))}),e.dataset.chromeKey=t}let o=e.querySelector('[data-region="transcript"]');o instanceof HTMLElement&&B(o,n.transcript,n.onCardTap)}function sn(e){return e.voiceState==="connecting"?"connecting":e.voiceState!=="idle"?"connected":e.voiceError?"error":e.invited?"incoming":"resting"}function cn(e,n){return[n,e.mode,e.callable?"1":"0",e.voiceState,e.connection,e.invited?"1":"0",e.personaName,e.personaInitial,e.personaAvatarUrl].join("|")}function ln(e,n){let t=e.voiceState==="muted",o=e.voiceState==="speaking",i=e.connection==="disconnected",r=(m,h)=>`
    <button class="tray-call" data-action="call" aria-label="${h}">
      ${Oe}<span class="tray-call-label">${m}</span>
    </button>`,a=`
    <button class="tray-btn ghost" data-action="chat" aria-label="${p.openAria}">${Re}</button>`,s=m=>`
    <button class="tray-btn ${t?"muted":""}" data-action="mic" ${m?"disabled":""}
      aria-pressed="${t}" aria-label="${t?p.micUnmute:p.micMute}">${t?Ue:Ve}</button>`,c=`
    <button class="tray-btn end" data-action="end" aria-label="${p.endCallAria}">${De}</button>`,d='<span class="tray-spinner" aria-hidden="true"></span>',u=`
    <div class="tray-waveform active ${o?"speaking":""}" aria-hidden="true">
      ${Array.from({length:14}).map(()=>'<span class="bar"></span>').join("")}
    </div>`,l=i?"offline":"online";switch(n){case"incoming":return{caption:p.captionIncoming,captionClass:"incoming",presenceClass:l,nameText:e.personaName,controls:`${r(p.acceptCta,p.acceptAria)}${a}`};case"connecting":return{caption:p.captionThinking,captionClass:"thinking",presenceClass:"online",nameText:e.personaName,controls:`${d}${s(!0)}${c}`};case"connected":return{caption:p.captionConnected,captionClass:"connected",presenceClass:"online",nameText:e.personaName,controls:`${u}${s(!1)}${c}`};case"error":return{caption:p.captionRetry,captionClass:"retry",presenceClass:"offline",nameText:e.personaName,controls:`${r(p.callCta,p.retryAria)}${c}`};default:return{caption:i?p.captionOffline:p.captionResting,captionClass:i?"retry":"resting",presenceClass:l,nameText:`${p.talkToPrefix} ${e.personaName}`,controls:e.callable?r(p.callCta,p.callAria):a}}}function je(e,n){let t=sn(n),o=cn(n,t);if(e.dataset.trayKey===o)return;let i=ln(n,t),r=n.mode==="chat"||n.mode==="call"||n.mode==="expanded";e.innerHTML=`
    <div class="tray phase-${t}" role="region" aria-label="shoppingmate">
      <button class="tray-avatar" data-action="toggle" aria-expanded="${r}" aria-label="${p.openAria}">
        <span class="tray-avatar-ring" aria-hidden="true"></span>
        <img src="${n.personaAvatarUrl}" alt="" class="tray-avatar-img" draggable="false" onerror="this.style.display='none'; this.nextElementSibling.style.display='grid';" />
        <span class="tray-avatar-fallback" aria-hidden="true">${n.personaInitial}</span>
        <span class="tray-presence ${i.presenceClass}"></span>
      </button>
      <div class="tray-meta">
        <div class="tray-name">${i.nameText}</div>
        <div class="tray-caption ${i.captionClass}">${i.caption}</div>
      </div>
      <div class="tray-controls">${i.controls}</div>
    </div>
  `,e.querySelector('[data-action="toggle"]')?.addEventListener("click",()=>{r?n.onClose():n.onChat()}),e.querySelector('[data-action="call"]')?.addEventListener("click",n.onCall),e.querySelector('[data-action="chat"]')?.addEventListener("click",n.onChat),e.querySelector('[data-action="mic"]')?.addEventListener("click",()=>{n.onMute(n.voiceState!=="muted")}),e.querySelector('[data-action="end"]')?.addEventListener("click",n.onEnd),e.dataset.trayKey=o}var Ge="shoppingmate-widget",Ye="SM-XPK2EN",dn="SM-2SCCLZ",pn=new Set(["bottom-right","bottom-left","bottom-center","center","top-right","top-left"]);function Je(){return"live-kit"==="web-speech"?"web-speech":"live-kit"}var Q=class extends HTMLElement{constructor(){super(...arguments);g(this,"rootEl",null);g(this,"pillHost",null);g(this,"panelHost",null);g(this,"store",J({sessionId:"pending"}));g(this,"socket",null);g(this,"voiceMode",S(null,N()));g(this,"voice",null);g(this,"persona",Ce());g(this,"apiBase","");g(this,"merchantId","");g(this,"domain",window.location.host);g(this,"stopActivityTracker",null);g(this,"inviteTimer",null);g(this,"stopDrag",null);g(this,"ambience",z(!1))}connectedCallback(){if(this.shadowRoot)return;let t=this.getAttribute("data-id"),o=this.getAttribute("data-api")??this.apiBase;if(!t){console.warn("[shoppingmate] data-id missing on widget element");return}this.merchantId=t,this.apiBase=o,this.ambience=z(this.getAttribute("data-ambience")!=="off");let i=this.attachShadow({mode:"open"}),r=document.createElement("style");r.textContent=Me,i.appendChild(r);let a=document.createElement("div"),s=(this.getAttribute("data-position")??"bottom-right").toLowerCase(),c=pn.has(s)?`pos-${s}`:"pos-bottom-right";a.className=`root ${c}`,i.appendChild(a),this.rootEl=a,this.panelHost=document.createElement("div"),this.pillHost=document.createElement("div"),a.appendChild(this.panelHost),a.appendChild(this.pillHost),this.store.subscribe(()=>this.render()),this.render(),this.stopDrag=Pe({root:a,surface:this.pillHost,storageKey:`sm-widget-pos:${this.merchantId}`}),Je()==="live-kit"&&te(),this.start()}disconnectedCallback(){this.socket?.close(),this.voiceMode.stop(),this.ambience.stop(),this.stopActivityTracker?.(),this.inviteTimer&&clearTimeout(this.inviteTimer),this.stopDrag?.()}async start(){let t=await le({apiBase:this.apiBase,merchantId:this.merchantId,domain:this.domain});if(t.kind==="err"){console.warn("[shoppingmate] bootstrap failed:",t.reason);return}this.store=J({sessionId:t.sessionId}),this.store.subscribe(()=>this.render()),this.voice=t.voice,this.persona=Te(t.personaId??t.voice?.personaId??null);let o=Je(),i=A();if(o==="live-kit"&&this.voice){let r=O({stack:"live-kit",livekit:{sessionId:t.sessionId,wsUrl:this.voice.wsUrl,token:this.voice.token,roomName:this.voice.roomName,onTranscriptEvent:a=>this.handleLiveKitData(a)}});r&&(this.voiceMode=r,this.voiceMode.warm?.())}else{let r=O({stack:"web-speech"});r&&(this.voiceMode=r),i?.onFinal(a=>{this.store.dispatch({type:"user_input",text:a,mode:"voice"}),this.socket?.send(k({type:"user_text",sessionId:t.sessionId,text:a,mode:"voice"}))})}this.voiceMode.onStateChange(r=>this.store.dispatch({type:"set_voice_state",state:r})),this.voiceMode.onError?.(r=>{console.warn("[shoppingmate] voice error",r),this.store.dispatch({type:"set_voice_error",error:r})}),this.socket=Ie(t.wsUrl,{sessionId:t.sessionId,onEvent:r=>{let a=K(r);a&&this.handleAgentEvent(a)},onStatus:r=>this.store.dispatch({type:"set_connection",status:r})}),(this.merchantId===Ye||this.merchantId===dn)&&(this.inviteTimer=setTimeout(()=>{this.store.get().voiceState==="idle"&&this.store.get().mode==="pill"&&this.store.dispatch({type:"set_invited",invited:!0})},5e3)),this.stopActivityTracker=de({sessionId:t.sessionId,hints:new Map,send:r=>this.publishWidgetMessage(r)})}async handleAgentEvent(t,o="ws"){if(t.type==="host_action_request"){let i=await ke(t.action);this.publishWidgetMessage({type:"host_action_result",callId:t.callId,result:i},o);return}if(t.type!=="persona_swap"&&t.type!=="agent_warmed"){if(t.type==="agent_ready"){this.voiceMode.signalAgentReady?.();return}this.store.dispatch({type:"agent_event",event:t}),t.type==="say"&&this.voiceMode.speak(t.text)}}publishWidgetMessage(t,o="ws"){let i=k(t);if(o==="livekit"&&this.voiceMode.publishData){let r=new TextEncoder().encode(i);this.voiceMode.publishData(r);return}this.socket?.send(i)}render(){if(!this.pillHost||!this.panelHost)return;let t=this.store.get(),o=A()!==null;t.mode==="call"?We(this.panelHost,{voiceState:t.voiceState,muted:t.voiceState==="muted",transcript:t.transcript,checkoutUrl:t.checkoutUrl,personaName:this.persona.name,voiceError:t.voiceError,onClose:()=>this.store.dispatch({type:"set_mode",mode:"pill"}),onCardTap:i=>this.cardTap(i),onCheckout:()=>{}}):t.mode==="chat"||t.mode==="expanded"?qe(this.panelHost,{transcript:t.transcript,checkoutUrl:t.checkoutUrl,personaName:this.persona.name,personaInitial:this.persona.initial,personaAvatarUrl:this.persona.avatarUrl,onSend:i=>this.userText(i,"text"),onCall:()=>this.openCall(),onClose:()=>this.store.dispatch({type:"set_mode",mode:"pill"}),onCardTap:i=>this.cardTap(i),closed:t.closed}):this.panelHost.innerHTML="",je(this.pillHost,{mode:t.mode,callable:o,voiceState:t.voiceState,connection:t.connection,voiceError:t.voiceError,invited:t.invited,personaName:this.persona.name,personaInitial:this.persona.initial,personaAvatarUrl:this.persona.avatarUrl,onCall:()=>this.openCall(),onMute:i=>this.voiceMode.setMuted(i),onEnd:()=>{this.voiceMode.stop(),this.ambience.stop(),this.store.dispatch({type:"set_mode",mode:"pill"})},onChat:()=>{t.invited&&this.store.dispatch({type:"set_invited",invited:!1}),this.store.dispatch({type:"set_mode",mode:"chat"})},onClose:()=>this.store.dispatch({type:"set_mode",mode:"pill"})})}openCall(){this.store.get().invited&&(this.merchantId===Ye&&this.publishWidgetMessage({type:"tour_request"}),this.store.dispatch({type:"set_invited",invited:!1})),this.inviteTimer&&(clearTimeout(this.inviteTimer),this.inviteTimer=null),this.store.dispatch({type:"set_mode",mode:"call"}),this.voiceMode.start(),this.ambience.start()}userText(t,o){this.store.dispatch({type:"user_input",text:t,mode:o});let i=this.store.get().sessionId;this.socket?.send(k({type:"user_text",sessionId:i,text:t,mode:o}))}handleLiveKitData(t){let o;try{o=new TextDecoder().decode(t)}catch{return}let i=K(o);i&&this.handleAgentEvent(i,"livekit")}cardTap(t){let o=this.store.get().sessionId;this.socket?.send(k({type:"card_tap",sessionId:o,action:"cartAdd",sku:t.sku,variantId:t.variantId,qty:1}))}};function Xe(){customElements.get(Ge)||customElements.define(Ge,Q)}function un(){let e=document.currentScript instanceof HTMLScriptElement?document.currentScript:null,n=e?.dataset.id;if(!n){console.warn("[shoppingmate] data-id missing on script tag");return}let o=(e?.dataset.api??"https://api-production-1ea1.up.railway.app").trim(),i=document.querySelector("shoppingmate-widget");i&&(i.getAttribute("data-api")||i.setAttribute("data-api",o),i.getAttribute("data-id")||i.setAttribute("data-id",n)),Xe();let r=()=>{let a=document.querySelector("shoppingmate-widget");if(a){a.getAttribute("data-api")||a.setAttribute("data-api",o),a.getAttribute("data-id")||a.setAttribute("data-id",n);return}let s=document.createElement("shoppingmate-widget");s.setAttribute("data-id",n),s.setAttribute("data-api",o),document.body.appendChild(s)};document.readyState==="loading"?document.addEventListener("DOMContentLoaded",r,{once:!0}):r()}un();})();
