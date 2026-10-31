"use strict";(()=>{var Zn=Object.defineProperty;var to=(t,e,n)=>e in t?Zn(t,e,{enumerable:!0,configurable:!0,writable:!0,value:n}):t[e]=n;var S=(t,e,n)=>to(t,typeof e!="symbol"?e+"":e,n);function ot(t,e){let n=e.toLowerCase().replace(/[₹$£€]|rs\.?|inr|usd/g," ").replace(/\d+([.,]\d+)?/g," ").replace(/[^a-z\s]/g," ").replace(/\s+/g," ").trim().slice(0,40);return n.length<2||t==="text"?null:`${t}|${n}`}function yt(t){let e=new Set;for(let n of t.split(`
`)){let o=/^\[e\d+\] ([a-z]+) "([^"]*)"/.exec(n);if(!o)continue;let r=ot(o[1],o[2]);r&&e.add(r)}return[...e]}function eo(t,e){if(t.length===0)return 0;let n=0;for(let o of t)e.has(o)&&(n+=1);return n/t.length}function no(t,e){try{return new RegExp(t).test(e)}catch{return!1}}function de(t,e,n){let o=new Set(t),r=null,i=null;for(let s of n){if(s.skeleton.length<4)continue;let a=eo(s.skeleton,o),c=no(s.urlPattern,e),l=a+(c?.05:0);a>=.7&&(!r||l>r.c)&&(r={t:s,c:l}),c&&a<.7&&(!i||a<i.coverage)&&(i={template:s,coverage:a})}return r?{template:r.t,coverage:Math.min(1,r.c),drift:null}:{template:null,coverage:0,drift:i}}var oo=new Set(["the","a","an","to","of","on","in","and","or","section","button","link","card","tile","now"]),ro=[{keyword:"button",matchTag:/^(button)$/i,matchRole:"button"},{keyword:"link",matchTag:/^(a)$/i,matchRole:"link"},{keyword:"card",matchTag:/^(article|div|section)$/i},{keyword:"section",matchTag:/^(section|main|article)$/i}],io=.4;function Y(t,e){if(e){let i=e.get(t.toLowerCase().trim());if(i)try{let s=document.querySelector(i);if(s instanceof HTMLElement&&K(s))return s}catch{}}let n=rt(t);if(n.size===0)return null;let o=ao(document.body),r=null;for(let i of o){if(!i.visible)continue;let s=so(i,t,n);s<io||(!r||s>r.score)&&(r={c:i,score:s})}return r?.c.element??null}function rt(t){return new Set(t.toLowerCase().replace(/[^a-z0-9 ]/g," ").split(/\s+/).filter(e=>e.length>0&&!oo.has(e)))}function ao(t){let e=[],n=document.createTreeWalker(t,NodeFilter.SHOW_ELEMENT),o=n.nextNode();for(;o;){if(o instanceof HTMLElement){let r=Z(o);r&&e.push({element:o,role:o.getAttribute("role")??o.tagName.toLowerCase(),name:r,visible:K(o)})}o=n.nextNode()}return e}function Z(t){let e=t.getAttribute("aria-labelledby");if(e){let i=e.split(/\s+/).map(s=>document.getElementById(s)?.textContent?.trim()??"").filter(Boolean);if(i.length>0)return i.join(" ")}let n=t.getAttribute("aria-label");if(n)return n.trim();if(t.id){let i=document.querySelector(`label[for="${me(t.id)}"]`);if(i?.textContent)return i.textContent.trim()}let o=t.getAttribute("alt")??t.getAttribute("title");if(o)return o.trim();let r=(t.textContent??"").trim();return r&&r.length<200?r:""}function K(t){if(!t.isConnected)return!1;let e=t.ownerDocument.defaultView?.getComputedStyle(t);return e?!(e.display==="none"||e.visibility==="hidden"||e.opacity==="0"):!0}function so(t,e,n){let o=rt(t.name);if(o.size===0)return 0;let r=0;for(let m of n)o.has(m)&&r++;let i=new Set([...n,...o]).size,s=i===0?0:r/i,a=0,c=e.toLowerCase();for(let m of ro)if(c.includes(m.keyword)&&(m.matchTag.test(t.element.tagName)||t.role===m.matchRole)){a=.15;break}let l=t.element.getAttribute("data-tour-stop"),p=0;if(l){let m=rt(l.replace(/-/g," ")),v=0;for(let y of n)m.has(y)&&v++;v>0&&(p=.5*(v/n.size))}return Math.min(1,s+a+p)}function me(t){return t.replace(/(["\\])/g,"\\$1")}function Ot(t,e){if(e){let i=e.get(t.toLowerCase().trim());if(i)try{let s=document.querySelector(i);if(s instanceof HTMLElement&&K(s))return s}catch{}}let n=rt(t);if(n.size===0)return null;let o=Array.from(document.querySelectorAll("input, textarea, select")).filter(i=>K(i)&&!co(i)),r=null;for(let i of o){let s=po(i,n);s<=0||(!r||s>r.score)&&(r={el:i,score:s})}return r?.el??null}function co(t){let e=(t.getAttribute("type")??"").toLowerCase();return e==="hidden"||e==="submit"||e==="button"||t.disabled}function lo(t){let e=[],n=t.id;if(n){e.push(n);let c=document.querySelector(`label[for="${me(n)}"]`);c?.textContent&&e.push(c.textContent)}let o=t.getAttribute("name");o&&e.push(o);let r=t.getAttribute("data-field")??t.getAttribute("data-testid");r&&e.push(r);let i=t.getAttribute("aria-label");i&&e.push(i);let s=t.getAttribute("placeholder");s&&e.push(s);let a=t.closest("label");return a?.textContent&&e.push(a.textContent),e}var uo=[["phone","mobile","cell","contact","phonenumber","tel","whatsapp"],["pincode","pin","postal","postcode","zip","zipcode"],["name","fullname"],["email","mail","emailaddress"],["address","street","addr","address1"],["city","town"],["state","province","region"],["landmark","apartment","flat","floor"]],fe=new Map;for(let t of uo)for(let e of t)fe.set(e,t[0]);function pe(t){return fe.get(t)??t}function po(t,e){let n=new Set([...e].map(pe)),o=0;for(let r of lo(t)){let i=new Set([...rt(r)].map(pe));if(i.size===0)continue;let s=0;for(let c of n)i.has(c)&&s++;if(s===0)continue;let a=s/n.size;a>o&&(o=a)}return o}var vt="data-sm-ref",mo=6e3,bt=["a[href]","button","input","select","textarea","summary",'[role="button"]','[role="link"]','[role="tab"]','[role="radio"]','[role="checkbox"]','[role="switch"]','[role="option"]','[role="menuitem"]','[role="combobox"]'].join(","),he='h1,h2,h3,[role="heading"],[role="alert"],[role="status"]',fo='dialog[open],[role="dialog"],[role="alertdialog"],[aria-modal="true"]',ho=/(₹|\$|£|€|Rs\.?\s?|INR\s?|USD\s?|AED\s?)\s?\d[\d,]*(\.\d+)?|\d[\d,]*(\.\d+)?\s?(₹|\$|£|€)/,Dt=new Map;function V(t){let e=t;for(;e;){if(e instanceof Element){if(e.tagName==="SHOPPINGMATE-WIDGET")return!0;for(let n of Array.from(e.attributes))if(n.name.startsWith("data-shoppingmate"))return!0}e=e.parentNode}return!1}function go(t){return t.closest('[aria-hidden="true"],[inert]')!==null}function yo(){return(document.body?.getBoundingClientRect().width??0)>0}function bo(t,e){if(!e)return!0;let n=t.getBoundingClientRect();return n.width>0||n.height>0}function vo(t){let e=t.getAttribute("role");if(e)return e;let n=t.tagName.toLowerCase();if(n==="a")return"link";if(/^h[1-6]$/.test(n))return"heading";if(n==="select")return"select";if(n==="textarea")return"textbox";if(n==="input"){let o=(t.getAttribute("type")??"text").toLowerCase();return o==="radio"||o==="checkbox"?o:o==="submit"||o==="button"||o==="reset"?"button":o==="number"?"spinbutton":"textbox"}return n}function wo(t){let e=Z(t);if(e)return e;if(t instanceof HTMLInputElement||t instanceof HTMLTextAreaElement||t instanceof HTMLSelectElement){let n=t.closest("label")?.textContent?.trim();if(n)return n}return t instanceof HTMLInputElement||t instanceof HTMLTextAreaElement?t.placeholder||t.name||"":t instanceof HTMLSelectElement&&t.name||""}function J(t,e=80){let n=t.replace(/\s+/g," ").trim();return n.length>e?`${n.slice(0,e-1)}\u2026`:n}function ko(t,e){let n=[];t instanceof HTMLInputElement&&(e==="radio"||e==="checkbox")?t.checked&&n.push("checked"):t.getAttribute("aria-checked")==="true"&&n.push("checked"),t.getAttribute("aria-selected")==="true"&&n.push("selected"),t.getAttribute("aria-pressed")==="true"&&n.push("pressed");let o=t.getAttribute("aria-expanded");if(o==="true"&&n.push("expanded"),o==="false"&&n.push("collapsed"),(t.disabled||t.getAttribute("aria-disabled")==="true")&&n.push("disabled"),t instanceof HTMLInputElement&&e!=="radio"&&e!=="checkbox"&&((t.getAttribute("type")??"text").toLowerCase()==="password"?t.value&&n.push("filled"):t.value&&n.push(`value="${J(t.value,40)}"`)),t instanceof HTMLTextAreaElement&&t.value&&n.push(`value="${J(t.value,40)}"`),t instanceof HTMLSelectElement){let r=t.selectedOptions[0];r&&n.push(`value="${J(r.textContent??"",40)}"`)}return n}function xo(t){let e=t.getBoundingClientRect();if(e.width===0&&e.height===0&&e.top===0)return!0;let n=window.innerHeight||800;return e.bottom>-n&&e.top<n*2}function _o(t){return t.closest('footer,[role="contentinfo"]')!==null}function So(){return Array.from(document.querySelectorAll(fo)).filter(e=>K(e)&&!V(e))}function Co(t){if(t.children.length>0)return!1;let e=(t.textContent??"").trim();return!e||e.length>40?!1:ho.test(e)}function tt(t={}){let e=t.maxChars??mo,n=[];for(let h of Array.from(document.querySelectorAll(`[${vt}]`)))h.removeAttribute(vt);Dt=new Map;let o=So(),r=[],i=new Set,s=0,a=yo(),c=(h,d,u)=>{if(i.has(h)||V(h)||!K(h)||go(h)||!bo(h,a)||h instanceof HTMLInputElement&&h.type==="hidden")return;i.add(h);let k=d==="price"?"text":vo(h),x=d==="price"?J(h.textContent??"",40):J(wo(h)),T=d==="price"?[]:ko(h,k);if(!x&&T.length===0&&d!=="interactive"||!x&&d==="interactive"&&(k==="link"||k==="button"))return;let P=!u&&_o(h),D=!u&&h.closest('nav,header,[role="navigation"],[role="banner"]')!==null;if(t.collapse&&k==="link"&&(P||D)){let U=ot(k,x);if(U&&t.collapse.has(U)){n.length<12&&x.length<=24&&!/\d{3}|@/.test(x)&&!n.includes(x)&&n.push(x);return}}let $=u?0:d==="interactive"?2:d==="context"?1:2;!u&&!xo(h)&&($+=3),P&&($+=4),D&&($+=2);let nt=T.length>0?` (${T.join(", ")})`:"",F=`${k} "${x}"${nt}`;r.push({el:h,line:F,priority:$,order:s++})};for(let h of o){let d=J(Z(h)||"dialog",60);r.push({el:h,line:`dialog "${d}" (open)`,priority:0,order:s++}),i.add(h);for(let u of Array.from(h.querySelectorAll(`${bt},${he}`)))c(u,u.matches(bt)?"interactive":"context",!0)}let l=document.querySelector('main,[role="main"]')??document.body,p=l===document.body?[document.body]:[l,document.body];for(let h of p)for(let d of Array.from(h.querySelectorAll(`${bt},${he}`)))c(d,d.matches(bt)?"interactive":"context",!1);let m=0;for(let h of Array.from(l.querySelectorAll("span,div,p,strong,b,s,del,ins,bdi"))){if(m>=15)break;if(!Co(h))continue;let d=r.length;c(h,"price",!1),r.length>d&&(m+=1)}let v=[`[page] ${J(document.title||"",70)} \xB7 ${location.pathname}`,...t.preface??[]];n.length>0&&v.push(`[site links] ${n.join(", ")} (standard site navigation \u2014 use site.navigate)`);let y=[...r].sort((h,d)=>h.priority-d.priority||h.order-d.order),C=[],M=v.join(`
`).length+1;for(let h of y){let d=h.line.length+8;M+d>e||(C.push(h),M+=d)}C.sort((h,d)=>h.order-d.order);let w=[...v],b=0;for(let h of C){b+=1;let d=`e${b}`;h.el.setAttribute(vt,d),Dt.set(d,h.el),w.push(`[${d}] ${h.line}`)}let L=r.length-C.length;L>0&&w.push(`\u2026 ${L} more elements not shown (lower on the page or in the footer)`);let R=w.join(`
`);return{text:R,refs:b,chars:R.length,truncated:L}}function wt(t){let e=t.replace(/^\[|\]$/g,"").trim(),n=Dt.get(e);if(n?.isConnected)return n;try{let o=document.querySelector(`[${vt}="${CSS.escape(e)}"]`);return o?.isConnected?o:null}catch{return null}}var ge={start:()=>{},stop:()=>{}};function Vt(t){if(!t||typeof window>"u")return ge;let e=window.AudioContext??window.webkitAudioContext;if(!e)return ge;let n=null,o=null;return{start(){if(!n)try{n=new e;let r=Math.floor(n.sampleRate*2),i=n.createBuffer(1,r,n.sampleRate),s=i.getChannelData(0),a=0;for(let p=0;p<r;p++){let m=Math.random()*2-1;a=(a+.02*m)/1.02,s[p]=a*3.5}o=n.createBufferSource(),o.buffer=i,o.loop=!0;let c=n.createBiquadFilter();c.type="lowpass",c.frequency.value=900;let l=n.createGain();l.gain.value=.02,o.connect(c).connect(l).connect(n.destination),o.start(),n.resume?.().catch(()=>{})}catch{this.stop()}},stop(){try{o?.stop()}catch{}o=null;try{n?.close()}catch{}n=null}}}function it(){let t=globalThis,e=t.SpeechRecognition??t.webkitSpeechRecognition;if(!e)return null;let n=new e;n.continuous=!0,n.interimResults=!1,n.lang="en-US";let o=!1,r=[],i=[];return n.onresult=s=>{for(let a=0;a<s.results.length;a+=1){let c=s.results[a];if(c?.isFinal){let l=c[0]?.transcript?.trim();if(l)for(let p of r)p(l)}}},n.onerror=s=>{for(let a of i)a(String(s?.error??"unknown"))},n.onend=()=>{o=!1},{start:()=>{if(!o){o=!0;try{n.start()}catch{}}},stop:()=>{if(o){o=!1;try{n.stop()}catch{}}},onFinal:s=>{r.push(s)},onError:s=>{i.push(s)},isActive:()=>o}}function kt(){let t=globalThis.speechSynthesis;if(!t)return{speak:async()=>{},cancel:()=>{},available:()=>!1};function e(){if(!t)return null;let n=t.getVoices();return n.find(o=>o.lang.startsWith("en-")&&o.default)??n.find(o=>o.lang.startsWith("en-"))??n[0]??null}return{speak:n=>new Promise(o=>{let r=new SpeechSynthesisUtterance(n),i=e();i&&(r.voice=i),r.rate=1,r.onend=()=>o(),r.onerror=()=>o(),t.speak(r)}),cancel:()=>t.cancel(),available:()=>!0}}function et(t,e){let n="idle",o=!1,r=[],i=s=>{if(n!==s){n=s;for(let a of r)a(s)}};return{start:()=>{if(n==="idle"){if(o){i("muted");return}t?.start(),i("listening")}},stop:()=>{t?.stop(),e.cancel(),i("idle")},speak:async s=>{n!=="idle"&&(t?.stop(),i("speaking"),await e.speak(s),o?i("muted"):(t?.start(),i("listening")))},setMuted:s=>{o=s,s?(t?.stop(),n==="listening"&&i("muted")):n==="muted"&&(t?.start(),i("listening"))},getState:()=>n,onStateChange:s=>{r.push(s)}}}function To(t){if(!t||typeof t.type!="string")return!1;switch(t.type){case"navigate":return typeof t.path=="string";case"click":return typeof t.intent=="string"&&(t.ref===void 0||typeof t.ref=="string");case"scroll_to":case"highlight":case"point_at":case"demo_click":return typeof t.intent=="string";case"cart_add":case"cart_set_qty":return typeof t.sku=="string"&&typeof t.qty=="number";case"open_cart":case"cart_clear":case"cart_get":case"checkout_place":case"checkout_state":case"page_snapshot":return!0;case"apply_coupon":return typeof t.code=="string";case"product_lookup":return typeof t.handle=="string";case"checkout_fill":return!!t.details&&typeof t.details.name=="string"&&typeof t.details.phone=="string"&&typeof t.details.email=="string"&&typeof t.details.address=="string"&&typeof t.details.city=="string"&&typeof t.details.state=="string"&&typeof t.details.pincode=="string"&&(t.details.payment==="cod"||t.details.payment==="prepaid");case"form_fill":return Array.isArray(t.fields)&&t.fields.every(e=>e&&typeof e.field=="string"&&typeof e.value=="string"&&(e.ref===void 0||typeof e.ref=="string"));case"form_read":return t.fields===void 0||Array.isArray(t.fields);default:return!1}}function O(t){return JSON.stringify(t)}function Wt(t){let e;try{e=JSON.parse(t)}catch{return null}if(!e||typeof e!="object")return null;let n=e;switch(n.type){case"thinking":return{type:"thinking"};case"say":return typeof n.text=="string"?{type:"say",text:n.text}:null;case"say_partial":return typeof n.text=="string"?{type:"say_partial",text:n.text}:null;case"user_text":return typeof n.text=="string"?{type:"user_text",text:n.text}:null;case"cards":return Array.isArray(n.items)?{type:"cards",items:n.items}:null;case"tool_result":return typeof n.toolName!="string"||typeof n.ok!="boolean"?null:{type:"tool_result",toolName:n.toolName,ok:n.ok,summary:typeof n.summary=="string"?n.summary:void 0};case"checkout_redirect":return typeof n.url=="string"?{type:"checkout_redirect",url:n.url}:null;case"cap_warning":return n.reason!=="turns"&&n.reason!=="voice_ms"&&n.reason!=="duration_ms"||typeof n.remaining!="number"?null:{type:"cap_warning",reason:n.reason,remaining:n.remaining};case"end_of_turn":return{type:"end_of_turn"};case"session_closed":return n.reason!=="user"&&n.reason!=="cap"&&n.reason!=="error"?null:{type:"session_closed",reason:n.reason};case"host_action_request":{if(typeof n.callId!="string"||!n.action)return null;let o=n.action;return To(o)?{type:"host_action_request",callId:n.callId,action:o}:null}case"persona_swap":return typeof n.personaId=="string"?{type:"persona_swap",personaId:n.personaId}:null;case"agent_warmed":return{type:"agent_warmed"};case"agent_ready":return{type:"agent_ready"};default:return null}}var ye="https://cdn.jsdelivr.net/npm",Eo="2.7.0",Ao="0.3.0",xt=null;function Mo(){return xt||(xt=import(`${ye}/@livekit/krisp-noise-filter@${Ao}/dist/index.mjs`).catch(()=>null),xt)}async function Io(t){let e=await Mo();if(!e?.KrispNoiseFilter||e.isKrispNoiseFilterSupported&&!e.isKrispNoiseFilterSupported())return;let n=t.localParticipant.getTrackPublication?.("microphone"),o=n?.audioTrack??n?.track;o?.setProcessor&&await o.setProcessor(e.KrispNoiseFilter())}var X=null;function be(){return X||(typeof globalThis.__SHOPPINGMATE_LIVEKIT_LOADER__=="function"?(X=globalThis.__SHOPPINGMATE_LIVEKIT_LOADER__(),X):(X=import(`${ye}/livekit-client@${Eo}/dist/livekit-client.esm.mjs`),X))}function zt(){be().catch(()=>{X=null})}function Lo(){try{if(typeof window<"u"){let e=window;if(typeof e.__SM_AUDIO_FULL__=="boolean")return e.__SM_AUDIO_FULL__}let t=new URLSearchParams(location.search).get("smAudioFull");return!(t==="0"||t==="false")}catch{return!0}}async function ve(t){let e=await be(),n=Lo(),o=new e.Room({audioCaptureDefaults:{echoCancellation:!0,noiseSuppression:!0,autoGainControl:n,channelCount:1}}),r=new Map,i=!1;o.on("trackSubscribed",a=>{let c=a;if(c.kind!=="audio")return;let l=c.attach();l.style.display="none",l.muted=i,document.body.appendChild(l),r.set(a,l)}),o.on("trackUnsubscribed",a=>{let c=r.get(a);c&&(c.remove(),r.delete(a)),a.detach?.()});let s=[];return o.on("activeSpeakersChanged",a=>{let l=(a??[]).some(p=>!p.isLocal);for(let p of s)p(l)}),await o.connect(t.wsUrl,t.token),{setMicEnabled:async a=>{await o.localParticipant.setMicrophoneEnabled(a),a&&n&&Io(o).catch(()=>{})},onData:a=>{o.on("dataReceived",c=>{c instanceof Uint8Array&&a(c)})},onAgentSpeaking:a=>{s.push(a)},setAgentAudioMuted:a=>{i=a;for(let c of r.values())c.muted=a},onReconnected:a=>{o.on("reconnected",()=>a())},publishData:a=>o.localParticipant.publishData(a,{reliable:!0}),disconnect:async()=>{for(let a of r.values())a.remove();r.clear(),await o.disconnect()}}}function we(t){let e="idle",n=null,o=null,r=!1,i=!1,s=!1,a=6e4,c=null,l=null,p=()=>{c&&clearTimeout(c),c=null},m=0,v=null,y=u=>{v&&!(u in v)&&(v[u]=Math.round(performance.now()-m))},C=()=>{if(!v||!n)return;let u=O({type:"voice_timing",sessionId:t.sessionId,timings:v});v=null,n.publishData(new TextEncoder().encode(u)).catch(()=>{})},M=[],w=[],b=u=>{if(e!==u){e=u;for(let k of M)k(u)}},L=u=>{let k=u instanceof Error?u.message:String(u),x=u instanceof Error?u.name:"",T;/permissions? policy|feature policy/i.test(k)?T="mic_policy_blocked":x==="NotAllowedError"||/denied|permission/i.test(k)?T="mic_denied":x==="NotFoundError"||/no.*microphone|not.*found/i.test(k)?T="mic_unavailable":/connect|network|websocket|timeout|token/i.test(k)?T="connect_failed":T="unknown";for(let P of w)P({code:T,message:k})},R=async u=>{await u.setMicEnabled(!r);let k=new TextEncoder().encode(O({type:"start_voice",sessionId:t.sessionId}));await u.publishData(k)},h=()=>{p(),!s&&(c=setTimeout(()=>{s||!n||(n.disconnect().catch(()=>{}),n=null,o=null)},a))},d=()=>n?(h(),Promise.resolve(n)):o||(o=(async()=>{let u=await ve({wsUrl:t.wsUrl,token:t.token,roomName:t.roomName});return u.onData(k=>t.onTranscriptEvent(k)),u.onAgentSpeaking(k=>{k&&v&&(y("first_audio"),C()),!r&&(k&&(i=!0,l&&clearTimeout(l),l=null),i&&b(k?"speaking":"listening"))}),u.onReconnected(()=>{s&&(b("connecting"),i=!1,R(u).catch(k=>console.warn("[voiceModeLiveKit] re-start after reconnect failed",k)))}),n=u,h(),u})(),o.catch(()=>{o=null}),o);return{warm:()=>{d().catch(u=>console.warn("[voiceModeLiveKit] warm failed",u))},start:()=>{e==="idle"&&(b("connecting"),i=!1,p(),m=performance.now(),v={was_warm:n?1:0},(async()=>{try{let u=await d();p(),y("room_connected"),await R(u),y("mic_on"),globalThis.__smVoiceMicOnAt=Date.now(),s=!0,r&&b("muted")}catch(u){throw b("idle"),L(u),u}})().catch(u=>{console.warn("[voiceModeLiveKit] start failed",u)}))},stop:()=>{p(),l&&clearTimeout(l),l=null,v&&(y("hung_up"),C()),n?.disconnect().catch(()=>{}),n=null,o=null,s=!1,b("idle")},speak:async()=>{},setMuted:u=>{r=u,n?.setMicEnabled(!u).catch(()=>{}),n?.setAgentAudioMuted(u),u?b("muted"):e==="muted"&&b("listening")},getState:()=>e,onStateChange:u=>{M.push(u)},onError:u=>{w.push(u)},signalAgentReady:()=>{y("agent_ready"),e==="connecting"&&!l&&(l=setTimeout(()=>{l=null,i=!0,e==="connecting"&&b(r?"muted":"listening")},8e3))},publishData:async u=>{n&&await n.publishData(u)}}}function at(t){return t.stack==="web-speech"?et(it(),kt()):t.stack==="live-kit"?t.livekit?we(t.livekit):(console.warn("[voiceModeFactory] live-kit stack requires livekit opts; returning null \u2192 caller falls back to chat"),null):null}async function ke(t){if(t.platform!=="shopify")return;let e=t.fetchFn??fetch;try{await e("/cart/update.js",{method:"POST",credentials:"same-origin",headers:{"Content-Type":"application/json"},body:JSON.stringify({attributes:{sm_visitor_id:t.visitorId}})})}catch{}}var Ft={"Content-Type":"application/json"};function xe(t){let e=Number(String(t).trim());return Number.isFinite(e)&&e>0?e:null}function Ut(t){try{let e={cart:t},n=["cart:refresh","cart:updated","cart:change","cart:build","cart:rerender","ajaxCart:afterCartLoad","cart.requestComplete","added.ajaxProduct"];for(let i of n)document.dispatchEvent(new CustomEvent(i,{bubbles:!0,detail:e})),window.dispatchEvent(new CustomEvent(i,{bubbles:!0,detail:e}));let o=window;typeof o.getCartUpdate=="function"&&o.getCartUpdate(),typeof o.after_add_to_cart=="function"&&o.after_add_to_cart(t);let r=o.jQuery;if(r)try{r(document.body).trigger("cart:updated",[t]),r(document.body).trigger("added.ajaxProduct")}catch{}}catch{}Ro()}var Po=["cart-icon-bubble","cart-live-region-text","cart-notification-button","cart-drawer"];async function Ro(t=fetch){try{let e=Po.filter(i=>document.getElementById(`shopify-section-${i}`)||document.getElementById(i));if(e.length===0)return 0;let n=await t(`${location.pathname}?sections=${e.join(",")}`,{credentials:"same-origin"});if(!n.ok)return 0;let o=await n.json(),r=0;for(let[i,s]of Object.entries(o)){if(!s)continue;let a=document.getElementById(`shopify-section-${i}`)??document.getElementById(i);if(!a)continue;let c=new DOMParser().parseFromString(s,"text/html"),l=c.getElementById(`shopify-section-${i}`)??c.querySelector(".shopify-section")??c.body;a.innerHTML=l.innerHTML,r+=1}return r}catch{return 0}}async function _e(t,e=fetch){let n=String(t??"").trim().replace(/^\/?products\//,"").replace(/[?#].*$/,"").replace(/\/$/,"");if(!n)return{ok:!1,reason:"not_found"};try{let o=await e(`/products/${encodeURIComponent(n)}.js`,{credentials:"same-origin"});if(!o.ok)return{ok:!1,reason:"not_found"};let r=await o.json(),i=(r.variants??[]).slice(0,30).map(s=>`${s.title??"Default"} (variantId ${s.id}, ${s.available?"in stock":"SOLD OUT"}${s.price!=null?`, ${(s.price/100).toFixed(2)}`:""})`).join("; ");return{ok:!0,channel:"shopify-ajax",values:{title:r.title??n,available:String(r.available??!1),variants:i}}}catch{return{ok:!1,reason:"not_found"}}}async function jt(t){try{let e=await t("/cart.js",{credentials:"same-origin"});return e.ok?await e.json():null}catch{return null}}function Bt(t){let e=(t.items??[]).map(n=>`${n.product_title??"item"}${n.variant_title?` ${n.variant_title}`:""} x${n.quantity}`).join(", ");return{count:String(t.item_count??0),items:e,subtotal:t.total_price!=null?(t.total_price/100).toFixed(2):""}}async function Se(t,e,n=fetch){let o=xe(t);if(o==null)return{ok:!1,reason:"not_found"};try{if(!(await n("/cart/add.js",{method:"POST",credentials:"same-origin",headers:Ft,body:JSON.stringify({id:o,quantity:e>0?e:1})})).ok)return{ok:!1,reason:"not_found"};let i=await jt(n);return i&&i.items.some(s=>s.id===o)?(Ut(i),{ok:!0,values:Bt(i)}):{ok:!1,reason:"not_found"}}catch{return{ok:!1,reason:"not_found"}}}async function Ce(t=fetch){let e=await jt(t);return e?{ok:!0,values:Bt(e)}:{ok:!1,reason:"not_found"}}async function Te(t,e,n=fetch){let o=xe(t);if(o==null)return{ok:!1,reason:"not_found"};try{let r=await n("/cart/change.js",{method:"POST",credentials:"same-origin",headers:Ft,body:JSON.stringify({id:o,quantity:Math.max(0,e)})});if(!r.ok)return{ok:!1,reason:"not_found"};let i=await r.json().catch(()=>null);return Ut(i),i?{ok:!0,values:Bt(i)}:{ok:!0}}catch{return{ok:!1,reason:"not_found"}}}async function Ee(t=fetch){try{return(await t("/cart/clear.js",{method:"POST",credentials:"same-origin",headers:Ft})).ok?(Ut(await jt(t)),{ok:!0}):{ok:!1,reason:"not_found"}}catch{return{ok:!1,reason:"not_found"}}}async function Ae(t,e=fetch){let n=String(t??"").trim();if(!n)return{ok:!1,reason:"not_found"};try{return await e(`/discount/${encodeURIComponent(n)}`,{method:"GET",credentials:"same-origin",redirect:"manual"})?{ok:!0}:{ok:!1,reason:"not_found"}}catch{return{ok:!1,reason:"not_found"}}}var Me="/wp-json/wc/store/v1",st=null;function Ho(){let t={"Content-Type":"application/json"};return st&&(t.Nonce=st,t["X-WC-Store-API-Nonce"]=st),t}function Ie(t){let e=t.headers.get("Nonce")??t.headers.get("X-WC-Store-API-Nonce");e&&(st=e)}async function j(t){try{let e=await t(`${Me}/cart`,{credentials:"same-origin"});return Ie(e),e.ok?await e.json():null}catch{return null}}function St(t){let e=t.totals?.currency_minor_unit??2,n=t.totals?.total_price;return{count:String(t.items_count??0),items:(t.items??[]).map(o=>`${o.name??"item"} x${o.quantity}`).join(", "),subtotal:n!=null?(Number(n)/10**e).toFixed(e):""}}function qt(){try{document.body.dispatchEvent(new CustomEvent("wc-blocks_added_to_cart",{bubbles:!0}));let t=window.jQuery;t?.(document.body).trigger("wc_fragment_refresh")}catch{}}function Le(t){let e=Number(String(t).trim());return Number.isFinite(e)&&e>0?e:null}async function _t(t,e,n){st||await j(n);let o=await n(`${Me}${t}`,{method:"POST",credentials:"same-origin",headers:Ho(),body:JSON.stringify(e)});return Ie(o),o}async function Pe(t,e,n=fetch){let o=Le(t);if(o==null)return{ok:!1,reason:"not_found"};try{let r=(await j(n))?.items.find(c=>c.id===o)?.quantity??0;if(!(await _t("/cart/add-item",{id:o,quantity:e>0?e:1},n)).ok)return{ok:!1,reason:"not_found"};let s=await j(n),a=s?.items.find(c=>c.id===o)?.quantity??0;return!s||a<=r?{ok:!1,reason:"not_found"}:(qt(),{ok:!0,channel:"woo-store-api",verified:!0,values:St(s)})}catch{return{ok:!1,reason:"not_found"}}}async function Re(t=fetch){let e=await j(t);return e?{ok:!0,channel:"woo-store-api",values:St(e)}:{ok:!1,reason:"not_found"}}async function He(t,e,n=fetch){let o=Le(t);if(o==null)return{ok:!1,reason:"not_found"};try{let r=(await j(n))?.items.find(c=>c.id===o);if(!r)return{ok:!1,reason:"not_found"};if(!(e<=0?await _t("/cart/remove-item",{key:r.key},n):await _t("/cart/update-item",{key:r.key,quantity:e},n)).ok)return{ok:!1,reason:"not_found"};let s=await j(n),a=s?.items.find(c=>c.id===o)?.quantity??0;return!s||a!==Math.max(0,e)?{ok:!1,reason:"not_found"}:(qt(),{ok:!0,channel:"woo-store-api",verified:!0,values:St(s)})}catch{return{ok:!1,reason:"not_found"}}}async function Ne(t=fetch){try{let e=await j(t);for(let o of e?.items??[])await _t("/cart/remove-item",{key:o.key},t);let n=await j(t);return!n||n.items.length>0?{ok:!1,reason:"not_found"}:(qt(),{ok:!0,channel:"woo-store-api",verified:!0,values:St(n)})}catch{return{ok:!1,reason:"not_found"}}}var No="data-shoppingmate-bot-cursor",$e="data-shoppingmate-cursor-keyframes",ct=null,Gt=window.innerWidth-80,Kt=window.innerHeight-80;function Oe(){if(ct&&ct.isConnected)return ct;$o();let t=document.createElement("div");return t.setAttribute(No,""),t.innerHTML=`
    <svg width="22" height="22" viewBox="0 0 22 22" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path d="M3 2 L3 17 L7 13 L9.5 19 L12 18 L9.5 12 L15 12 Z"
            fill="#111827" stroke="#fff" stroke-width="1.2" stroke-linejoin="round"/>
    </svg>
  `,Object.assign(t.style,{position:"fixed",left:"0",top:"0",transform:`translate(${Gt}px, ${Kt}px)`,transition:"transform 480ms cubic-bezier(0.22, 1, 0.36, 1), opacity 200ms",pointerEvents:"none",zIndex:"2147483647",opacity:"0",willChange:"transform, opacity",filter:"drop-shadow(0 2px 6px rgba(0,0,0,0.25))"}),document.body.appendChild(t),ct=t,t}function $o(){if(document.head.querySelector(`style[${$e}]`))return;let t=document.createElement("style");t.setAttribute($e,""),t.textContent=`
    @keyframes shoppingmate-cursor-click {
      0%   { transform: var(--sm-cursor-pos) scale(1); }
      40%  { transform: var(--sm-cursor-pos) scale(0.72); }
      100% { transform: var(--sm-cursor-pos) scale(1); }
    }
  `,document.head.appendChild(t)}function Oo(t){let e=t.getBoundingClientRect();return{x:e.left+e.width/2-6,y:e.top+e.height/2-6}}function Q(t,e=480){let n=Oe(),{x:o,y:r}=Oo(t);return n.style.transitionDuration=`${e}ms, 200ms`,n.style.opacity="1",n.style.transform=`translate(${o}px, ${r}px)`,Gt=o,Kt=r,new Promise(i=>setTimeout(i,e))}function lt(){let t=Oe();return t.style.setProperty("--sm-cursor-pos",`translate(${Gt}px, ${Kt}px)`),t.style.animation="shoppingmate-cursor-click 280ms ease-out",new Promise(e=>{let n=()=>{t.style.animation="",t.removeEventListener("animationend",n),e()};t.addEventListener("animationend",n),setTimeout(n,360)})}function B(t=600){let e=ct;e&&setTimeout(()=>{e.style.opacity="0"},t)}function Do(t,e){let n=t instanceof HTMLTextAreaElement?HTMLTextAreaElement.prototype:t instanceof HTMLSelectElement?HTMLSelectElement.prototype:HTMLInputElement.prototype,o=Object.getOwnPropertyDescriptor(n,"value");o?.set?o.set.call(t,e):t.value=e,t.dispatchEvent(new Event("input",{bubbles:!0})),t.dispatchEvent(new Event("change",{bubbles:!0}))}function Yt(t){return t.value??""}var De="sm_selector_cache_v1";function Vo(){try{return JSON.parse(localStorage.getItem(De)??"{}")}catch{return{}}}function Wo(t){try{localStorage.setItem(De,JSON.stringify(t))}catch{}}function zo(t){return`${location.pathname}::${t}`}function Fo(t){let e=t.getAttribute("data-sm-field");if(e)return`[data-sm-field="${CSS.escape(e)}"]`;if(t.id)return`#${CSS.escape(t.id)}`;let n=t.getAttribute("name");return n?`[name="${CSS.escape(n)}"]`:null}function Uo(t,e){let n=Vo(),o=zo(t),r=n[o];if(r)try{let s=document.querySelector(r);if(s?.isConnected)return s}catch{}let i=null;try{i=document.querySelector(`[data-sm-field="${CSS.escape(t)}"]`)}catch{i=null}if(i||(i=Ot(t,e)),i){let s=Fo(i);s&&(n[o]=s,Wo(n))}return i}function Ve(t,e){let n={},o=[],r=!1;for(let{field:i,value:s,ref:a}of t){let c=a?wt(a):null,l=c&&/^(INPUT|TEXTAREA|SELECT)$/.test(c.tagName)?c:Uo(i,e);if(!l){o.push({field:i,ok:!1,value:""});continue}r=!0,Do(l,s);let p=Yt(l);n[i]=p,o.push({field:i,ok:p===s,value:p})}return r?{ok:!0,values:n,filled:o}:{ok:!1,reason:"not_found"}}function We(t,e){let n={};if(t&&t.length>0){for(let r of t){let i=Ot(r,e);i&&(n[r]=Yt(i))}return{ok:!0,values:n}}let o=document.querySelectorAll("input, textarea, select");for(let r of o){let i=(r.getAttribute("type")??"").toLowerCase();if(i==="password"||i==="hidden")continue;let s=r.getAttribute("name")??r.id;s&&(n[s]=Yt(r))}return{ok:!0,values:n}}var jo="data-shoppingmate-pulse-ring";function Fe(t,e){let n=t.getBoundingClientRect(),o=document.createElement("div");o.setAttribute(jo,""),Object.assign(o.style,{position:"fixed",left:`${n.left-6}px`,top:`${n.top-6}px`,width:`${n.width+12}px`,height:`${n.height+12}px`,borderRadius:"14px",boxShadow:"0 0 0 3px rgba(139,92,246,0.85), 0 0 24px rgba(139,92,246,0.55)",pointerEvents:"none",zIndex:"2147483646",animation:"shoppingmate-pulse 1.2s ease-in-out infinite"}),Bo(),document.body.appendChild(o);let r=!1,i=()=>{r||(r=!0,o.remove())};return setTimeout(i,e),i}var ze=!1;function Bo(){if(ze)return;ze=!0;let t=document.createElement("style");t.textContent=`@keyframes shoppingmate-pulse {
    0%, 100% { transform: scale(1); opacity: 1; }
    50% { transform: scale(1.04); opacity: 0.85; }
  }`,document.head.appendChild(t)}var ut=null,Ct=null,Jt=new Set;function Ue(t){ut=t,Ct=null,Jt.clear()}function Tt(t=fetch){if(!ut)return Promise.resolve([]);if(!Ct){let{apiBase:e,merchantId:n}=ut;Ct=t(`${e}/v1/site-templates/${encodeURIComponent(n)}`).then(o=>o.ok?o.json():{templates:[]}).then(o=>Array.isArray(o.templates)?o.templates:[]).catch(()=>[])}return Ct}function Xt(t,e,n,o=fetch){if(!ut)return;let r=`${t}:${e}`;if(Jt.has(r))return;Jt.add(r);let{apiBase:i,merchantId:s,sessionId:a}=ut;o(`${i}/v1/site-templates/${encodeURIComponent(s)}/signal`,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({kind:t,templateId:e,coverage:n,sessionId:a,path:location.pathname}),keepalive:!0}).catch(()=>{})}var qo=["[data-cart-count]","#cart-icon-bubble",".cart-count",".cart-count-bubble",'[class*="cart-count"]','[class*="CartCount"]'].join(",");function je(){return(document.querySelector(qo)?.textContent??"").replace(/\s+/g," ").trim()}function Be(){return Array.from(document.querySelectorAll('dialog[open],[role="dialog"],[aria-modal="true"]')).filter(t=>!V(t)&&t.getAttribute("aria-hidden")!=="true").length}function qe(t){let e=t;return[t.getAttribute("aria-expanded"),t.getAttribute("aria-checked"),t.getAttribute("aria-selected"),t.getAttribute("aria-pressed"),typeof e.checked=="boolean"?String(e.checked):"",t.className].join("|")}async function Qt(t,e,n=1500){let o=location.href,r=je(),i=Be(),s=t?qe(t):"",a=0,c=new MutationObserver(p=>{for(let m of p)V(m.target)||m.type==="attributes"&&m.attributeName==="data-sm-ref"||(a+=1)});c.observe(document.body,{subtree:!0,childList:!0,attributes:!0,characterData:!0});let l=()=>{if(location.href!==o)return{verified:!0,observed:`navigated to ${location.pathname}`};let p=je();if(p!==r)return{verified:!0,observed:`cart count ${r||"0"} \u2192 ${p||"0"}`};let m=Be();return m>i?{verified:!0,observed:"a dialog/drawer opened"}:m<i?{verified:!0,observed:"a dialog/drawer closed"}:t?.isConnected&&qe(t)!==s?{verified:!0,observed:"the control changed state"}:a>0?{verified:!0,observed:"the page updated"}:null};try{await e();let p=Date.now()+n;await new Promise(v=>setTimeout(v,50));let m=l();for(;!m&&Date.now()<p;)await new Promise(v=>setTimeout(v,100)),m=l();return m??{verified:!1,observed:"nothing changed on the page"}}finally{c.disconnect()}}var At=null;function Ge(t){At=t??null}function Et(){if(At==="shopify")return!0;if(At)return!1;try{return typeof window.Shopify<"u"}catch{return!1}}function dt(){return Et()?"shopify-ajax":At==="woocommerce"?"woo-store-api":"storefront-hooks"}async function q(t,e){let n=await e;return n.ok?{channel:t,...n}:n}async function Ke(t){switch(t.type){case"navigate":return Zt(t.path);case"scroll_to":return ar(t.intent);case"highlight":return sr(t.intent,t.durationMs??2e3);case"click":return t.ref?Ko(t.ref,t.intent):cr(t.intent);case"point_at":return lr(t.intent);case"demo_click":return ur(t.intent);case"cart_add":{let e=dt();return e==="shopify-ajax"?q(e,Se(t.sku,t.qty)):e==="woo-store-api"?Pe(t.sku,t.qty):q(e,Qo(t.sku,t.qty))}case"open_cart":return dt()==="woo-store-api"||Et()?Zt("/cart"):Zo();case"cart_set_qty":{let e=dt();return e==="shopify-ajax"?q(e,Te(t.sku,t.qty)):e==="woo-store-api"?He(t.sku,t.qty):q(e,nr(t.sku,t.qty))}case"cart_clear":{let e=dt();return e==="shopify-ajax"?q(e,Ee()):e==="woo-store-api"?Ne():q(e,er())}case"cart_get":{let e=dt();return e==="shopify-ajax"?q(e,Ce()):e==="woo-store-api"?Re():q(e,tr())}case"product_lookup":return Et()?_e(t.handle):{ok:!1,reason:"not_found"};case"apply_coupon":return Et()?Ae(t.code):or(t.code);case"checkout_fill":return Jo(t.details);case"checkout_place":return Xo();case"checkout_state":return Yo();case"form_fill":return Ve(t.fields);case"form_read":return We(t.fields);case"page_snapshot":return Go()}}var Mt=null;async function Go(){let t=performance.now(),e=tt(),n={};Mt=null;let o=await Tt();if(o.length>0){let r=de(yt(e.text),location.pathname,o);if(r.template){Mt=r.template.id;let i=r.template.recipes.slice(0,6).map(s=>`${s.action.replace(/_/g," ")} = ${s.role} "${s.name}"`).join("; ");e=tt({collapse:new Set(r.template.skeleton),preface:[`[template] ${r.template.pageType} page (known layout, ${Math.round(r.coverage*100)}% match)${i?` \xB7 how this page works: ${i}`:""}`]}),n.template=r.template.pageType,n.coverage=r.coverage.toFixed(2)}else r.drift&&(Xt("drift",r.drift.template.id,r.drift.coverage),n.drift=`${r.drift.template.pageType}:${r.drift.coverage.toFixed(2)}`)}return{ok:!0,values:{snapshot:e.text,refs:String(e.refs),chars:String(e.chars),buildMs:String(Math.round(performance.now()-t)),...n}}}function Ye(t){!t&&Mt&&Xt("verify",Mt,0)}function Je(t){let e=t.closest("a[href]");if(!e||e.target==="_blank")return null;try{let n=new URL(e.href,window.location.href);return n.origin!==window.location.origin||n.pathname===window.location.pathname&&n.search===window.location.search?null:n.pathname}catch{return null}}async function Ko(t,e){let n=wt(t)??(e?Y(e):null);if(!n)return{ok:!1,reason:"stale_target"};if(await te(n),await Q(n,420),await lt(),!n.isConnected)return{ok:!1,reason:"stale_target"};let o=Je(n);if(o)return n.click(),B(800),{ok:!0,verified:!0,observed:`navigating to ${o}`};let r=await Qt(n,()=>n.click());return B(800),Ye(r.verified),{ok:!0,verified:r.verified,observed:r.observed}}async function Yo(){let t=window.__shoppingmateCheckoutState__;if(typeof t!="function")return{ok:!1,reason:"not_found"};try{return await t()?{ok:!0}:{ok:!1,reason:"not_found"}}catch{return{ok:!1,reason:"not_found"}}}async function Jo(t){let e=window.__shoppingmateCheckoutFill__;if(typeof e!="function")return{ok:!1,reason:"not_found"};try{return await e(t)?{ok:!0}:{ok:!1,reason:"not_found"}}catch{return{ok:!1,reason:"not_found"}}}async function Xo(){let t=window.__shoppingmatePlaceOrder__;if(typeof t!="function")return{ok:!1,reason:"not_found"};try{return await t()?{ok:!0}:{ok:!1,reason:"not_found"}}catch{return{ok:!1,reason:"not_found"}}}function Qo(t,e){let n=window.__shoppingmateCartAdd__;if(typeof n!="function")return{ok:!1,reason:"not_found"};try{return n(t,e)?{ok:!0}:{ok:!1,reason:"not_found"}}catch{return{ok:!1,reason:"not_found"}}}function Zo(){let t=window.__shoppingmateOpenCart__;if(typeof t!="function")return{ok:!1,reason:"not_found"};try{return t(),{ok:!0}}catch{return{ok:!1,reason:"not_found"}}}function tr(){let t=window.__shoppingmateGetCart__;if(typeof t!="function")return{ok:!1,reason:"not_found"};try{let e=t(),n=(e?.items??[]).map(o=>`${o.sku??o.name??"item"} x${o.quantity??1}`).join(", ");return{ok:!0,values:{count:String(e?.count??0),items:n,subtotal:e?.subtotal!=null?String(e.subtotal):""}}}catch{return{ok:!1,reason:"not_found"}}}function er(){let t=window.__shoppingmateClearCart__;if(typeof t!="function")return{ok:!1,reason:"not_found"};try{return t()?{ok:!0}:{ok:!1,reason:"not_found"}}catch{return{ok:!1,reason:"not_found"}}}function nr(t,e){let n=window.__shoppingmateCartSetQty__;if(typeof n!="function")return{ok:!1,reason:"not_found"};try{return n(t,e)?{ok:!0}:{ok:!1,reason:"not_found"}}catch{return{ok:!1,reason:"not_found"}}}async function or(t){let e=window.__shoppingmateApplyCoupon__;if(typeof e!="function")return{ok:!1,reason:"not_found"};try{return await e(t)?{ok:!0}:{ok:!1,reason:"not_found"}}catch{return{ok:!1,reason:"not_found"}}}function rr(t){let e=window.__shoppingmateNavigate__;if(typeof e=="function")try{return e(t),!0}catch{return!1}return!1}async function Zt(t){try{let e=new URL(t,window.location.href);if(e.origin!==window.location.origin)return{ok:!1,reason:"cross_origin"};let n=ir(e.pathname);n&&(await Q(n,520),await lt());let o=e.pathname+e.search+e.hash;return rr(o)||window.location.assign(o),B(800),{ok:!0}}catch{return{ok:!1,reason:"route_not_found"}}}function ir(t){let e=document.querySelectorAll("a[href]");for(let n of e)try{if(new URL(n.href,window.location.href).pathname===t)return n}catch{}return null}async function ar(t){let e=Y(t);return e?(await Q(e,480),e.scrollIntoView({behavior:"smooth",block:"center"}),B(800),{ok:!0}):{ok:!1,reason:"not_found"}}function sr(t,e){let n=Y(t);return n?(Fe(n,e),{ok:!0}):{ok:!1,reason:"not_found"}}async function cr(t){let e=Y(t);if(!e)return{ok:!1,reason:"not_found"};if(!e.isConnected)return{ok:!1,reason:"stale_target"};if(await Q(e,420),await lt(),!e.isConnected)return{ok:!1,reason:"stale_target"};let n=Je(e);if(n)return e.click(),B(800),{ok:!0,verified:!0,observed:`navigating to ${n}`};let o=await Qt(e,()=>e.click());return B(800),Ye(o.verified),{ok:!0,verified:o.verified,observed:o.observed}}async function te(t){let e=t.getBoundingClientRect(),n=window.innerHeight;(e.bottom<80||e.top>n-80)&&(t.scrollIntoView({behavior:"smooth",block:"center"}),await new Promise(r=>setTimeout(r,350)))}async function lr(t){let e=Y(t);return e?e.isConnected?(await te(e),await Q(e,480),{ok:!0}):{ok:!1,reason:"stale_target"}:{ok:!1,reason:"not_found"}}async function ur(t){let e=Y(t);return e?e.isConnected?(await te(e),await Q(e,420),await lt(),await new Promise(n=>setTimeout(n,120)),e.isConnected?(e.click(),B(800),{ok:!0}):{ok:!1,reason:"stale_target"}):{ok:!1,reason:"stale_target"}:{ok:!1,reason:"not_found"}}var It="sm_visitor_id";function dr(){let t=new Uint8Array(8);return(globalThis.crypto??window.crypto).getRandomValues(t),`v_${Array.from(t,n=>n.toString(16).padStart(2,"0")).join("")}`}function pr(){try{let e=localStorage.getItem(It);if(e){let n=JSON.parse(e);if(n?.id&&typeof n.expiresAt=="number")return n}}catch{}let t=document.cookie.match(new RegExp(`(?:^|; )${It}=([^;]+)`));return t?{id:decodeURIComponent(t[1]??""),expiresAt:Date.now()+1}:null}function Xe(t){try{localStorage.setItem(It,JSON.stringify(t));let e=Math.floor(6048e5/1e3);document.cookie=`${It}=${t.id}; max-age=${e}; path=/; SameSite=Lax; Secure`}catch{}}function pt(){let t=Date.now(),e=pr();if(e&&e.expiresAt>t)return Xe({id:e.id,expiresAt:t+6048e5}),e.id;let n=dr();return Xe({id:n,expiresAt:t+6048e5}),n}var mt=[200,500],Qe=t=>new Promise(e=>setTimeout(e,t));async function ee(t,e){let n;for(let o=0;o<=mt.length;o++)try{let r=await fetch(t,e);if(r.status>=500&&o<mt.length){await Qe(mt[o]??0);continue}return r}catch(r){if(n=r,o<mt.length){await Qe(mt[o]??0);continue}throw r}throw n}async function Ze(t){try{let e=pt(),n=await ee(`${t.apiBase}/v1/install`,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({merchantId:t.merchantId,domain:t.domain,userAgent:navigator.userAgent,referrer:document.referrer||null})});if(!n.ok)return{kind:"err",reason:`install_${n.status}`};let o=await n.json();Ge(o.platform??null),ke({visitorId:e,platform:o.platform??"custom"});let r=await ee(`${t.apiBase}/v1/session`,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({merchantId:t.merchantId,domain:t.domain})});if(!r.ok)return{kind:"err",reason:`session_${r.status}`};let i=await r.json(),s=null;try{let a=await ee(`${t.apiBase}/v1/voice/token`,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({sessionId:i.sessionId,merchantId:t.merchantId,visitorId:e})});a.ok?s=await a.json():console.warn("[shoppingmate] voice unavailable \u2014 status",a.status)}catch(a){console.warn("[shoppingmate] voice unavailable \u2014",a)}return{kind:"ok",sessionId:i.sessionId,wsUrl:i.wsUrl,merchantStatus:o.status,personaId:o.personaId??s?.personaId??null,widgetPosition:o.widgetPosition??null,widgetSize:o.widgetSize??null,widgetAccent:o.widgetAccent??null,widgetLabel:o.widgetLabel??null,widgetGreeting:o.widgetGreeting??null,voice:s,visitorId:e,insights:o.insights??null,care:o.care??null}}catch(e){return{kind:"err",reason:e instanceof Error?e.message:"network"}}}var nn=24e3,tn=48e3,Lt=640,mr=6e4,fr=8e3,Pt="https://cdn.jsdelivr.net/npm/@sapphi-red/web-noise-suppressor@0.4.1",hr=`
class SmCap extends AudioWorkletProcessor {
  // Decimate to 16 kHz, then a speech gate (like Krisp gives LiveKit): only
  // speech passes, everything else becomes true silence so Gemini sees clean
  // pauses and ends the turn. 10 ms frames, adaptive noise floor, 100 ms
  // look-back so the first syllable isn't clipped, 600 ms hold so a normal
  // pause between words never reads as the end of the turn (200 ms felt like
  // being cut off \u2014 Karan, 2026-10-14). Thresholds loosened 2026-10-27: on
  // Karan's phone 91% of frames were gated to silence and soft word endings
  // were dropped; the server's turn detector now decides what is speech.
  constructor(){super();this.r=sampleRate/16000;this.pos=0;
    // Anti-alias low-pass (windowed sinc, ~7 kHz) before dropping to 16 kHz: the old
    // 3-sample average folded the 8\u201324 kHz content of real phone mics back into
    // the speech band as distortion (TTS tests never showed it \u2014 little HF energy).
    this.N=63;this.taps=new Float32Array(this.N);{const fc=7000/sampleRate,M=this.N-1;let sum=0;
      for(let k=0;k<this.N;k++){const x=k-M/2;const sinc=x===0?2*fc:Math.sin(2*Math.PI*fc*x)/(Math.PI*x);
        const w=0.42-0.5*Math.cos(2*Math.PI*k/M)+0.08*Math.cos(4*Math.PI*k/M);this.taps[k]=sinc*w;sum+=this.taps[k];}
      for(let k=0;k<this.N;k++)this.taps[k]/=sum;}
    this.ring=new Float32Array(this.N);this.ri=0;
    this.f=new Float32Array(160);this.fi=0;this.hist=[];this.floor=0.01;this.run=0;this.hold=0;this.open=false;this.duck=false;
    // Echo guard: while Olivia is speaking, require louder input to open the gate.
    this.bypass=false;
    this.port.onmessage=(e)=>{if(e.data&&typeof e.data.duck==='boolean')this.duck=e.data.duck;if(e.data&&typeof e.data.bypass==='boolean')this.bypass=e.data.bypass;};}
  frame(fr){if(this.bypass){this.port.postMessage(fr);return;}let s=0;for(let i=0;i<160;i++)s+=fr[i]*fr[i];const rms=Math.sqrt(s/160);
    if(rms<this.floor)this.floor=this.floor*0.9+rms*0.1;else this.floor=this.floor*0.9995+rms*0.0005;
    const thr=Math.max(0.006,this.floor*2.5);const speech=rms>thr;
    // Echo guard applies to OPENING only: once the visitor is talking, a
    // "mm-hmm" or reply starting must never swallow their next words.
    const opens=rms>thr*(this.duck?3:1);
    this.run=opens?this.run+1:0;
    if(!this.open&&this.run>=2){this.open=true;
      const out=new Float32Array(160*(this.hist.length+1));let o=0;for(const h of this.hist){out.set(h,o);o+=160;}out.set(fr,o);
      this.hist=[];this.hold=60;this.port.postMessage(out);return;}
    if(this.open){if(speech)this.hold=60;else if(--this.hold<=0)this.open=false;}
    if(this.open){this.port.postMessage(fr);}
    else{this.hist.push(fr);if(this.hist.length>10)this.hist.shift();this.port.postMessage(new Float32Array(160));}}
  process(inputs){const ch=inputs[0]&&inputs[0][0];if(!ch)return true;
    for(let i=0;i<ch.length;i++){this.ring[this.ri]=ch[i];this.ri=(this.ri+1)%this.N;this.pos+=1;
      if(this.pos>=this.r){let y=0;for(let k=0;k<this.N;k++)y+=this.taps[k]*this.ring[(this.ri+k)%this.N];
        this.f[this.fi++]=y;this.pos-=this.r;
        if(this.fi===160){this.frame(this.f.slice());this.fi=0;}}}
    return true;}}registerProcessor('sm-cap',SmCap);
class SmPlay extends AudioWorkletProcessor {
  constructor(o){super();const p=o.processorOptions||{};this.inRate=p.inRate||${nn};
    this.step=this.inRate/sampleRate;this.cap=this.inRate*60;this.buf=new Float32Array(this.cap);
    this.r=0;this.w=0;this.n=0;this.pos=0;this.playing=false;
    this.pre=Math.round(this.inRate*(p.prebufferMs||150)/1000);this.maxPre=Math.round(this.inRate*0.35);
    this.lastDrain=0;this.lastWrite=0;this.stutters=0;this.frames=0;
    this.port.onmessage=(e)=>{const d=e.data;
      if(d==='clear'){this.r=0;this.w=0;this.n=0;this.pos=0;if(this.playing){this.playing=false;this.port.postMessage({t:'drained',cleared:true});}return;}
      this.lastWrite=this.frames;for(let i=0;i<d.length&&this.n<this.cap;i++){this.buf[this.w]=d[i];this.w=(this.w+1)%this.cap;this.n++;}};}
  process(_i,outputs){const out=outputs[0][0];this.frames++;
    if(!this.playing){
      // Start when the jitter buffer is full, or data stopped coming (a short reply).
      if(this.n>=this.pre||(this.n>0&&this.frames-this.lastWrite>20)){
        // Data arrived again within ~0.1s of running dry mid-utterance = a network stall.
        if(this.lastDrain&&this.frames-this.lastDrain<40){this.stutters++;this.pre=Math.min(this.maxPre,Math.round(this.pre*1.5));}
        this.playing=true;this.port.postMessage({t:'playing',stutters:this.stutters,preMs:Math.round(this.pre*1000/this.inRate)});
      } else {out.fill(0);return true;}}
    for(let i=0;i<out.length;i++){
      if(this.n<2){out.fill(0,i);this.n=0;this.r=this.w;this.pos=0;this.playing=false;this.lastDrain=this.frames;this.port.postMessage({t:'drained'});break;}
      const a=this.buf[this.r],b=this.buf[(this.r+1)%this.cap];out[i]=a+(b-a)*this.pos;this.pos+=this.step;
      while(this.pos>=1){this.pos-=1;this.r=(this.r+1)%this.cap;this.n--;}}
    return true;}}
registerProcessor('sm-play',SmPlay);`,en=t=>globalThis[t];function on(t){let e="idle",n=!1,o=!1,r=null,i=null,s=null,a=null,c=null,l=null,p=null,m=null,v=null,y=[],C=null,M=[],w=!1,b={stutters:0,micFrames:0,micPeak:0,noiseSuppression:!1,prebufferMs:150,playStarts:0,playing:!1};globalThis.__smVoiceStats=b;let L=[],R=[],h=0,d=null,u=f=>{d&&!(f in d)&&(d[f]=Math.round(performance.now()-h))},k=()=>{d&&(P(O({type:"voice_timing",sessionId:t.sessionId,timings:{...d,transport_ws:1,ns:b.noiseSuppression?1:0}})),d=null)},x=f=>{if(e!==f){e=f;for(let E of L)E(f)}},T=(f,E)=>{for(let _ of R)_({code:f,message:E})},P=f=>{r?.readyState===WebSocket.OPEN&&r.send(f)},D=()=>{s&&clearTimeout(s),s=null},$=()=>{D(),!o&&(s=setTimeout(()=>{o||nt()},mr))},nt=()=>{D();let f=r;r=null,i=null;try{f?.close(1e3)}catch{}},F=()=>{a&&clearTimeout(a),a=null,e==="connecting"&&x(n?"muted":w?"speaking":"listening")},U=()=>{if(c)return c;let f=window.AudioContext??window.webkitAudioContext;try{c=new f({sampleRate:tn,latencyHint:"interactive"})}catch{c=new f}return l=c.createGain(),l.connect(c.destination),c},G=()=>m||(m=(async()=>{let f=U(),E=URL.createObjectURL(new Blob([hr],{type:"application/javascript"}));await f.audioWorklet.addModule(E),URL.revokeObjectURL(E),p=new AudioWorkletNode(f,"sm-play",{numberOfInputs:0,outputChannelCount:[1],processorOptions:{inRate:nn,prebufferMs:b.prebufferMs}}),p.connect(l),p.port.onmessage=A=>{let I=A.data;I.t==="playing"?(w=!0,b.playing=!0,C?.port.postMessage({duck:!0}),b.playStarts++,b.stutters=I.stutters??b.stutters,b.prebufferMs=I.preMs??b.prebufferMs,d&&!("first_audio"in d)&&(u("first_audio"),k()),e==="connecting"?F():n||x("speaking")):I.t==="drained"&&(w=!1,b.playing=!1,C?.port.postMessage({duck:!1}),e==="speaking"&&x("listening"))};let _=null;try{if(en("__SM_VOICE_NS__")==="off")throw new Error("noise suppression off");let A=await import(`${Pt}/+esm`),[I]=await Promise.all([A.loadRnnoise({url:`${Pt}/dist/rnnoise.wasm`,simdUrl:`${Pt}/dist/rnnoise_simd.wasm`}),f.audioWorklet.addModule(`${Pt}/dist/rnnoise/workletProcessor.js`)]);f.sampleRate===tn&&(_=new A.RnnoiseWorkletNode(f,{maxChannels:1,wasmBinary:I}),b.noiseSuppression=!0)}catch(A){console.warn("[voiceModeWs] noise suppression unavailable",A)}return{ns:_}})(),m.catch(()=>{m=null}),m),$t=f=>{if(!(n||!r||r.readyState!==WebSocket.OPEN)){for(let E=0;E<f.length;E++){let _=f[E];M.push(_),Math.abs(_)>b.micPeak&&(b.micPeak=Math.abs(_))}for(;M.length>=Lt;){let E=M.splice(0,Lt),_=new Int16Array(Lt);for(let A=0;A<Lt;A++){let I=Math.max(-1,Math.min(1,E[A]));_[A]=I<0?I*32768:I*32767}r.send(_.buffer),b.micFrames++}}},ht=async()=>{let f=U(),[E,{ns:_}]=await Promise.all([navigator.mediaDevices.getUserMedia({audio:{echoCancellation:!0,noiseSuppression:!0,autoGainControl:!0,channelCount:1}}),G()]);v=E;let A=f.createMediaStreamSource(E),I=new AudioWorkletNode(f,"sm-cap");en("__SM_VOICE_GATE__")==="off"&&I.port.postMessage({bypass:!0}),C=I,I.port.onmessage=Qn=>$t(Qn.data),_?(A.connect(_),_.connect(I)):A.connect(I),y=[A,..._?[_]:[],I]},H=()=>{for(let f of y)try{f.disconnect()}catch{}y=[];for(let f of v?.getTracks()??[])f.stop();v=null,M=[]},N=()=>{p?.port.postMessage("clear"),w=!1,e==="speaking"&&x(n?"muted":"listening")},gt=f=>{if(!p)return;let E=new Int16Array(f),_=new Float32Array(E.length);for(let A=0;A<E.length;A++)_[A]=E[A]/32768;p.port.postMessage(_,[_.buffer])},ue=()=>r&&r.readyState===WebSocket.OPEN?($(),Promise.resolve(r)):i||(i=new Promise((f,E)=>{let _=new WebSocket(t.url);_.binaryType="arraybuffer",_.onopen=()=>{r=_,$(),f(_)},_.onerror=()=>E(new Error("voice websocket connect failed")),_.onmessage=A=>{if(A.data instanceof ArrayBuffer){gt(A.data);return}let I=String(A.data);if(I.includes('"audio_clear"')){N();return}t.onAgentEvent(new TextEncoder().encode(I))},_.onclose=()=>{_.readyState!==WebSocket.OPEN&&r!==_&&E(new Error("voice websocket connect failed")),r===_&&(r=null),i=null,o&&(o=!1,H(),N(),x("idle"),T("connect_failed","voice connection closed"))}}),i.catch(()=>{i=null}),i),Xn=f=>{let E=f instanceof Error?f.message:String(f),_=f instanceof Error?f.name:"";return/permissions? policy|feature policy/i.test(E)?"mic_policy_blocked":_==="NotAllowedError"||/denied|permission/i.test(E)?"mic_denied":_==="NotFoundError"||/no.*microphone|not.*found/i.test(E)?"mic_unavailable":/connect|network|websocket|timeout/i.test(E)?"connect_failed":"unknown"};return{warm:()=>{ue().catch(f=>console.warn("[voiceModeWs] warm failed",f)),G().catch(f=>console.warn("[voiceModeWs] audio setup failed",f))},start:()=>{e==="idle"&&(x("connecting"),D(),h=performance.now(),d={was_warm:r?.readyState===WebSocket.OPEN?1:0},U().resume(),(async()=>{try{await ue(),u("room_connected"),await ht(),u("mic_on"),globalThis.__smVoiceMicOnAt=Date.now(),o=!0,P(O({type:"start_voice",sessionId:t.sessionId})),n&&x("muted")}catch(f){H(),x("idle"),T(Xn(f),f instanceof Error?f.message:String(f))}})())},stop:()=>{d&&(u("hung_up"),k()),a&&clearTimeout(a),a=null,o=!1,H(),N(),nt(),x("idle")},speak:async()=>{},setMuted:f=>{n=f,l&&(l.gain.value=f?0:1),f?x("muted"):e==="muted"&&x(w?"speaking":"listening")},getState:()=>e,onStateChange:f=>{L.push(f)},onError:f=>{R.push(f)},signalAgentReady:()=>{u("agent_ready"),e==="connecting"&&!a&&(a=setTimeout(F,fr))},publishData:async f=>{P(new TextDecoder().decode(f))}}}function rn(t,e,n={}){let o=t,r=null,i=!1,s=!1,a=null,c=[],l=[],p=n.noAudioMs??7e3,m=()=>{a&&clearTimeout(a),a=null},v=y=>{if(i)return;let C=e();if(C){i=!0,m(),r=C,n.onSwitch?.(y);try{t.stop()}catch{}C.onStateChange(M=>c.forEach(w=>w(M))),C.onError?.(M=>l.forEach(w=>w(M))),o=C,C.start()}};return t.onStateChange(y=>{o===t&&(y==="speaking"&&(s=!0,m()),c.forEach(C=>C(y)))}),t.onError?.(y=>{if(o===t){if(!s&&y.code==="connect_failed"&&!i){v(y.code);return}l.forEach(C=>C(y))}}),{warm:()=>o.warm?.(),start:()=>{s=!1,o.start(),o===t&&!i&&(m(),a=setTimeout(()=>{!s&&o===t&&t.getState()==="connecting"&&v("no_audio")},p))},stop:()=>{m(),o.stop()},speak:y=>o.speak(y),setMuted:y=>o.setMuted(y),getState:()=>o.getState(),onStateChange:y=>{c.push(y)},onError:y=>{l.push(y)},signalAgentReady:()=>o.signalAgentReady?.(),publishData:async y=>{await o.publishData?.(y)}}}function an(t){let e=0,n=s=>{let a=Date.now();a-e<200||(e=a,t.send(s))},o=s=>{let a=s.target;if(!a)return;let c=gr(a),l=c?yr(c,t.hints):null;n({type:"visitor_action",sessionId:t.sessionId,action:"click",intentKey:l,url:window.location.href,elementLabel:c,timestamp:Date.now()})},r=()=>{n({type:"visitor_action",sessionId:t.sessionId,action:"route_change",intentKey:null,url:window.location.href,elementLabel:null,timestamp:Date.now()})},i=s=>{let a=s.target;if(!a)return;let c=a.tagName?.toLowerCase();c!=="input"&&c!=="textarea"&&c!=="select"||a.type==="password"||n({type:"visitor_action",sessionId:t.sessionId,action:"form_focus",intentKey:null,url:window.location.href,elementLabel:a.name||a.id||null,timestamp:Date.now()})};return document.addEventListener("click",o,{passive:!0,capture:!0}),window.addEventListener("popstate",r),document.addEventListener("focusin",i,{passive:!0}),()=>{document.removeEventListener("click",o,!0),window.removeEventListener("popstate",r),document.removeEventListener("focusin",i)}}function gr(t){return t.getAttribute("aria-label")??t.getAttribute("title")??(t.textContent??"").trim().slice(0,80)??null}function yr(t,e){let n=t.toLowerCase();if(e.has(n))return n;for(let o of e.keys())if(n.includes(o)||o.includes(n))return o;return null}function ln(t){return t.replace(/[-_]+/g," ").trim().replace(/\b\w/g,e=>e.toUpperCase())}function sn(t){let e=String(t??"").trim();return!e||/^\d+$/.test(e)?null:ln(e)}function cn(t){let e=(t||"/").split(/[?#]/)[0]??"/";if(e==="/"||e==="")return"the home page";if(/^\/checkout/.test(e))return"checkout";if(/^\/cart\/?$/.test(e))return"your cart";let n=e.replace(/\/+$/,"").split("/").pop()??"";return n?`the ${ln(n)} page`:"that page"}function un(t,e){switch(t.type){case"cart_add":{let n=sn(t.sku),o=n?`${t.qty>1?`${t.qty} \xD7 `:""}${n}`:"that";return e.ok?{text:`Added ${o} to your cart`,ok:!0}:{text:`Couldn't add ${n??"that"} to your cart`,ok:!1}}case"cart_set_qty":{let n=sn(t.sku)??"that item";return e.ok?t.qty<=0?{text:`Removed ${n} from your cart`,ok:!0}:{text:`Set ${n} to ${t.qty}`,ok:!0}:{text:`Couldn't update ${n}`,ok:!1}}case"cart_clear":return e.ok?{text:"Emptied your cart",ok:!0}:{text:"Couldn't empty your cart",ok:!1};case"apply_coupon":return e.ok?{text:`Applied code ${t.code.toUpperCase()}`,ok:!0}:{text:`Code ${t.code.toUpperCase()} didn't apply`,ok:!1};case"navigate":return e.ok?{text:`Opened ${cn(t.path)}`,ok:!0}:{text:`Couldn't open ${cn(t.path)}`,ok:!1};case"form_fill":case"checkout_fill":return e.ok?(e.filled??[]).filter(r=>!r.ok).length>0?{text:"Filled in some of your details \u2014 please check the page",ok:!1}:{text:"Filled in your details \u2014 please check them on the page",ok:!0}:{text:"Couldn't fill in your details \u2014 please type them on the page",ok:!1};case"checkout_place":return e.ok?{text:"Sent your order to the payment page",ok:!0}:{text:"Couldn't place the order",ok:!1};case"click":return e.ok?e.verified===!1?{text:"That tap didn't change anything \u2014 trying another way",ok:!1}:null:{text:"Couldn't find that on the page",ok:!1};default:return null}}var ne=10,dn='[data-cart-count],#cart-icon-bubble,.cart-count,.cart-count-bubble,[class*="cart-count"],[class*="CartCount"]';function br(t=window){try{if(navigator.globalPrivacyControl)return!1;let e=t.Shopify?.customerPrivacy?.analyticsProcessingAllowed;if(typeof e=="function")return!!e();if(typeof t.OnetrustActiveGroups=="string")return t.OnetrustActiveGroups.includes("C0002");if(t.Cookiebot?.hasResponse)return!!t.Cookiebot.consent?.statistics}catch{}return null}function vr(t,e){return t!==null?t:!/^Europe\//.test(e)}function wr(t){return t<768?"mobile":t<1024?"tablet":"desktop"}function pn(t,e,n){let o=new URLSearchParams(t).get("utm_source");if(o)return o.toLowerCase().slice(0,40);if(!e)return"direct";try{let r=new URL(e).hostname.replace(/^www\./,"");return r===n.replace(/^www\./,"")?"internal":/google\./.test(r)?"google":/facebook|fb\.|instagram/.test(r)?"meta":r.slice(0,40)}catch{return"direct"}}function kr(t,e){if(/\/(thank|order-confirm|order-success|checkouts\/.*\/thank_you)/i.test(t))return"purchase";if(/\/checkout/i.test(t))return"checkout";if(/^\/cart\/?$/i.test(t))return"cart";for(let n of e)try{if(new RegExp(n.urlPattern).test(t))return n.pageType}catch{}return t==="/"||t===""?"home":"other"}function oe(){return Math.max(document.documentElement.scrollHeight,document.body?.scrollHeight??0,window.innerHeight,1)}function mn(){try{let e=window.__shoppingmateGetCart__;if(typeof e=="function"){let n=e()?.count;if(typeof n=="number")return n}}catch{}let t=Number((document.querySelector(dn)?.textContent??"").replace(/\D/g,""));return Number.isFinite(t)&&document.querySelector(dn)!==null?t:null}function xr(t){let e=t?.closest?.('a,button,input,select,textarea,summary,[role="button"],[role="link"],[role="tab"]');if(!e)return null;let n=e.tagName==="A"?"link":e.tagName==="BUTTON"?"button":e.getAttribute("role")??e.tagName.toLowerCase();return ot(n,Z(e)||e.getAttribute("name")||"")}var Rt="sm_ins_visit",_r=30*60*1e3;function Sr(t=Date.now(),e=()=>Math.random().toString(36).slice(2)){let n=null;try{n=JSON.parse(sessionStorage.getItem(Rt)??"null")}catch{n=null}if(!n||t-n.last>_r){let o=!1;try{o=!localStorage.getItem("sm_seen"),localStorage.setItem("sm_seen","1")}catch{}n={id:`v_${e()}${t.toString(36)}`,last:t,isNew:o,bot:!1,qa:!1}}n.last=t;try{sessionStorage.setItem(Rt,JSON.stringify(n))}catch{}return n}function re(t){try{let e=JSON.parse(sessionStorage.getItem(Rt)??"null");e&&sessionStorage.setItem(Rt,JSON.stringify({...e,...t}))}catch{}}var ie=!1;function fn(){ie=!0,re({bot:!0})}function Cr(t,e){if(t>=1)return!0;if(t<=0)return!1;let n=0;for(let o of e)n=n*31+o.charCodeAt(0)>>>0;return n%1e3/1e3<t}function hn(t){if(!t.config?.enabled)return null;let e=Sr();if(!Cr(t.config.sampleRate,e.id))return null;let n=(()=>{try{return Intl.DateTimeFormat().resolvedOptions().timeZone??""}catch{return""}})();if(!vr(br(),n))return null;let o=[];Tt().then(d=>{o=d});let r=e.qa||/ShoppingmateBot|HeadlessChrome/.test(navigator.userAgent)||new URLSearchParams(location.search).has("sm_qa");r&&!e.qa&&re({qa:!0});let i=e.isNew;e.bot&&(ie=!0);let s=(()=>{try{let d=sessionStorage.getItem("sm_src")??pn(location.search,document.referrer,location.hostname);return sessionStorage.setItem("sm_src",d),d}catch{return pn(location.search,document.referrer,location.hostname)}})(),a=c();function c(){return{path:location.pathname,start:Date.now(),maxScroll:0,attention:new Array(ne).fill(0),cells:{},elements:{},rage:0,dead:0,errorClicks:0,deadTargets:[],rageTargets:[],focused:new Set,submitted:!1,lcp:null,cls:0,inp:null,jsErrors:0,cartStart:mn(),recent:[],lastClickAt:0,sent:!1}}let l=()=>{let d=Math.min(100,Math.round((window.scrollY+window.innerHeight)/oe()*100));d>a.maxScroll&&(a.maxScroll=d)},p=window.setInterval(()=>{if(document.visibilityState!=="visible")return;let d=Math.min(ne-1,Math.floor((window.scrollY+window.innerHeight/2)/oe()*ne));a.attention[d]=(a.attention[d]??0)+1},1e3),m=d=>{if(V(d.target))return;let u=Date.now(),k=Math.min(9,Math.floor((d.clientX+window.scrollX)/Math.max(document.documentElement.scrollWidth,1)*10)),x=Math.min(9,Math.floor((d.clientY+window.scrollY)/oe()*10)),T=`${k},${x}`;a.cells[T]=(a.cells[T]??0)+1;let P=xr(d.target);P&&(a.elements[P]=(a.elements[P]??0)+1),a.recent=a.recent.filter(H=>u-H.t<700&&Math.abs(H.x-d.clientX)<30&&Math.abs(H.y-d.clientY)<30),a.recent.push({t:u,x:d.clientX,y:d.clientY}),a.recent.length===3&&(a.rage+=1,P&&a.rageTargets.length<5&&a.rageTargets.push(P)),a.lastClickAt=u;let D=location.href,$=d.target instanceof Element?d.target:null,F=$?.closest('a,button,label,summary,[role="button"],[role="tab"],[role="option"]')??$?.parentElement??$,U=document.activeElement,G=!1,$t=H=>H instanceof HTMLElement&&(H.matches('dialog,[role="dialog"],[aria-modal="true"],[role="alert"],[role="status"]')||/fixed|sticky/.test(getComputedStyle(H).position)),ht=new MutationObserver(H=>{for(let N of H)if(!V(N.target)){if(F?.contains(N.target)){G=!0;return}if(N.type==="attributes"&&F&&N.target.contains?.(F)&&/^(aria-|open$|hidden$)/.test(N.attributeName??"")){G=!0;return}if(N.type==="childList"&&[...N.addedNodes].some($t)){G=!0;return}}});ht.observe(document.body,{subtree:!0,childList:!0,attributes:!0,characterData:!0}),window.setTimeout(()=>{ht.disconnect();let H=document.activeElement!==U&&document.activeElement!==document.body;if(!G&&!H&&location.href===D&&a.path===location.pathname){a.dead+=1;let N=P??(()=>{let gt=($?.textContent??$?.getAttribute("alt")??"").replace(/\s+/g," ").trim().toLowerCase();return gt?`text|${gt.slice(0,30)}`:null})();N&&a.deadTargets.length<5&&!a.deadTargets.includes(N)&&a.deadTargets.push(N)}},800)},v=d=>{/shoppingmate|widget\/v1/.test(`${d.filename??""}`)||(a.jsErrors+=1,Date.now()-a.lastClickAt<1e3&&(a.errorClicks+=1))},y=d=>{let u=d.target;if(!u||V(u)||!/^(INPUT|TEXTAREA|SELECT)$/.test(u.tagName))return;let k=(u.getAttribute("type")??"").toLowerCase();if(k==="hidden"||k==="password")return;let x=(u.getAttribute("name")||u.id||u.getAttribute("placeholder")||u.tagName).slice(0,40);a.focused.add(x)},C=()=>{a.submitted=!0},M=[];try{let d=new PerformanceObserver(x=>{let T=x.getEntries().at(-1);T&&(a.lcp=Math.round(T.startTime))});d.observe({type:"largest-contentful-paint",buffered:!0});let u=new PerformanceObserver(x=>{for(let T of x.getEntries())T.hadRecentInput||(a.cls+=T.value??0)});u.observe({type:"layout-shift",buffered:!0});let k=new PerformanceObserver(x=>{for(let T of x.getEntries())a.inp=Math.max(a.inp??0,Math.round(T.duration))});k.observe({type:"event",buffered:!0,durationThreshold:40}),M=[d,u,k]}catch{}let w=()=>{if(a.sent)return;a.sent=!0,re({last:Date.now()});let d=Object.fromEntries(Object.entries(a.elements).sort((P,D)=>D[1]-P[1]).slice(0,20)),u=mn(),k={v:1,merchantId:t.merchantId,sessionId:e.id,visitorId:t.visitorId,path:a.path,pageType:kr(a.path,o),device:wr(window.innerWidth),source:s,newVisitor:i,dwellMs:Date.now()-a.start,maxScroll:a.maxScroll,attention:a.attention,cells:a.cells,elements:d,rage:a.rage,dead:a.dead,errorClicks:a.errorClicks,deadTargets:a.deadTargets,rageTargets:a.rageTargets,abandonedFields:a.submitted?[]:[...a.focused].slice(0,10),lcp:a.lcp,cls:Math.round(a.cls*1e3)/1e3,inp:a.inp,jsErrors:a.jsErrors,botEngaged:ie,cartIncreased:a.cartStart!==null&&u!==null&&u>a.cartStart,qa:r},x=JSON.stringify(k),T=`${t.apiBase}/v1/insights/pageview`;try{navigator.sendBeacon?.(T,new Blob([x],{type:"text/plain"}))||fetch(T,{method:"POST",body:x,keepalive:!0,headers:{"content-type":"text/plain"}}).catch(()=>{})}catch{}},b=()=>{location.pathname!==a.path&&(w(),a=c(),l())},L=history.pushState,R=history.replaceState;history.pushState=function(...d){let u=L.apply(this,d);return window.setTimeout(b,0),u},history.replaceState=function(...d){let u=R.apply(this,d);return window.setTimeout(b,0),u};let h=()=>w();return window.addEventListener("scroll",l,{passive:!0}),window.addEventListener("popstate",b),window.addEventListener("pagehide",h),document.addEventListener("visibilitychange",()=>{document.visibilityState==="hidden"&&w()}),document.addEventListener("click",m,!0),document.addEventListener("focusin",y,!0),document.addEventListener("submit",C,!0),window.addEventListener("error",v),l(),()=>{w(),window.clearInterval(p);for(let d of M)d.disconnect();history.pushState=L,history.replaceState=R,window.removeEventListener("scroll",l),window.removeEventListener("popstate",b),window.removeEventListener("pagehide",h),document.removeEventListener("click",m,!0),document.removeEventListener("focusin",y,!0),document.removeEventListener("submit",C,!0),window.removeEventListener("error",v)}}function gn(){return new Promise(t=>{let e=document.createElement("input");e.type="file",e.accept="image/*",e.multiple=!0,e.style.display="none",e.addEventListener("change",()=>{t(Array.from(e.files??[]).slice(0,3)),e.remove()}),document.body.appendChild(e),e.click()})}async function yn(t){let e=await createImageBitmap(t,{imageOrientation:"from-image"}),n=Math.min(1,1600/Math.max(e.width,e.height)),o=Math.max(1,Math.round(e.width*n)),r=Math.max(1,Math.round(e.height*n)),i=document.createElement("canvas");i.width=o,i.height=r;let s=i.getContext("2d");if(!s)throw new Error("canvas unavailable");s.drawImage(e,0,0,o,r),e.close?.();let a=await new Promise(c=>i.toBlob(c,"image/jpeg",.85));if(!a)throw new Error("could not encode the photo");return a}async function bn(t){let e=`${t.apiBase}/v1/care/upload?sessionId=${encodeURIComponent(t.sessionId)}&merchantId=${encodeURIComponent(t.merchantId)}`;try{let n=await fetch(e,{method:"POST",headers:{"content-type":"image/jpeg"},body:t.photo}),o=await n.json().catch(()=>({}));return n.ok&&o.ok?{ok:!0,attachedTo:o.attachedTo??null}:{ok:!1,message:o.message??"Couldn't attach that photo. Please try again."}}catch{return{ok:!1,message:"Couldn't attach that photo \u2014 check your connection and try again."}}}var g={captionResting:"AI ASSISTANT",captionIncoming:"INCOMING CALL",captionThinking:"CONNECTING\u2026",captionConnected:"CONNECTED",attachPhotoAria:"Add a photo",attachPhotoCta:"Add a photo",photoAttached:"Photo attached",captionRetry:"TAP TO RETRY",captionOffline:"OFFLINE",talkToPrefix:"Talk to",callCta:"Call",acceptCta:"Accept",callAria:"Start voice call",acceptAria:"Accept call",micMute:"Mute mic",micUnmute:"Unmute mic",retryAria:"Retry call",endCallAria:"End call",closeAria:"Close",openAria:"Open shoppingmate",chatAria:"Chat instead",callFailedTitle:"Could not start the call. Please try again.",callHelpHeading:"How can I help you?",callBullets:["Find the right product","Compare options out loud","Check out on this page"],panelHelpHeading:"Hi, I'm",panelHelpSubtitle:"I'm here to help you:",panelBullets:["Find the right product fast","Compare options out loud","Check out without leaving the page"],panelPrompts:["Help me find the right product","Can you compare your products for me?","I'd like to check out"],poweredBy:"Powered by shoppingmate",chatPlaceholder:"Type a quick question\u2026",reconnecting:"Reconnecting\u2026",disconnected:"Connection lost \u2014 reload to retry",closed:{user:"Conversation ended",cap:"Time to wrap up \u2014 reload for a new chat",error:"Something went wrong"},payNow:"Pay now \u2192",capWarning:"A couple minutes left",thinking:"thinking\u2026",micDenied:"Mic blocked \u2014 switching to text"};var vn={"calm-clinician":"Sage","calmosis-clinician":"Calmio",stylist:"Lumi",coach:"Kai",concierge:"Olivia",curator:"Theo",guide:"Maya",expert:"Arjun",host:"Ana"},Tr={"calmosis-clinician":"calm-clinician"};function Er(){let t="https://shoppingmate-web.vercel.app/widget/personas";return t&&typeof t=="string"?t.replace(/\/$/,""):"https://cdn.shoppingmate.shop/v1/personas"}var wn={id:"pending",name:"Assistant",initial:"A",avatarUrl:""};function kn(){return wn}function xn(t){if(!t||!vn[t])return wn;let e=vn[t],n=Tr[t]??t;return{id:t,name:e,initial:e.charAt(0).toUpperCase(),avatarUrl:`${Er()}/${n}.png`}}var _n=0,W=()=>(_n+=1,`t${_n}`);function Ar(t,e){switch(e.type){case"set_mode":return{...t,mode:e.mode};case"set_voice_state":return e.state!=="idle"?{...t,voiceState:e.state,voiceError:null,invited:!1}:{...t,voiceState:e.state};case"set_connection":return{...t,connection:e.status,thinking:e.status==="connected"?t.thinking:!1};case"set_voice_error":return{...t,voiceError:e.error};case"set_invited":return{...t,invited:e.invited};case"receipt":{let n=t.transcript[t.transcript.length-1];return n&&n.kind==="receipt"&&n.text===e.text&&n.ok===e.ok?t:{...t,transcript:[...t.transcript,{id:W(),role:"system",kind:"receipt",text:e.text,ok:e.ok,ts:Date.now()}]}}case"reset":return{...t,transcript:[],thinking:!1,closed:!1,closedReason:null,checkoutUrl:null,capWarning:null};case"user_input":return{...t,transcript:[...t.transcript,{id:W(),role:"user",kind:"text",text:e.text,ts:Date.now()}]};case"agent_event":{let n=e.event;switch(n.type){case"thinking":return{...t,thinking:!0};case"end_of_turn":return{...t,thinking:!1};case"say":{let o=Sn(t.transcript),r=o>=0?t.transcript[o]:void 0;if(r){let i=t.transcript.slice();return i[o]={...r,text:n.text,partial:!1,ts:Date.now()},{...t,thinking:!1,transcript:i}}return{...t,thinking:!1,transcript:[...t.transcript,{id:W(),role:"agent",kind:"text",text:n.text,ts:Date.now()}]}}case"say_partial":{let o=Sn(t.transcript),r=o>=0?t.transcript[o]:void 0;if(r){let i=t.transcript.slice();return i[o]={...r,text:n.text,ts:Date.now()},{...t,thinking:!1,transcript:i}}return{...t,thinking:!1,transcript:[...t.transcript,{id:W(),role:"agent",kind:"text",text:n.text,ts:Date.now(),partial:!0}]}}case"user_text":return{...t,transcript:[...t.transcript,{id:W(),role:"user",kind:"text",text:n.text,ts:Date.now()}]};case"cards":return{...t,transcript:[...t.transcript,{id:W(),role:"agent",kind:"cards",items:n.items,ts:Date.now()}]};case"tool_result":return n.toolName==="case.open"&&n.ok?{...t,transcript:[...t.transcript,{id:W(),role:"system",kind:"receipt",text:"Your request is with the team \u2014 they\u2019ll contact you",ok:!0,ts:Date.now()}]}:t;case"checkout_redirect":return{...t,checkoutUrl:n.url};case"cap_warning":return{...t,capWarning:{reason:n.reason,remaining:n.remaining},transcript:[...t.transcript,{id:W(),role:"system",kind:"cap_warning",remaining:n.remaining,ts:Date.now()}]};case"session_closed":return{...t,closed:!0,closedReason:n.reason,transcript:[...t.transcript,{id:W(),role:"system",kind:"closed",reason:n.reason,ts:Date.now()}]};default:return t}}default:return t}}function Sn(t){for(let e=t.length-1;e>=0;e--){let n=t[e];if(n.role==="user")return-1;if(n.role==="agent"&&n.kind==="text")return n.partial?e:-1}return-1}function ae(t){let e={sessionId:t.sessionId,mode:"pill",voiceState:"idle",transcript:[],thinking:!1,closed:!1,closedReason:null,checkoutUrl:null,capWarning:null,connection:"connecting",voiceError:null,invited:!1},n=[];return{get:()=>e,dispatch:o=>{e=Ar(e,o);for(let r of n)r(e)},subscribe:o=>(n.push(o),()=>{let r=n.indexOf(o);r>=0&&n.splice(r,1)})}}var Cn=`
:host { all: initial; }
* { box-sizing: border-box; }

.root {
  /* Brand accent \u2014 overridden per-merchant from the dashboard via widget.ts. */
  --sm-accent: #16a34a;
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

/* Hidden while the storefront's own cart drawer, cart page, or nav/menu drawer
   is open, so the launcher never covers it. Toggled from widget.ts by detecting
   the theme's open-state classes. */
.root.host-overlay-hidden { opacity: 0; visibility: hidden; pointer-events: none; transition: opacity 150ms ease-out; }

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
  background: var(--sm-accent, #22c55e);
  box-shadow: 0 0 0 2px #0a0a0a;
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
/* Chat shortcut beside Call \u2014 deliberately smaller so Call stays the hero. */
.tray-btn.tray-chat { width: 28px; height: 28px; }
.tray-btn.tray-chat :where(svg) { width: 13px; height: 13px; }

/* Green Call / Accept button \u2014 the ONLY control that starts a call. */
.tray-call {
  display: inline-flex; align-items: center; gap: 6px;
  height: 34px;
  padding: 0 14px 0 12px;
  border: none; border-radius: 9999px;
  background: var(--sm-accent, #16a34a);
  color: #fff;
  font-family: inherit;
  font-size: 13px; font-weight: 600;
  letter-spacing: 0.01em;
  cursor: pointer;
  box-shadow: 0 6px 16px -6px rgba(0,0,0,0.35);
  transition: transform 150ms ease-out, filter 150ms ease-out, box-shadow 150ms ease-out;
}
.tray-call:hover { filter: brightness(0.92); transform: translateY(-1px); }
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
  outline: 2px solid var(--sm-accent, #22c55e);
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

/* ---- Action receipts: what actually happened on the page ---- */
.receipt {
  align-self: flex-start;
  display: inline-flex; align-items: center; gap: 7px;
  max-width: 90%;
  padding: 5px 11px 5px 6px;
  border-radius: 9999px;
  font-size: 11.5px; line-height: 1.3; font-weight: 500;
  letter-spacing: 0.005em;
  animation: receipt-in 380ms cubic-bezier(0.22, 1, 0.36, 1) both;
}
.receipt.ok {
  background: rgba(52, 211, 153, 0.10);
  color: #a7f3d0;
  box-shadow: inset 0 0 0 1px rgba(52, 211, 153, 0.22);
}
.receipt.warn {
  background: rgba(251, 191, 36, 0.10);
  color: #fde68a;
  box-shadow: inset 0 0 0 1px rgba(251, 191, 36, 0.24);
}
.receipt-icon {
  display: grid; place-items: center;
  width: 16px; height: 16px; flex: 0 0 16px;
  border-radius: 9999px;
  font-size: 10px; font-weight: 700;
}
.receipt.ok .receipt-icon {
  background: #34d399; color: #052e1f;
  animation: receipt-tick 520ms cubic-bezier(0.34, 1.56, 0.64, 1) 120ms both;
}
.receipt.warn .receipt-icon { background: #fbbf24; color: #3b2400; }
@keyframes receipt-in {
  0% { opacity: 0; transform: translateX(-6px) scale(0.96); }
  100% { opacity: 1; transform: none; }
}
@keyframes receipt-tick {
  0% { transform: scale(0.2) rotate(-25deg); }
  100% { transform: scale(1) rotate(0); }
}
@media (prefers-reduced-motion: reduce) {
  .receipt, .receipt-icon { animation: none !important; }
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
  background: var(--sm-accent, #22c55e);
  color: #fff; border: none; cursor: pointer;
  display: grid; place-items: center;
  transition: transform 150ms ease-out, filter 150ms ease-out, opacity 150ms ease-out;
}
.input-row .send:hover:not(:disabled) { transform: translateY(-1px); filter: brightness(0.92); }
.input-row .send:active:not(:disabled) { transform: translateY(0) scale(0.96); }
.input-row .send:disabled { opacity: 0.4; cursor: not-allowed; }
.input-row .send :where(svg) { width: 14px; height: 14px; }
.input-row .attach {
  width: 36px; height: 36px; flex: none;
  border-radius: 9999px;
  background: rgba(255,255,255,0.06);
  color: rgba(255,255,255,0.8); border: 1px solid rgba(255,255,255,0.1); cursor: pointer;
  display: grid; place-items: center;
  transition: background 150ms ease-out, transform 150ms ease-out;
}
.input-row .attach:hover:not(:disabled) { background: rgba(255,255,255,0.12); }
.input-row .attach:active:not(:disabled) { transform: scale(0.96); }
.input-row .attach:disabled { opacity: 0.4; cursor: not-allowed; }
.input-row .attach :where(svg) { width: 16px; height: 16px; }
.call-attach {
  display: flex; align-items: center; justify-content: center; gap: 8px;
  margin: 0 16px 12px;
  padding: 10px 14px;
  border-radius: 12px;
  background: rgba(255,255,255,0.06);
  border: 1px solid rgba(255,255,255,0.12);
  color: #fafafa; font: inherit; font-size: 13px; cursor: pointer;
}
.call-attach:hover { background: rgba(255,255,255,0.1); }
.call-attach :where(svg) { width: 16px; height: 16px; }

.checkout-cta {
  display: block;
  margin: 0 16px 12px;
  padding: 12px 16px;
  background: var(--sm-accent, #22c55e);
  color: #fff;
  text-align: center; text-decoration: none;
  font-weight: 600; font-size: 13px;
  letter-spacing: 0.02em;
  border-radius: 12px;
  transition: filter 150ms ease-out, transform 150ms ease-out;
}
.checkout-cta:hover { filter: brightness(0.92); }
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

/* ---- Launcher size (merchant-configurable from the dashboard) ---- */
/* Default (no class) is medium \u2014 the sizes above. small/large adjust the
   launcher's avatar, controls, call button, and labels. */
.root.size-small .tray-avatar { width: 34px; height: 34px; }
.root.size-small .tray-btn { width: 28px; height: 28px; }
.root.size-small .tray-btn :where(svg) { width: 12px; height: 12px; }
.root.size-small .tray-call { height: 30px; padding: 0 11px 0 9px; font-size: 12px; }
.root.size-small .tray-call :where(svg) { width: 13px; height: 13px; }
.root.size-small .tray-name { font-size: 12px; }
.root.size-small .tray-caption { font-size: 8.5px; }
.root.size-large .tray-avatar { width: 52px; height: 52px; }
.root.size-large .tray-btn { width: 38px; height: 38px; }
.root.size-large .tray-btn :where(svg) { width: 17px; height: 17px; }
.root.size-large .tray-call { height: 40px; padding: 0 18px 0 15px; font-size: 15px; }
.root.size-large .tray-call :where(svg) { width: 17px; height: 17px; }
.root.size-large .tray-name { font-size: 15px; }
.root.size-large .tray-caption { font-size: 11px; }

/* ---- Mobile: shrink the launcher so it doesn't dominate small screens ---- */
@media (max-width: 480px) {
  .tray { padding: 5px 7px 5px 5px; gap: 7px; }
  .tray-avatar { width: 36px; height: 36px; }
  .tray-btn { width: 28px; height: 28px; }
  .tray-btn :where(svg) { width: 12px; height: 12px; }
  .tray-call { height: 30px; padding: 0 11px 0 9px; font-size: 12px; }
  .tray-call :where(svg) { width: 13px; height: 13px; }
  .tray-name { font-size: 12px; }
  .tray-caption { font-size: 8.5px; letter-spacing: 0.14em; }
  .tray-waveform { height: 20px; }
  .tray-controls { gap: 5px; }
  .panel { width: calc(100vw - 24px); border-radius: 16px; }
  .welcome { padding: 20px 18px 12px; }
  .welcome-heading { font-size: 18px; }
}

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
`;var Tn=[1e3,2e3,4e3,8e3,16e3],Mr=5;function En(t,e){let n=null,o=0,r=!1,i=[];function s(){r||(e.onStatus(o>0?"reconnecting":"connecting"),n=new WebSocket(t),n.onopen=()=>{e.onStatus("connected"),o>0&&n?.send(JSON.stringify({type:"session_resume",sessionId:e.sessionId})),o=0;for(let a of i)n?.send(a);i=[]},n.onmessage=a=>e.onEvent(typeof a.data=="string"?a.data:""),n.onerror=()=>{},n.onclose=()=>{if(r)return;if(o+=1,o>=Mr){e.onStatus("disconnected");return}let a=Math.min(o-1,Tn.length-1),c=Tn[a]??3e4;e.onStatus("reconnecting"),setTimeout(s,c)})}return s(),{send:a=>{n&&n.readyState===1?n.send(a):i.push(a)},close:()=>{r=!0,n?.close()}}}var z=t=>`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${t}</svg>`,se=z('<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>'),An=z('<path d="M18 6 6 18"/><path d="m6 6 12 12"/>'),Mn=z('<path d="M5 12h14"/>'),In=z('<path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>'),Ln=z('<path d="M10.68 13.31a16 16 0 0 0 3.41 2.6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7 2 2 0 0 1 1.72 2v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.42 19.42 0 0 1-3.33-2.67"/><path d="M5 5a2 2 0 0 1 2-2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L10.9 11.1"/><line x1="22" y1="2" x2="2" y2="22"/>'),Pn=z('<path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="22"/>'),Rn=z('<line x1="2" y1="2" x2="22" y2="22"/><path d="M18.89 13.23A7.12 7.12 0 0 0 19 12v-2"/><path d="M5 10v2a7 7 0 0 0 12 5"/><path d="M15 9.34V5a3 3 0 0 0-5.68-1.33"/><path d="M9 9v3a3 3 0 0 0 5.12 2.12"/><line x1="12" y1="19" x2="12" y2="22"/>'),Ht=z('<path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/><circle cx="12" cy="13" r="3.5"/>'),Hn=z('<path d="M22 2 11 13"/><path d="M22 2l-7 20-4-9-9-4 20-7z"/>');function ft(t){return t.replace(/[&<>"']/g,e=>e==="&"?"&amp;":e==="<"?"&lt;":e===">"?"&gt;":e==='"'?"&quot;":"&#39;")}function Ir(t){return ft(t.trim()).replace(/\*\*([^*\n]+)\*\*/g,"<strong>$1</strong>").replace(/__([^_\n]+)__/g,"<strong>$1</strong>").replace(/(^|\s)\*([^*\n]+)\*(?=\s|$|[.,!?])/g,"$1$2").replace(/^#{1,6}\s+/gm,"").replace(/^\s*[-•]\s+/gm,"\u2022 ").replace(/\n{2,}/g,`
`).replace(/\n/g,"<br>")}function $n(t,e,n){e==="user"?t.textContent=n:t.innerHTML=Ir(n)}function Lr(t,e){let n=document.createElement("button");return n.className="card",n.type="button",n.dataset.sku=t.sku,n.innerHTML=`
    ${t.image?`<img src="${ft(t.image)}" alt="${ft(t.title)}" />`:'<div class="card-img-fallback"></div>'}
    <div class="title">${ft(t.title)}</div>
    <div class="price">${ft(t.priceFormatted)}</div>
  `,n.addEventListener("click",()=>e({sku:t.sku,variantId:t.variantId})),n}function Pr(t,e){if(t.kind==="text"){let o=document.createElement("div");return o.className=`bubble ${t.role}`,$n(o,t.role,t.text),o}if(t.kind==="cards"){let o=document.createElement("div");o.className="cards-row";for(let r of t.items)o.appendChild(Lr(r,e));return o}if(t.kind==="receipt"){let o=document.createElement("div");o.className=`receipt ${t.ok?"ok":"warn"}`,o.setAttribute("role","status");let r=document.createElement("span");r.className="receipt-icon",r.setAttribute("aria-hidden","true"),r.textContent=t.ok?"\u2713":"!";let i=document.createElement("span");return i.textContent=t.text,o.append(r,i),o}if(t.kind==="cap_warning"){let o=document.createElement("div");return o.className="bubble system",o.textContent=g.capWarning,o}let n=document.createElement("div");return n.className="bubble system",n.textContent=g.closed[t.reason],n}var Nn=new WeakMap;function Nt(t,e,n){let o=Nn.get(t)??[],r=new Map(o.map(c=>[c.id,c])),i=new Set(e.map(c=>c.id));for(let c of o)i.has(c.id)||c.el.remove();let s=[],a=!1;for(let c=0;c<e.length;c++){let l=e[c];if(!l)continue;let p=r.get(l.id);if(p)l.kind==="text"&&p.text!==l.text&&($n(p.el,l.role,l.text),p.text=l.text,a=!0),s.push(p);else{let m=Pr(l,n);t.appendChild(m),s.push({id:l.id,el:m,text:l.kind==="text"?l.text:void 0}),a=!0}}Nn.set(t,s),a&&(t.scrollTop=t.scrollHeight)}function Rr(t){switch(t){case"mic_policy_blocked":return"Voice is disabled on this page \u2014 text chat still works.";case"mic_denied":return"Microphone blocked. Allow mic access in your browser, then tap Call.";case"mic_unavailable":return"No microphone found \u2014 check your audio device, then tap Call.";case"connect_failed":return"Couldn't reach voice. Tap Call to retry.";default:return"Tap Call to try again."}}function On(t){return t.muted?"you're muted":t.voiceState==="connecting"?`connecting to ${t.personaName} \xB7 takes 1\u20133 seconds\u2026`:t.voiceState==="speaking"?`${t.personaName} is speaking\u2026`:t.voiceState==="listening"?`${t.personaName} is listening\u2026`:`${t.personaName} is ready`}function Dn(t){return t.voiceState==="idle"&&t.voiceError?"error":t.transcript.length===0?"prompt":"transcript"}function Hr(t){return`${Dn(t)}|${t.photosEnabled?"p":""}|${t.checkoutUrl??""}|${t.personaName}|${t.voiceError?.code??""}`}function Vn(t,e){let n=Hr(e),o=Dn(e);if(t.dataset.chromeKey!==n){let s=o==="error"?`
          <div class="call-error">
            <p class="call-error-title">${g.callFailedTitle}</p>
            <p class="call-error-hint">${Rr(e.voiceError?.code??"unknown")}</p>
          </div>`:"",a=o==="prompt"?`
          <div class="call-prompt">
            <h2 class="call-prompt-heading">${g.callHelpHeading}</h2>
            <ul class="call-prompt-bullets">
              ${g.callBullets.map(l=>`<li>${l}</li>`).join("")}
            </ul>
          </div>`:"",c=o!=="transcript";t.innerHTML=`
      <div class="panel call-panel">
        <button class="panel-close" data-action="close" aria-label="${g.closeAria}">${Mn}</button>
        ${s}
        ${a}
        <div class="status-line ${o==="error"?"hidden":""}" data-region="status">${On(e)}</div>
        <div class="transcript ${c?"hidden":""}" data-region="transcript" aria-live="polite"></div>
        ${e.checkoutUrl?`<a class="checkout-cta" data-action="checkout" href="${e.checkoutUrl}" target="_blank" rel="noopener">${g.payNow}</a>`:""}
        ${e.photosEnabled&&o!=="error"?`<button class="call-attach" type="button" data-action="attach">${Ht}<span>${g.attachPhotoCta}</span></button>`:""}
        <div class="panel-footer">${g.poweredBy}</div>
      </div>
    `,t.querySelector('[data-action="close"]')?.addEventListener("click",e.onClose),t.querySelector('[data-action="attach"]')?.addEventListener("click",()=>e.onAttach?.()),t.querySelector('[data-action="checkout"]')?.addEventListener("click",e.onCheckout),t.dataset.chromeKey=n}let r=t.querySelector('[data-region="status"]');if(r instanceof HTMLElement){let s=On(e);r.textContent!==s&&(r.textContent=s)}let i=t.querySelector('[data-region="transcript"]');i instanceof HTMLElement&&o==="transcript"&&Nt(i,e.transcript,e.onCardTap)}function Nr(t){return`${t.transcript.length===0?"1":"0"}|${t.photosEnabled?"p":""}|${t.checkoutUrl??""}|${t.closed?"1":"0"}|${t.personaName}|${t.personaInitial}|${t.personaAvatarUrl}`}function Wn(t,e){let n=Nr(e);if(t.dataset.chromeKey!==n){let r=e.transcript.length===0,i=g.panelBullets.map((l,p)=>`<button type="button" class="welcome-bullet" data-prompt="${p}" ${e.closed?"disabled":""}>${l}<span class="welcome-bullet-arrow" aria-hidden="true">\u2192</span></button>`).join(""),s=r?`
        <div class="welcome">
          <div class="welcome-avatar">
            <img src="${e.personaAvatarUrl}" alt="" onerror="this.style.display='none'; this.nextElementSibling.style.display='grid';" />
            <span class="welcome-avatar-fallback" aria-hidden="true">${e.personaInitial}</span>
          </div>
          <h2 class="welcome-heading">${g.panelHelpHeading} ${e.personaName}.</h2>
          <p class="welcome-sub">${g.panelHelpSubtitle}</p>
          <div class="welcome-bullets">${i}</div>
        </div>
      `:"";t.innerHTML=`
      <div class="panel">
        <button class="panel-close" data-action="close" aria-label="${g.closeAria}">${An}</button>
        ${s}
        <div class="transcript ${r?"transcript-empty":""}" data-region="transcript" aria-live="polite"></div>
        ${e.checkoutUrl?`<a class="checkout-cta" href="${e.checkoutUrl}" target="_blank" rel="noopener">${g.payNow}</a>`:""}
        <form class="input-row">
          ${e.photosEnabled?`<button class="attach" type="button" data-action="attach" aria-label="${g.attachPhotoAria}" title="${g.attachPhotoAria}" ${e.closed?"disabled":""}>${Ht}</button>`:""}
          <input type="text" placeholder="${g.chatPlaceholder}" ${e.closed?"disabled":""} />
          <button class="send" type="submit" aria-label="Send" ${e.closed?"disabled":""}>${Hn}</button>
        </form>
        <div class="panel-footer">${g.poweredBy}</div>
      </div>
    `,t.querySelector('[data-action="close"]')?.addEventListener("click",e.onClose),t.querySelector('[data-action="attach"]')?.addEventListener("click",()=>e.onAttach?.()),t.querySelectorAll(".welcome-bullet").forEach(l=>{l.addEventListener("click",()=>{if(e.closed)return;let p=Number(l.dataset.prompt),m=g.panelPrompts[p]??g.panelBullets[p];m&&e.onSend(m)})});let a=t.querySelector("form"),c=t.querySelector("input");a instanceof HTMLFormElement&&c instanceof HTMLInputElement&&a.addEventListener("submit",l=>{l.preventDefault();let p=c.value.trim();p&&(c.value="",e.onSend(p))}),t.dataset.chromeKey=n}let o=t.querySelector('[data-region="transcript"]');o instanceof HTMLElement&&Nt(o,e.transcript,e.onCardTap)}function $r(t,e,n,o,r,i,s=8){let a=Math.max(s,r-n-s),c=Math.max(s,i-o-s);return{x:Math.min(Math.max(s,t),a),y:Math.min(Math.max(s,e),c)}}function Or(t,e,n,o=8){let r=(t.left+t.right)/2,i=(t.top+t.bottom)/2,s=r>e/2?"right":"left",a=i>n/2?"bottom":"top",c=Math.max(o,s==="right"?e-t.right:t.left),l=Math.max(o,a==="bottom"?n-t.bottom:t.top);return{hSide:s,hVal:c,vSide:a,vVal:l}}function ce(t,e){t.classList.add("dragged"),t.style.transform="none",e.hSide==="right"?(t.style.right=`${e.hVal}px`,t.style.left="auto"):(t.style.left=`${e.hVal}px`,t.style.right="auto"),e.vSide==="bottom"?(t.style.bottom=`${e.vVal}px`,t.style.top="auto"):(t.style.top=`${e.vVal}px`,t.style.bottom="auto"),t.classList.toggle("dock-top",e.vSide==="top"),t.classList.toggle("dock-bottom",e.vSide==="bottom"),t.classList.toggle("dock-left",e.hSide==="left"),t.classList.toggle("dock-right",e.hSide==="right")}function zn(t){try{let e=window.localStorage.getItem(t);if(!e)return null;let n=JSON.parse(e);if((n.hSide==="left"||n.hSide==="right")&&(n.vSide==="top"||n.vSide==="bottom")&&typeof n.hVal=="number"&&typeof n.vVal=="number")return n}catch{}return null}function Dr(t,e){try{window.localStorage.setItem(t,JSON.stringify(e))}catch{}}function Fn(t,e){let n=e.offsetWidth||0,o=e.offsetHeight||0,r=window.innerWidth,i=window.innerHeight;return{...t,hVal:Math.min(Math.max(8,t.hVal),Math.max(8,r-n-8)),vVal:Math.min(Math.max(8,t.vVal),Math.max(8,i-o-8))}}function Un(t){let{root:e,surface:n,storageKey:o}=t,r=()=>n.querySelector(".tray")??n,i=zn(o);i&&ce(e,Fn(i,r()));let s=0,a=0,c=0,l=0,p=!1,m=null,v=w=>{if(m!==null&&w.pointerId!==m)return;let b=w.clientX-s,L=w.clientY-a;if(!p&&Math.hypot(b,L)<6)return;if(!p)try{m!=null&&n.setPointerCapture(m)}catch{}p=!0,e.classList.add("dragging","dragged"),e.style.transform="none";let R=e.offsetWidth,h=e.offsetHeight,{x:d,y:u}=$r(c+b,l+L,R,h,window.innerWidth,window.innerHeight);e.style.left=`${d}px`,e.style.top=`${u}px`,e.style.right="auto",e.style.bottom="auto",e.classList.remove("dock-top","dock-bottom","dock-left","dock-right"),w.preventDefault()},y=w=>{if(window.removeEventListener("pointermove",v),window.removeEventListener("pointerup",y),m=null,!p)return;p=!1,e.classList.remove("dragging");let b=h=>{h.stopPropagation(),h.preventDefault()};n.addEventListener("click",b,{capture:!0,once:!0}),window.setTimeout(()=>n.removeEventListener("click",b,{capture:!0}),350);let L=r().getBoundingClientRect(),R=Or({top:L.top,left:L.left,right:L.right,bottom:L.bottom},window.innerWidth,window.innerHeight);ce(e,R),Dr(o,R),w.preventDefault()},C=w=>{if(w.button!=null&&w.button!==0)return;let b=r().getBoundingClientRect();s=w.clientX,a=w.clientY,c=b.left,l=b.top,p=!1,m=w.pointerId??null,window.addEventListener("pointermove",v),window.addEventListener("pointerup",y)},M=()=>{let w=zn(o);w&&ce(e,Fn(w,r()))};return n.addEventListener("pointerdown",C),window.addEventListener("resize",M),()=>{n.removeEventListener("pointerdown",C),window.removeEventListener("pointermove",v),window.removeEventListener("pointerup",y),window.removeEventListener("resize",M)}}function Vr(t){return t.voiceState==="connecting"?"connecting":t.voiceState!=="idle"?"connected":t.voiceError?"error":t.invited?"incoming":"resting"}function Wr(t,e){return[e,t.mode,t.callable?"1":"0",t.voiceState,t.connection,t.invited?"1":"0",t.personaName,t.personaInitial,t.personaAvatarUrl,t.launcherLabel??"",t.launcherCaption??""].join("|")}function zr(t,e){let n=t.voiceState==="muted",o=t.voiceState==="speaking",r=t.connection==="disconnected",i=(y,C)=>`
    <button class="tray-call" data-action="call" aria-label="${C}">
      ${In}<span class="tray-call-label">${y}</span>
    </button>`,s=`
    <button class="tray-btn ghost" data-action="chat" aria-label="${g.openAria}">${se}</button>`,a=`
    <button class="tray-btn tray-chat" data-action="chat" aria-label="${g.chatAria}" title="${g.chatAria}">${se}</button>`,c=y=>`
    <button class="tray-btn ${n?"muted":""}" data-action="mic" ${y?"disabled":""}
      aria-pressed="${n}" aria-label="${n?g.micUnmute:g.micMute}">${n?Rn:Pn}</button>`,l=`
    <button class="tray-btn end" data-action="end" aria-label="${g.endCallAria}">${Ln}</button>`,p='<span class="tray-spinner" aria-hidden="true"></span>',m=`
    <div class="tray-waveform active ${o?"speaking":""}" aria-hidden="true">
      ${Array.from({length:14}).map(()=>'<span class="bar"></span>').join("")}
    </div>`,v=r?"offline":"online";switch(e){case"incoming":return{caption:g.captionIncoming,captionClass:"incoming",presenceClass:v,nameText:t.personaName,controls:`${i(g.acceptCta,g.acceptAria)}${a}`};case"connecting":return{caption:g.captionThinking,captionClass:"thinking",presenceClass:"online",nameText:t.personaName,controls:`${p}${c(!0)}${l}`};case"connected":return{caption:g.captionConnected,captionClass:"connected",presenceClass:"online",nameText:t.personaName,controls:`${m}${c(!1)}${l}`};case"error":return{caption:g.captionRetry,captionClass:"retry",presenceClass:"offline",nameText:t.personaName,controls:`${i(g.callCta,g.retryAria)}${l}`};default:{let y=t.launcherLabel?.trim(),C=t.launcherCaption?.trim();return{caption:r?g.captionOffline:C||g.captionResting,captionClass:r?"retry":"resting",presenceClass:v,nameText:y||`${g.talkToPrefix} ${t.personaName}`,controls:t.callable?`${i(g.callCta,g.callAria)}${a}`:s}}}}function jn(t,e){let n=Vr(e),o=Wr(e,n);if(t.dataset.trayKey===o)return;let r=zr(e,n),i=e.mode==="chat"||e.mode==="call"||e.mode==="expanded";t.innerHTML=`
    <div class="tray phase-${n}" role="region" aria-label="shoppingmate">
      <button class="tray-avatar" data-action="toggle" aria-expanded="${i}" aria-label="${g.openAria}">
        <span class="tray-avatar-ring" aria-hidden="true"></span>
        <img src="${e.personaAvatarUrl}" alt="" class="tray-avatar-img" draggable="false" onerror="this.style.display='none'; this.nextElementSibling.style.display='grid';" />
        <span class="tray-avatar-fallback" aria-hidden="true">${e.personaInitial}</span>
        <span class="tray-presence ${r.presenceClass}"></span>
      </button>
      <div class="tray-meta">
        <div class="tray-name">${r.nameText}</div>
        <div class="tray-caption ${r.captionClass}">${r.caption}</div>
      </div>
      <div class="tray-controls">${r.controls}</div>
    </div>
  `,t.querySelector('[data-action="toggle"]')?.addEventListener("click",()=>{i?e.onClose():e.onChat()}),t.querySelector('[data-action="call"]')?.addEventListener("click",e.onCall),t.querySelector('[data-action="chat"]')?.addEventListener("click",e.onChat),t.querySelector('[data-action="mic"]')?.addEventListener("click",()=>{e.onMute(e.voiceState!=="muted")}),t.querySelector('[data-action="end"]')?.addEventListener("click",e.onEnd),t.dataset.trayKey=o}var Bn="shoppingmate-widget",qn="SM-XPK2EN",Gn="SM-2SCCLZ",Kn=new Set(["bottom-right","bottom-left","bottom-center","center","center-left","center-right","top-right","top-left"]),Yn=new Set(["small","medium","large"]),Ur=6e3,jr=12e3,Br=["cart-sidebar-show","cart-open","cart--open","cart-drawer-open","cart-drawer--active","cart-drawer-is-open","js-drawer-open","drawer-open","drawer--open","js-drawer-open-right","cart-active","is-cart-open","cart-is-open","cart-visible","show-cart","cart-show","mini-cart-active","minicart-active","mini-cart--active","ajaxcart-open","header-cart-open"],qr=["menu-open","menu--open","menu-is-open","is-menu-open","menu-drawer-open","menu-drawer--active","mobile-menu-open","mobile-menu--open","mobile-nav-open","nav-open","nav--open","nav-is-open","is-nav-open","js-nav-open","js-menu-open","navigation-open","header-menu-open","offcanvas-open","off-canvas-open","offcanvas-nav-open","offcanvas-menu-open"];function Gr(t,e){if(e==="/cart"||e.startsWith("/cart/")||e.startsWith("/cart?"))return!0;let n=t.toLowerCase();return Br.some(o=>n.includes(o))||qr.some(o=>n.includes(o))}function Kr(){try{let t=window.location.pathname||"",e=`${document.documentElement.className} ${document.body?document.body.className:""}`;return Gr(e,t)}catch{return!1}}function Yr(){return"live-kit"==="web-speech"?"web-speech":"live-kit"}var le=class extends HTMLElement{constructor(){super(...arguments);S(this,"rootEl",null);S(this,"pillHost",null);S(this,"panelHost",null);S(this,"store",ae({sessionId:"pending"}));S(this,"socket",null);S(this,"voiceMode",et(null,kt()));S(this,"voice",null);S(this,"persona",kn());S(this,"launcherLabel",null);S(this,"launcherCaption",null);S(this,"heldCaptions",[]);S(this,"apiBase","");S(this,"merchantId","");S(this,"carePhotos",!1);S(this,"attaching",!1);S(this,"domain",window.location.host);S(this,"stopActivityTracker",null);S(this,"inviteTimer",null);S(this,"inviteDismissTimer",null);S(this,"collapseTimer",null);S(this,"stopCollapse",null);S(this,"cartObserver",null);S(this,"scrollResizeRaf",!1);S(this,"overlayRecheck",null);S(this,"stopDrag",null);S(this,"ambience",Vt(!1));S(this,"ready",!1);S(this,"pendingOpen",null);S(this,"onOpenRequest",n=>{let o=n.detail?.mode==="chat"?"chat":"call";if(!this.ready){this.pendingOpen=o;return}this.openFromPage(o)});S(this,"onPageHidden",()=>{document.visibilityState!=="visible"&&this.voiceMode.getState()!=="idle"&&(this.voiceMode.stop(),this.ambience.stop(),this.store.dispatch({type:"set_mode",mode:"pill"}))});S(this,"onHostGesture",()=>{this.onCartVisibilityChange(),window.setTimeout(this.onCartVisibilityChange,200),window.setTimeout(this.onCartVisibilityChange,550)});S(this,"onScrollResize",()=>{this.scrollResizeRaf||(this.scrollResizeRaf=!0,requestAnimationFrame(()=>{this.scrollResizeRaf=!1,this.onCartVisibilityChange()}))});S(this,"onCartVisibilityChange",()=>{if(!this.rootEl)return;let n=this.store.get(),o=n.mode==="call"||n.voiceState!=="idle",r=n.mode==="chat"||n.mode==="expanded",i=(Kr()||!r&&this.launcherCovered())&&!o;this.rootEl.classList.toggle("host-overlay-hidden",i)})}openFromPage(n){n==="chat"?this.store.dispatch({type:"set_mode",mode:"chat"}):this.openCall()}connectedCallback(){if(this.shadowRoot)return;window.addEventListener("shoppingmate:open",this.onOpenRequest);let n=this.getAttribute("data-id"),o=this.getAttribute("data-api")??this.apiBase;if(!n){console.warn("[shoppingmate] data-id missing on widget element");return}this.merchantId=n,this.apiBase=o,this.ambience=Vt(this.getAttribute("data-ambience")!=="off");let r=this.attachShadow({mode:"open"}),i=document.createElement("style");i.textContent=Cn,r.appendChild(i);let s=document.createElement("div"),a=this.merchantId===Gn?"center-left":"bottom-right",c=(this.getAttribute("data-position")??a).toLowerCase(),l=Kn.has(c)?`pos-${c}`:"pos-bottom-right",p=(this.getAttribute("data-size")??"medium").toLowerCase(),m=Yn.has(p)&&p!=="medium"?` size-${p}`:"";s.className=`root ${l}${m}`,r.appendChild(s),this.rootEl=s,this.panelHost=document.createElement("div"),this.pillHost=document.createElement("div"),s.appendChild(this.panelHost),s.appendChild(this.pillHost),this.store.subscribe(()=>this.render()),this.render(),this.stopDrag=Un({root:s,surface:this.pillHost,storageKey:`sm-widget-pos:${this.merchantId}`}),this.stopCollapse=this.setupAutoCollapse(s,this.pillHost),document.addEventListener("visibilitychange",this.onPageHidden),window.addEventListener("pagehide",this.onPageHidden),this.setupCartVisibility(s),this.start()}applyServerPosition(n){let o=this.rootEl;if(!o||o.classList.contains("dragged"))return;let r=n.toLowerCase();if(Kn.has(r)){for(let i of Array.from(o.classList))i.startsWith("pos-")&&o.classList.remove(i);o.classList.add(`pos-${r}`)}}applyAccent(n){let o=this.rootEl;if(!o)return;let r=n.trim();!/^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(r)&&!/^rgba?\([\d.,\s%]+\)$/i.test(r)||o.style.setProperty("--sm-accent",r)}applyServerSize(n){let o=this.rootEl;if(!o)return;let r=n.toLowerCase();Yn.has(r)&&(o.classList.remove("size-small","size-large"),r!=="medium"&&o.classList.add(`size-${r}`))}disconnectedCallback(){window.removeEventListener("shoppingmate:open",this.onOpenRequest),document.removeEventListener("visibilitychange",this.onPageHidden),window.removeEventListener("pagehide",this.onPageHidden),this.socket?.close(),this.voiceMode.stop(),this.ambience.stop(),this.stopActivityTracker?.(),this.inviteTimer&&clearTimeout(this.inviteTimer),this.inviteDismissTimer&&clearTimeout(this.inviteDismissTimer),this.collapseTimer&&clearTimeout(this.collapseTimer),this.stopCollapse?.(),this.cartObserver?.disconnect(),window.removeEventListener("popstate",this.onCartVisibilityChange),document.removeEventListener("click",this.onHostGesture,!0),document.removeEventListener("keyup",this.onHostGesture,!0),window.removeEventListener("scroll",this.onScrollResize),window.removeEventListener("resize",this.onScrollResize),this.overlayRecheck&&window.clearInterval(this.overlayRecheck),this.stopDrag?.()}setupCartVisibility(n){this.onCartVisibilityChange(),this.cartObserver=new MutationObserver(this.onCartVisibilityChange),this.cartObserver.observe(document.documentElement,{attributes:!0,attributeFilter:["class"]}),document.body&&this.cartObserver.observe(document.body,{attributes:!0,attributeFilter:["class"]}),window.addEventListener("popstate",this.onCartVisibilityChange),document.addEventListener("click",this.onHostGesture,!0),document.addEventListener("keyup",this.onHostGesture,!0),window.addEventListener("scroll",this.onScrollResize,{passive:!0}),window.addEventListener("resize",this.onScrollResize),this.overlayRecheck=window.setInterval(()=>{this.rootEl?.classList.contains("host-overlay-hidden")&&this.onCartVisibilityChange()},1500)}launcherCovered(){let n=this.rootEl;if(!n||typeof document.elementsFromPoint!="function")return!1;let o=n.getBoundingClientRect();if(!o.width||!o.height)return!1;let r=o.left+o.width/2,i=o.top+o.height/2;for(let s of document.elementsFromPoint(r,i)){if(s===this||this.contains(s)||s.contains(this)||s.tagName==="SHOPPINGMATE-WIDGET")continue;let a=s;for(;a&&a!==document.body&&a!==document.documentElement;){let c=getComputedStyle(a);if(c.position==="fixed"&&c.pointerEvents!=="none"){let l=a.getBoundingClientRect(),p=l.left<=r&&l.right>=r&&l.top<=i&&l.bottom>=i,m=l.width>=window.innerWidth*.4||l.height>=window.innerHeight*.4,v=c.visibility!=="hidden"&&c.display!=="none"&&Number(c.opacity)>.01;if(p&&m&&v)return!0}a=a.parentElement}}return!1}setupAutoCollapse(n,o){let r=()=>{this.collapseTimer&&clearTimeout(this.collapseTimer),this.collapseTimer=setTimeout(()=>n.classList.add("collapsed"),Ur)},i=()=>{n.classList.remove("collapsed"),r()};return o.addEventListener("pointerenter",i),o.addEventListener("pointerdown",i),o.addEventListener("focusin",i),o.addEventListener("pointerleave",r),r(),()=>{o.removeEventListener("pointerenter",i),o.removeEventListener("pointerdown",i),o.removeEventListener("focusin",i),o.removeEventListener("pointerleave",r)}}async start(){let n=await Ze({apiBase:this.apiBase,merchantId:this.merchantId,domain:this.domain});if(n.kind==="err"){console.warn("[shoppingmate] bootstrap failed:",n.reason);return}if(this.store=ae({sessionId:n.sessionId}),this.store.subscribe(()=>this.render()),Ue({apiBase:this.apiBase,merchantId:this.merchantId,sessionId:n.sessionId}),n.insights?.enabled&&hn({apiBase:this.apiBase,merchantId:this.merchantId,sessionId:n.sessionId,visitorId:n.visitorId,config:n.insights}),this.voice=n.voice,this.carePhotos=n.care?.photos===!0,this.ready=!0,this.pendingOpen){let i=this.pendingOpen;this.pendingOpen=null,queueMicrotask(()=>this.openFromPage(i))}this.persona=xn(n.personaId??n.voice?.personaId??null),n.widgetPosition&&this.applyServerPosition(n.widgetPosition),n.widgetSize&&this.applyServerSize(n.widgetSize),n.widgetAccent&&this.applyAccent(n.widgetAccent),this.launcherLabel=n.widgetLabel?.trim()||null,this.launcherCaption=n.widgetGreeting?.trim()||null,this.render();let o=Yr(),r=it();if(o==="live-kit"&&this.voice?.transport==="ws"&&this.voice.voiceWsUrl){let i=this.voice;this.voiceMode=rn(on({sessionId:n.sessionId,url:i.voiceWsUrl,onAgentEvent:s=>this.handleLiveKitData(s)}),()=>(zt(),at({stack:"live-kit",livekit:{sessionId:n.sessionId,wsUrl:i.wsUrl,token:i.token,roomName:i.roomName,onTranscriptEvent:s=>this.handleLiveKitData(s)}})),{onSwitch:s=>console.warn("[shoppingmate] voice fell back to LiveKit:",s)}),this.armVoiceWarm()}else if(o==="live-kit"&&this.voice){zt();let i=at({stack:"live-kit",livekit:{sessionId:n.sessionId,wsUrl:this.voice.wsUrl,token:this.voice.token,roomName:this.voice.roomName,onTranscriptEvent:s=>this.handleLiveKitData(s)}});i&&(this.voiceMode=i,this.armVoiceWarm())}else{let i=at({stack:"web-speech"});i&&(this.voiceMode=i),r?.onFinal(s=>{this.store.dispatch({type:"user_input",text:s,mode:"voice"}),this.socket?.send(O({type:"user_text",sessionId:n.sessionId,text:s,mode:"voice",visitorId:pt()}))})}this.voiceMode.onStateChange(i=>{if(this.store.dispatch({type:"set_voice_state",state:i}),i!=="connecting"&&this.heldCaptions.length)for(let s of this.heldCaptions.splice(0))i!=="idle"&&this.store.dispatch({type:"agent_event",event:s})}),this.voiceMode.onError?.(i=>{console.warn("[shoppingmate] voice error",i),this.store.dispatch({type:"set_voice_error",error:i})}),this.socket=En(n.wsUrl,{sessionId:n.sessionId,onEvent:i=>{let s=Wt(i);s&&this.handleAgentEvent(s)},onStatus:i=>this.store.dispatch({type:"set_connection",status:i})}),(this.merchantId===qn||this.merchantId===Gn)&&(this.inviteTimer=setTimeout(()=>{this.store.get().voiceState==="idle"&&this.store.get().mode==="pill"&&(this.store.dispatch({type:"set_invited",invited:!0}),this.inviteDismissTimer=setTimeout(()=>{let i=this.store.get();i.invited&&i.voiceState==="idle"&&i.mode==="pill"&&this.store.dispatch({type:"set_invited",invited:!1})},jr))},5e3)),this.stopActivityTracker=an({sessionId:n.sessionId,hints:new Map,send:i=>this.publishWidgetMessage(i)})}armVoiceWarm(){let n=this.pillHost;if(!n)return;let o=()=>this.voiceMode.warm?.();for(let i of["pointerenter","touchstart","focusin"])n.addEventListener(i,o,{passive:!0});let r=!1;this.store.subscribe(()=>{let i=this.store.get(),s=i.invited||i.mode==="chat"||i.mode==="expanded";s&&!r&&o(),r=s})}async handleAgentEvent(n,o="ws"){if(n.type==="host_action_request"){let r=await Ke(n.action),i=un(n.action,r);i&&this.store.dispatch({type:"receipt",text:i.text,ok:i.ok}),this.publishWidgetMessage({type:"host_action_result",callId:n.callId,result:r},o);return}if(n.type!=="persona_swap"&&n.type!=="agent_warmed"){if(n.type==="agent_ready"){this.voiceMode.signalAgentReady?.();return}if((n.type==="say"||n.type==="say_partial")&&this.voiceMode.getState()==="connecting"){this.heldCaptions.push(n);return}this.store.dispatch({type:"agent_event",event:n}),n.type==="say"&&this.voiceMode.speak(n.text)}}publishWidgetMessage(n,o="ws"){let r=O(n);if(o==="livekit"&&this.voiceMode.publishData){let i=new TextEncoder().encode(r);this.voiceMode.publishData(i);return}this.socket?.send(r)}render(){if(!this.pillHost||!this.panelHost)return;let n=this.store.get();this.onCartVisibilityChange();let o=it()!==null;n.mode==="call"?Vn(this.panelHost,{voiceState:n.voiceState,muted:n.voiceState==="muted",transcript:n.transcript,checkoutUrl:n.checkoutUrl,personaName:this.persona.name,voiceError:n.voiceError,onClose:()=>this.store.dispatch({type:"set_mode",mode:"pill"}),onCardTap:r=>this.cardTap(r),onCheckout:()=>{},photosEnabled:this.carePhotos,onAttach:()=>void this.attachPhotos()}):n.mode==="chat"||n.mode==="expanded"?Wn(this.panelHost,{transcript:n.transcript,checkoutUrl:n.checkoutUrl,personaName:this.persona.name,personaInitial:this.persona.initial,personaAvatarUrl:this.persona.avatarUrl,onSend:r=>this.userText(r,"text"),onCall:()=>this.openCall(),onClose:()=>this.store.dispatch({type:"set_mode",mode:"pill"}),onCardTap:r=>this.cardTap(r),closed:n.closed,photosEnabled:this.carePhotos,onAttach:()=>void this.attachPhotos()}):this.panelHost.innerHTML="",jn(this.pillHost,{mode:n.mode,callable:o,voiceState:n.voiceState,connection:n.connection,voiceError:n.voiceError,invited:n.invited,personaName:this.persona.name,personaInitial:this.persona.initial,personaAvatarUrl:this.persona.avatarUrl,launcherLabel:this.launcherLabel,launcherCaption:this.launcherCaption,onCall:()=>this.openCall(),onMute:r=>this.voiceMode.setMuted(r),onEnd:()=>{this.voiceMode.stop(),this.ambience.stop(),this.store.dispatch({type:"set_mode",mode:"pill"})},onChat:()=>{n.invited&&this.store.dispatch({type:"set_invited",invited:!1}),this.store.dispatch({type:"set_mode",mode:"chat"})},onClose:()=>this.store.dispatch({type:"set_mode",mode:"pill"})})}openCall(){this.store.get().invited&&(this.merchantId===qn&&this.publishWidgetMessage({type:"tour_request"}),this.store.dispatch({type:"set_invited",invited:!1})),this.inviteTimer&&(clearTimeout(this.inviteTimer),this.inviteTimer=null),this.store.dispatch({type:"set_mode",mode:"call"}),this.voiceMode.start(),this.ambience.start()}async attachPhotos(){if(this.attaching)return;let n=await gn();if(n.length===0)return;this.attaching=!0;let o=this.store.get().sessionId,r=0;try{for(let i of n.slice(0,3)){let s;try{let a=await yn(i);s=await bn({apiBase:this.apiBase,merchantId:this.merchantId,sessionId:o,photo:a})}catch{s={ok:!1,message:"That file isn't a photo we can read. Try a JPEG or PNG."}}s.ok?r+=1:this.store.dispatch({type:"receipt",text:s.message,ok:!1})}}finally{this.attaching=!1}if(r!==0)if(this.store.dispatch({type:"receipt",text:`${g.photoAttached}${r>1?` (${r})`:""}`,ok:!0}),this.store.get().mode==="call"&&this.voiceMode.publishData){let i=new TextEncoder().encode(O({type:"care_photo",sessionId:o,count:r}));this.voiceMode.publishData(i)}else this.userText(r>1?`I've attached ${r} photos.`:"I've attached a photo.","text")}userText(n,o){fn(),this.store.dispatch({type:"user_input",text:n,mode:o});let r=this.store.get().sessionId;this.socket?.send(O({type:"user_text",sessionId:r,text:n,mode:o,visitorId:pt()}))}handleLiveKitData(n){let o;try{o=new TextDecoder().decode(n)}catch{return}let r=Wt(o);r&&this.handleAgentEvent(r,"livekit")}cardTap(n){let o=this.store.get().sessionId;this.socket?.send(O({type:"card_tap",sessionId:o,action:"cartAdd",sku:n.sku,variantId:n.variantId,qty:1}))}};function Jn(){customElements.get(Bn)||customElements.define(Bn,le)}window.__shoppingmateNav__={snapshot:()=>tt().text,keys:()=>yt(tt().text)};function Jr(){let t=document.currentScript instanceof HTMLScriptElement?document.currentScript:null,e=t?.dataset.id;if(!e){console.warn("[shoppingmate] data-id missing on script tag");return}let o=(t?.dataset.api??"https://api-production-1ea1.up.railway.app").trim(),r=document.querySelector("shoppingmate-widget");r&&(r.getAttribute("data-api")||r.setAttribute("data-api",o),r.getAttribute("data-id")||r.setAttribute("data-id",e)),Jn();let i=()=>{let s=document.querySelector("shoppingmate-widget");if(s){s.getAttribute("data-api")||s.setAttribute("data-api",o),s.getAttribute("data-id")||s.setAttribute("data-id",e);return}let a=document.createElement("shoppingmate-widget");a.setAttribute("data-id",e),a.setAttribute("data-api",o),document.body.appendChild(a)};document.readyState==="loading"?document.addEventListener("DOMContentLoaded",i,{once:!0}):i()}Jr();})();
