"use strict";(()=>{var Kn=Object.defineProperty;var Gn=(e,t,n)=>t in e?Kn(e,t,{enumerable:!0,configurable:!0,writable:!0,value:n}):e[t]=n;var C=(e,t,n)=>Gn(e,typeof t!="symbol"?t+"":t,n);function oe(e,t){let n=t.toLowerCase().replace(/[₹$£€]|rs\.?|inr|usd/g," ").replace(/\d+([.,]\d+)?/g," ").replace(/[^a-z\s]/g," ").replace(/\s+/g," ").trim().slice(0,40);return n.length<2||e==="text"?null:`${e}|${n}`}function ye(e){let t=new Set;for(let n of e.split(`
`)){let o=/^\[e\d+\] ([a-z]+) "([^"]*)"/.exec(n);if(!o)continue;let r=oe(o[1],o[2]);r&&t.add(r)}return[...t]}function Yn(e,t){if(e.length===0)return 0;let n=0;for(let o of e)t.has(o)&&(n+=1);return n/e.length}function Jn(e,t){try{return new RegExp(e).test(t)}catch{return!1}}function ut(e,t,n){let o=new Set(e),r=null,i=null;for(let a of n){if(a.skeleton.length<4)continue;let s=Yn(a.skeleton,o),c=Jn(a.urlPattern,t),l=s+(c?.05:0);s>=.7&&(!r||l>r.c)&&(r={t:a,c:l}),c&&s<.7&&(!i||s<i.coverage)&&(i={template:a,coverage:s})}return r?{template:r.t,coverage:Math.min(1,r.c),drift:null}:{template:null,coverage:0,drift:i}}var Xn=new Set(["the","a","an","to","of","on","in","and","or","section","button","link","card","tile","now"]),Qn=[{keyword:"button",matchTag:/^(button)$/i,matchRole:"button"},{keyword:"link",matchTag:/^(a)$/i,matchRole:"link"},{keyword:"card",matchTag:/^(article|div|section)$/i},{keyword:"section",matchTag:/^(section|main|article)$/i}],Zn=.4;function Y(e,t){if(t){let i=t.get(e.toLowerCase().trim());if(i)try{let a=document.querySelector(i);if(a instanceof HTMLElement&&G(a))return a}catch{}}let n=re(e);if(n.size===0)return null;let o=eo(document.body),r=null;for(let i of o){if(!i.visible)continue;let a=to(i,e,n);a<Zn||(!r||a>r.score)&&(r={c:i,score:a})}return r?.c.element??null}function re(e){return new Set(e.toLowerCase().replace(/[^a-z0-9 ]/g," ").split(/\s+/).filter(t=>t.length>0&&!Xn.has(t)))}function eo(e){let t=[],n=document.createTreeWalker(e,NodeFilter.SHOW_ELEMENT),o=n.nextNode();for(;o;){if(o instanceof HTMLElement){let r=Z(o);r&&t.push({element:o,role:o.getAttribute("role")??o.tagName.toLowerCase(),name:r,visible:G(o)})}o=n.nextNode()}return t}function Z(e){let t=e.getAttribute("aria-labelledby");if(t){let i=t.split(/\s+/).map(a=>document.getElementById(a)?.textContent?.trim()??"").filter(Boolean);if(i.length>0)return i.join(" ")}let n=e.getAttribute("aria-label");if(n)return n.trim();if(e.id){let i=document.querySelector(`label[for="${pt(e.id)}"]`);if(i?.textContent)return i.textContent.trim()}let o=e.getAttribute("alt")??e.getAttribute("title");if(o)return o.trim();let r=(e.textContent??"").trim();return r&&r.length<200?r:""}function G(e){if(!e.isConnected)return!1;let t=e.ownerDocument.defaultView?.getComputedStyle(e);return t?!(t.display==="none"||t.visibility==="hidden"||t.opacity==="0"):!0}function to(e,t,n){let o=re(e.name);if(o.size===0)return 0;let r=0;for(let m of n)o.has(m)&&r++;let i=new Set([...n,...o]).size,a=i===0?0:r/i,s=0,c=t.toLowerCase();for(let m of Qn)if(c.includes(m.keyword)&&(m.matchTag.test(e.element.tagName)||e.role===m.matchRole)){s=.15;break}let l=e.element.getAttribute("data-tour-stop"),p=0;if(l){let m=re(l.replace(/-/g," ")),v=0;for(let g of n)m.has(g)&&v++;v>0&&(p=.5*(v/n.size))}return Math.min(1,a+s+p)}function pt(e){return e.replace(/(["\\])/g,"\\$1")}function $e(e,t){if(t){let i=t.get(e.toLowerCase().trim());if(i)try{let a=document.querySelector(i);if(a instanceof HTMLElement&&G(a))return a}catch{}}let n=re(e);if(n.size===0)return null;let o=Array.from(document.querySelectorAll("input, textarea, select")).filter(i=>G(i)&&!no(i)),r=null;for(let i of o){let a=io(i,n);a<=0||(!r||a>r.score)&&(r={el:i,score:a})}return r?.el??null}function no(e){let t=(e.getAttribute("type")??"").toLowerCase();return t==="hidden"||t==="submit"||t==="button"||e.disabled}function oo(e){let t=[],n=e.id;if(n){t.push(n);let c=document.querySelector(`label[for="${pt(n)}"]`);c?.textContent&&t.push(c.textContent)}let o=e.getAttribute("name");o&&t.push(o);let r=e.getAttribute("data-field")??e.getAttribute("data-testid");r&&t.push(r);let i=e.getAttribute("aria-label");i&&t.push(i);let a=e.getAttribute("placeholder");a&&t.push(a);let s=e.closest("label");return s?.textContent&&t.push(s.textContent),t}var ro=[["phone","mobile","cell","contact","phonenumber","tel","whatsapp"],["pincode","pin","postal","postcode","zip","zipcode"],["name","fullname"],["email","mail","emailaddress"],["address","street","addr","address1"],["city","town"],["state","province","region"],["landmark","apartment","flat","floor"]],mt=new Map;for(let e of ro)for(let t of e)mt.set(t,e[0]);function dt(e){return mt.get(e)??e}function io(e,t){let n=new Set([...t].map(dt)),o=0;for(let r of oo(e)){let i=new Set([...re(r)].map(dt));if(i.size===0)continue;let a=0;for(let c of n)i.has(c)&&a++;if(a===0)continue;let s=a/n.size;s>o&&(o=s)}return o}var ve="data-sm-ref",so=6e3,be=["a[href]","button","input","select","textarea","summary",'[role="button"]','[role="link"]','[role="tab"]','[role="radio"]','[role="checkbox"]','[role="switch"]','[role="option"]','[role="menuitem"]','[role="combobox"]'].join(","),ft='h1,h2,h3,[role="heading"],[role="alert"],[role="status"]',ao='dialog[open],[role="dialog"],[role="alertdialog"],[aria-modal="true"]',co=/(₹|\$|£|€|Rs\.?\s?|INR\s?|USD\s?|AED\s?)\s?\d[\d,]*(\.\d+)?|\d[\d,]*(\.\d+)?\s?(₹|\$|£|€)/,Oe=new Map;function V(e){let t=e;for(;t;){if(t instanceof Element){if(t.tagName==="SHOPPINGMATE-WIDGET")return!0;for(let n of Array.from(t.attributes))if(n.name.startsWith("data-shoppingmate"))return!0}t=t.parentNode}return!1}function lo(e){return e.closest('[aria-hidden="true"],[inert]')!==null}function uo(){return(document.body?.getBoundingClientRect().width??0)>0}function po(e,t){if(!t)return!0;let n=e.getBoundingClientRect();return n.width>0||n.height>0}function mo(e){let t=e.getAttribute("role");if(t)return t;let n=e.tagName.toLowerCase();if(n==="a")return"link";if(/^h[1-6]$/.test(n))return"heading";if(n==="select")return"select";if(n==="textarea")return"textbox";if(n==="input"){let o=(e.getAttribute("type")??"text").toLowerCase();return o==="radio"||o==="checkbox"?o:o==="submit"||o==="button"||o==="reset"?"button":o==="number"?"spinbutton":"textbox"}return n}function fo(e){let t=Z(e);if(t)return t;if(e instanceof HTMLInputElement||e instanceof HTMLTextAreaElement||e instanceof HTMLSelectElement){let n=e.closest("label")?.textContent?.trim();if(n)return n}return e instanceof HTMLInputElement||e instanceof HTMLTextAreaElement?e.placeholder||e.name||"":e instanceof HTMLSelectElement&&e.name||""}function J(e,t=80){let n=e.replace(/\s+/g," ").trim();return n.length>t?`${n.slice(0,t-1)}\u2026`:n}function ho(e,t){let n=[];e instanceof HTMLInputElement&&(t==="radio"||t==="checkbox")?e.checked&&n.push("checked"):e.getAttribute("aria-checked")==="true"&&n.push("checked"),e.getAttribute("aria-selected")==="true"&&n.push("selected"),e.getAttribute("aria-pressed")==="true"&&n.push("pressed");let o=e.getAttribute("aria-expanded");if(o==="true"&&n.push("expanded"),o==="false"&&n.push("collapsed"),(e.disabled||e.getAttribute("aria-disabled")==="true")&&n.push("disabled"),e instanceof HTMLInputElement&&t!=="radio"&&t!=="checkbox"&&((e.getAttribute("type")??"text").toLowerCase()==="password"?e.value&&n.push("filled"):e.value&&n.push(`value="${J(e.value,40)}"`)),e instanceof HTMLTextAreaElement&&e.value&&n.push(`value="${J(e.value,40)}"`),e instanceof HTMLSelectElement){let r=e.selectedOptions[0];r&&n.push(`value="${J(r.textContent??"",40)}"`)}return n}function go(e){let t=e.getBoundingClientRect();if(t.width===0&&t.height===0&&t.top===0)return!0;let n=window.innerHeight||800;return t.bottom>-n&&t.top<n*2}function yo(e){return e.closest('footer,[role="contentinfo"]')!==null}function bo(){return Array.from(document.querySelectorAll(ao)).filter(t=>G(t)&&!V(t))}function vo(e){if(e.children.length>0)return!1;let t=(e.textContent??"").trim();return!t||t.length>40?!1:co.test(t)}function ee(e={}){let t=e.maxChars??so,n=[];for(let h of Array.from(document.querySelectorAll(`[${ve}]`)))h.removeAttribute(ve);Oe=new Map;let o=bo(),r=[],i=new Set,a=0,s=uo(),c=(h,d,u)=>{if(i.has(h)||V(h)||!G(h)||lo(h)||!po(h,s)||h instanceof HTMLInputElement&&h.type==="hidden")return;i.add(h);let k=d==="price"?"text":mo(h),x=d==="price"?J(h.textContent??"",40):J(fo(h)),T=d==="price"?[]:ho(h,k);if(!x&&T.length===0&&d!=="interactive"||!x&&d==="interactive"&&(k==="link"||k==="button"))return;let R=!u&&yo(h),D=!u&&h.closest('nav,header,[role="navigation"],[role="banner"]')!==null;if(e.collapse&&k==="link"&&(R||D)){let U=oe(k,x);if(U&&e.collapse.has(U)){n.length<12&&x.length<=24&&!/\d{3}|@/.test(x)&&!n.includes(x)&&n.push(x);return}}let $=u?0:d==="interactive"?2:d==="context"?1:2;!u&&!go(h)&&($+=3),R&&($+=4),D&&($+=2);let ne=T.length>0?` (${T.join(", ")})`:"",z=`${k} "${x}"${ne}`;r.push({el:h,line:z,priority:$,order:a++})};for(let h of o){let d=J(Z(h)||"dialog",60);r.push({el:h,line:`dialog "${d}" (open)`,priority:0,order:a++}),i.add(h);for(let u of Array.from(h.querySelectorAll(`${be},${ft}`)))c(u,u.matches(be)?"interactive":"context",!0)}let l=document.querySelector('main,[role="main"]')??document.body,p=l===document.body?[document.body]:[l,document.body];for(let h of p)for(let d of Array.from(h.querySelectorAll(`${be},${ft}`)))c(d,d.matches(be)?"interactive":"context",!1);let m=0;for(let h of Array.from(l.querySelectorAll("span,div,p,strong,b,s,del,ins,bdi"))){if(m>=15)break;if(!vo(h))continue;let d=r.length;c(h,"price",!1),r.length>d&&(m+=1)}let v=[`[page] ${J(document.title||"",70)} \xB7 ${location.pathname}`,...e.preface??[]];n.length>0&&v.push(`[site links] ${n.join(", ")} (standard site navigation \u2014 use site.navigate)`);let g=[...r].sort((h,d)=>h.priority-d.priority||h.order-d.order),S=[],M=v.join(`
`).length+1;for(let h of g){let d=h.line.length+8;M+d>t||(S.push(h),M+=d)}S.sort((h,d)=>h.order-d.order);let w=[...v],y=0;for(let h of S){y+=1;let d=`e${y}`;h.el.setAttribute(ve,d),Oe.set(d,h.el),w.push(`[${d}] ${h.line}`)}let L=r.length-S.length;L>0&&w.push(`\u2026 ${L} more elements not shown (lower on the page or in the footer)`);let H=w.join(`
`);return{text:H,refs:y,chars:H.length,truncated:L}}function we(e){let t=e.replace(/^\[|\]$/g,"").trim(),n=Oe.get(t);if(n?.isConnected)return n;try{let o=document.querySelector(`[${ve}="${CSS.escape(t)}"]`);return o?.isConnected?o:null}catch{return null}}var ht={start:()=>{},stop:()=>{}};function De(e){if(!e||typeof window>"u")return ht;let t=window.AudioContext??window.webkitAudioContext;if(!t)return ht;let n=null,o=null;return{start(){if(!n)try{n=new t;let r=Math.floor(n.sampleRate*2),i=n.createBuffer(1,r,n.sampleRate),a=i.getChannelData(0),s=0;for(let p=0;p<r;p++){let m=Math.random()*2-1;s=(s+.02*m)/1.02,a[p]=s*3.5}o=n.createBufferSource(),o.buffer=i,o.loop=!0;let c=n.createBiquadFilter();c.type="lowpass",c.frequency.value=900;let l=n.createGain();l.gain.value=.02,o.connect(c).connect(l).connect(n.destination),o.start(),n.resume?.().catch(()=>{})}catch{this.stop()}},stop(){try{o?.stop()}catch{}o=null;try{n?.close()}catch{}n=null}}}function ie(){let e=globalThis,t=e.SpeechRecognition??e.webkitSpeechRecognition;if(!t)return null;let n=new t;n.continuous=!0,n.interimResults=!1,n.lang="en-US";let o=!1,r=[],i=[];return n.onresult=a=>{for(let s=0;s<a.results.length;s+=1){let c=a.results[s];if(c?.isFinal){let l=c[0]?.transcript?.trim();if(l)for(let p of r)p(l)}}},n.onerror=a=>{for(let s of i)s(String(a?.error??"unknown"))},n.onend=()=>{o=!1},{start:()=>{if(!o){o=!0;try{n.start()}catch{}}},stop:()=>{if(o){o=!1;try{n.stop()}catch{}}},onFinal:a=>{r.push(a)},onError:a=>{i.push(a)},isActive:()=>o}}function ke(){let e=globalThis.speechSynthesis;if(!e)return{speak:async()=>{},cancel:()=>{},available:()=>!1};function t(){if(!e)return null;let n=e.getVoices();return n.find(o=>o.lang.startsWith("en-")&&o.default)??n.find(o=>o.lang.startsWith("en-"))??n[0]??null}return{speak:n=>new Promise(o=>{let r=new SpeechSynthesisUtterance(n),i=t();i&&(r.voice=i),r.rate=1,r.onend=()=>o(),r.onerror=()=>o(),e.speak(r)}),cancel:()=>e.cancel(),available:()=>!0}}function te(e,t){let n="idle",o=!1,r=[],i=a=>{if(n!==a){n=a;for(let s of r)s(a)}};return{start:()=>{if(n==="idle"){if(o){i("muted");return}e?.start(),i("listening")}},stop:()=>{e?.stop(),t.cancel(),i("idle")},speak:async a=>{n!=="idle"&&(e?.stop(),i("speaking"),await t.speak(a),o?i("muted"):(e?.start(),i("listening")))},setMuted:a=>{o=a,a?(e?.stop(),n==="listening"&&i("muted")):n==="muted"&&(e?.start(),i("listening"))},getState:()=>n,onStateChange:a=>{r.push(a)}}}function wo(e){if(!e||typeof e.type!="string")return!1;switch(e.type){case"navigate":return typeof e.path=="string";case"click":return typeof e.intent=="string"&&(e.ref===void 0||typeof e.ref=="string");case"scroll_to":case"highlight":case"point_at":case"demo_click":return typeof e.intent=="string";case"cart_add":case"cart_set_qty":return typeof e.sku=="string"&&typeof e.qty=="number";case"open_cart":case"cart_clear":case"cart_get":case"checkout_place":case"checkout_state":case"page_snapshot":return!0;case"apply_coupon":return typeof e.code=="string";case"product_lookup":return typeof e.handle=="string";case"checkout_fill":return!!e.details&&typeof e.details.name=="string"&&typeof e.details.phone=="string"&&typeof e.details.email=="string"&&typeof e.details.address=="string"&&typeof e.details.city=="string"&&typeof e.details.state=="string"&&typeof e.details.pincode=="string"&&(e.details.payment==="cod"||e.details.payment==="prepaid");case"form_fill":return Array.isArray(e.fields)&&e.fields.every(t=>t&&typeof t.field=="string"&&typeof t.value=="string"&&(t.ref===void 0||typeof t.ref=="string"));case"form_read":return e.fields===void 0||Array.isArray(e.fields);default:return!1}}function O(e){return JSON.stringify(e)}function Ve(e){let t;try{t=JSON.parse(e)}catch{return null}if(!t||typeof t!="object")return null;let n=t;switch(n.type){case"thinking":return{type:"thinking"};case"say":return typeof n.text=="string"?{type:"say",text:n.text}:null;case"say_partial":return typeof n.text=="string"?{type:"say_partial",text:n.text}:null;case"user_text":return typeof n.text=="string"?{type:"user_text",text:n.text}:null;case"cards":return Array.isArray(n.items)?{type:"cards",items:n.items}:null;case"tool_result":return typeof n.toolName!="string"||typeof n.ok!="boolean"?null:{type:"tool_result",toolName:n.toolName,ok:n.ok,summary:typeof n.summary=="string"?n.summary:void 0};case"checkout_redirect":return typeof n.url=="string"?{type:"checkout_redirect",url:n.url}:null;case"cap_warning":return n.reason!=="turns"&&n.reason!=="voice_ms"&&n.reason!=="duration_ms"||typeof n.remaining!="number"?null:{type:"cap_warning",reason:n.reason,remaining:n.remaining};case"end_of_turn":return{type:"end_of_turn"};case"session_closed":return n.reason!=="user"&&n.reason!=="cap"&&n.reason!=="error"?null:{type:"session_closed",reason:n.reason};case"host_action_request":{if(typeof n.callId!="string"||!n.action)return null;let o=n.action;return wo(o)?{type:"host_action_request",callId:n.callId,action:o}:null}case"persona_swap":return typeof n.personaId=="string"?{type:"persona_swap",personaId:n.personaId}:null;case"agent_warmed":return{type:"agent_warmed"};case"agent_ready":return{type:"agent_ready"};default:return null}}var gt="https://cdn.jsdelivr.net/npm",ko="2.7.0",xo="0.3.0",xe=null;function _o(){return xe||(xe=import(`${gt}/@livekit/krisp-noise-filter@${xo}/dist/index.mjs`).catch(()=>null),xe)}async function So(e){let t=await _o();if(!t?.KrispNoiseFilter||t.isKrispNoiseFilterSupported&&!t.isKrispNoiseFilterSupported())return;let n=e.localParticipant.getTrackPublication?.("microphone"),o=n?.audioTrack??n?.track;o?.setProcessor&&await o.setProcessor(t.KrispNoiseFilter())}var X=null;function yt(){return X||(typeof globalThis.__SHOPPINGMATE_LIVEKIT_LOADER__=="function"?(X=globalThis.__SHOPPINGMATE_LIVEKIT_LOADER__(),X):(X=import(`${gt}/livekit-client@${ko}/dist/livekit-client.esm.mjs`),X))}function We(){yt().catch(()=>{X=null})}function Co(){try{if(typeof window<"u"){let t=window;if(typeof t.__SM_AUDIO_FULL__=="boolean")return t.__SM_AUDIO_FULL__}let e=new URLSearchParams(location.search).get("smAudioFull");return!(e==="0"||e==="false")}catch{return!0}}async function bt(e){let t=await yt(),n=Co(),o=new t.Room({audioCaptureDefaults:{echoCancellation:!0,noiseSuppression:!0,autoGainControl:n,channelCount:1}}),r=new Map,i=!1;o.on("trackSubscribed",s=>{let c=s;if(c.kind!=="audio")return;let l=c.attach();l.style.display="none",l.muted=i,document.body.appendChild(l),r.set(s,l)}),o.on("trackUnsubscribed",s=>{let c=r.get(s);c&&(c.remove(),r.delete(s)),s.detach?.()});let a=[];return o.on("activeSpeakersChanged",s=>{let l=(s??[]).some(p=>!p.isLocal);for(let p of a)p(l)}),await o.connect(e.wsUrl,e.token),{setMicEnabled:async s=>{await o.localParticipant.setMicrophoneEnabled(s),s&&n&&So(o).catch(()=>{})},onData:s=>{o.on("dataReceived",c=>{c instanceof Uint8Array&&s(c)})},onAgentSpeaking:s=>{a.push(s)},setAgentAudioMuted:s=>{i=s;for(let c of r.values())c.muted=s},onReconnected:s=>{o.on("reconnected",()=>s())},publishData:s=>o.localParticipant.publishData(s,{reliable:!0}),disconnect:async()=>{for(let s of r.values())s.remove();r.clear(),await o.disconnect()}}}function vt(e){let t="idle",n=null,o=null,r=!1,i=!1,a=!1,s=6e4,c=null,l=null,p=()=>{c&&clearTimeout(c),c=null},m=0,v=null,g=u=>{v&&!(u in v)&&(v[u]=Math.round(performance.now()-m))},S=()=>{if(!v||!n)return;let u=O({type:"voice_timing",sessionId:e.sessionId,timings:v});v=null,n.publishData(new TextEncoder().encode(u)).catch(()=>{})},M=[],w=[],y=u=>{if(t!==u){t=u;for(let k of M)k(u)}},L=u=>{let k=u instanceof Error?u.message:String(u),x=u instanceof Error?u.name:"",T;/permissions? policy|feature policy/i.test(k)?T="mic_policy_blocked":x==="NotAllowedError"||/denied|permission/i.test(k)?T="mic_denied":x==="NotFoundError"||/no.*microphone|not.*found/i.test(k)?T="mic_unavailable":/connect|network|websocket|timeout|token/i.test(k)?T="connect_failed":T="unknown";for(let R of w)R({code:T,message:k})},H=async u=>{await u.setMicEnabled(!r);let k=new TextEncoder().encode(O({type:"start_voice",sessionId:e.sessionId}));await u.publishData(k)},h=()=>{p(),!a&&(c=setTimeout(()=>{a||!n||(n.disconnect().catch(()=>{}),n=null,o=null)},s))},d=()=>n?(h(),Promise.resolve(n)):o||(o=(async()=>{let u=await bt({wsUrl:e.wsUrl,token:e.token,roomName:e.roomName});return u.onData(k=>e.onTranscriptEvent(k)),u.onAgentSpeaking(k=>{k&&v&&(g("first_audio"),S()),!r&&(k&&(i=!0,l&&clearTimeout(l),l=null),i&&y(k?"speaking":"listening"))}),u.onReconnected(()=>{a&&(y("connecting"),i=!1,H(u).catch(k=>console.warn("[voiceModeLiveKit] re-start after reconnect failed",k)))}),n=u,h(),u})(),o.catch(()=>{o=null}),o);return{warm:()=>{d().catch(u=>console.warn("[voiceModeLiveKit] warm failed",u))},start:()=>{t==="idle"&&(y("connecting"),i=!1,p(),m=performance.now(),v={was_warm:n?1:0},(async()=>{try{let u=await d();p(),g("room_connected"),await H(u),g("mic_on"),globalThis.__smVoiceMicOnAt=Date.now(),a=!0,r&&y("muted")}catch(u){throw y("idle"),L(u),u}})().catch(u=>{console.warn("[voiceModeLiveKit] start failed",u)}))},stop:()=>{p(),l&&clearTimeout(l),l=null,v&&(g("hung_up"),S()),n?.disconnect().catch(()=>{}),n=null,o=null,a=!1,y("idle")},speak:async()=>{},setMuted:u=>{r=u,n?.setMicEnabled(!u).catch(()=>{}),n?.setAgentAudioMuted(u),u?y("muted"):t==="muted"&&y("listening")},getState:()=>t,onStateChange:u=>{M.push(u)},onError:u=>{w.push(u)},signalAgentReady:()=>{g("agent_ready"),t==="connecting"&&!l&&(l=setTimeout(()=>{l=null,i=!0,t==="connecting"&&y(r?"muted":"listening")},8e3))},publishData:async u=>{n&&await n.publishData(u)}}}function se(e){return e.stack==="web-speech"?te(ie(),ke()):e.stack==="live-kit"?e.livekit?vt(e.livekit):(console.warn("[voiceModeFactory] live-kit stack requires livekit opts; returning null \u2192 caller falls back to chat"),null):null}async function wt(e){if(e.platform!=="shopify")return;let t=e.fetchFn??fetch;try{await t("/cart/update.js",{method:"POST",credentials:"same-origin",headers:{"Content-Type":"application/json"},body:JSON.stringify({attributes:{sm_visitor_id:e.visitorId}})})}catch{}}var ze={"Content-Type":"application/json"};function kt(e){let t=Number(String(e).trim());return Number.isFinite(t)&&t>0?t:null}function Ue(e){try{let t={cart:e},n=["cart:refresh","cart:updated","cart:change","cart:build","cart:rerender","ajaxCart:afterCartLoad","cart.requestComplete","added.ajaxProduct"];for(let i of n)document.dispatchEvent(new CustomEvent(i,{bubbles:!0,detail:t})),window.dispatchEvent(new CustomEvent(i,{bubbles:!0,detail:t}));let o=window;typeof o.getCartUpdate=="function"&&o.getCartUpdate(),typeof o.after_add_to_cart=="function"&&o.after_add_to_cart(e);let r=o.jQuery;if(r)try{r(document.body).trigger("cart:updated",[e]),r(document.body).trigger("added.ajaxProduct")}catch{}}catch{}Eo()}var To=["cart-icon-bubble","cart-live-region-text","cart-notification-button","cart-drawer"];async function Eo(e=fetch){try{let t=To.filter(i=>document.getElementById(`shopify-section-${i}`)||document.getElementById(i));if(t.length===0)return 0;let n=await e(`${location.pathname}?sections=${t.join(",")}`,{credentials:"same-origin"});if(!n.ok)return 0;let o=await n.json(),r=0;for(let[i,a]of Object.entries(o)){if(!a)continue;let s=document.getElementById(`shopify-section-${i}`)??document.getElementById(i);if(!s)continue;let c=new DOMParser().parseFromString(a,"text/html"),l=c.getElementById(`shopify-section-${i}`)??c.querySelector(".shopify-section")??c.body;s.innerHTML=l.innerHTML,r+=1}return r}catch{return 0}}async function xt(e,t=fetch){let n=String(e??"").trim().replace(/^\/?products\//,"").replace(/[?#].*$/,"").replace(/\/$/,"");if(!n)return{ok:!1,reason:"not_found"};try{let o=await t(`/products/${encodeURIComponent(n)}.js`,{credentials:"same-origin"});if(!o.ok)return{ok:!1,reason:"not_found"};let r=await o.json(),i=(r.variants??[]).slice(0,30).map(a=>`${a.title??"Default"} (variantId ${a.id}, ${a.available?"in stock":"SOLD OUT"}${a.price!=null?`, ${(a.price/100).toFixed(2)}`:""})`).join("; ");return{ok:!0,channel:"shopify-ajax",values:{title:r.title??n,available:String(r.available??!1),variants:i}}}catch{return{ok:!1,reason:"not_found"}}}async function Fe(e){try{let t=await e("/cart.js",{credentials:"same-origin"});return t.ok?await t.json():null}catch{return null}}function je(e){let t=(e.items??[]).map(n=>`${n.product_title??"item"}${n.variant_title?` ${n.variant_title}`:""} x${n.quantity}`).join(", ");return{count:String(e.item_count??0),items:t,subtotal:e.total_price!=null?(e.total_price/100).toFixed(2):""}}async function _t(e,t,n=fetch){let o=kt(e);if(o==null)return{ok:!1,reason:"not_found"};try{if(!(await n("/cart/add.js",{method:"POST",credentials:"same-origin",headers:ze,body:JSON.stringify({id:o,quantity:t>0?t:1})})).ok)return{ok:!1,reason:"not_found"};let i=await Fe(n);return i&&i.items.some(a=>a.id===o)?(Ue(i),{ok:!0,values:je(i)}):{ok:!1,reason:"not_found"}}catch{return{ok:!1,reason:"not_found"}}}async function St(e=fetch){let t=await Fe(e);return t?{ok:!0,values:je(t)}:{ok:!1,reason:"not_found"}}async function Ct(e,t,n=fetch){let o=kt(e);if(o==null)return{ok:!1,reason:"not_found"};try{let r=await n("/cart/change.js",{method:"POST",credentials:"same-origin",headers:ze,body:JSON.stringify({id:o,quantity:Math.max(0,t)})});if(!r.ok)return{ok:!1,reason:"not_found"};let i=await r.json().catch(()=>null);return Ue(i),i?{ok:!0,values:je(i)}:{ok:!0}}catch{return{ok:!1,reason:"not_found"}}}async function Tt(e=fetch){try{return(await e("/cart/clear.js",{method:"POST",credentials:"same-origin",headers:ze})).ok?(Ue(await Fe(e)),{ok:!0}):{ok:!1,reason:"not_found"}}catch{return{ok:!1,reason:"not_found"}}}async function Et(e,t=fetch){let n=String(e??"").trim();if(!n)return{ok:!1,reason:"not_found"};try{return await t(`/discount/${encodeURIComponent(n)}`,{method:"GET",credentials:"same-origin",redirect:"manual"})?{ok:!0}:{ok:!1,reason:"not_found"}}catch{return{ok:!1,reason:"not_found"}}}var At="/wp-json/wc/store/v1",ae=null;function Ao(){let e={"Content-Type":"application/json"};return ae&&(e.Nonce=ae,e["X-WC-Store-API-Nonce"]=ae),e}function Mt(e){let t=e.headers.get("Nonce")??e.headers.get("X-WC-Store-API-Nonce");t&&(ae=t)}async function F(e){try{let t=await e(`${At}/cart`,{credentials:"same-origin"});return Mt(t),t.ok?await t.json():null}catch{return null}}function Se(e){let t=e.totals?.currency_minor_unit??2,n=e.totals?.total_price;return{count:String(e.items_count??0),items:(e.items??[]).map(o=>`${o.name??"item"} x${o.quantity}`).join(", "),subtotal:n!=null?(Number(n)/10**t).toFixed(t):""}}function Be(){try{document.body.dispatchEvent(new CustomEvent("wc-blocks_added_to_cart",{bubbles:!0}));let e=window.jQuery;e?.(document.body).trigger("wc_fragment_refresh")}catch{}}function Lt(e){let t=Number(String(e).trim());return Number.isFinite(t)&&t>0?t:null}async function _e(e,t,n){ae||await F(n);let o=await n(`${At}${e}`,{method:"POST",credentials:"same-origin",headers:Ao(),body:JSON.stringify(t)});return Mt(o),o}async function It(e,t,n=fetch){let o=Lt(e);if(o==null)return{ok:!1,reason:"not_found"};try{let r=(await F(n))?.items.find(c=>c.id===o)?.quantity??0;if(!(await _e("/cart/add-item",{id:o,quantity:t>0?t:1},n)).ok)return{ok:!1,reason:"not_found"};let a=await F(n),s=a?.items.find(c=>c.id===o)?.quantity??0;return!a||s<=r?{ok:!1,reason:"not_found"}:(Be(),{ok:!0,channel:"woo-store-api",verified:!0,values:Se(a)})}catch{return{ok:!1,reason:"not_found"}}}async function Rt(e=fetch){let t=await F(e);return t?{ok:!0,channel:"woo-store-api",values:Se(t)}:{ok:!1,reason:"not_found"}}async function Ht(e,t,n=fetch){let o=Lt(e);if(o==null)return{ok:!1,reason:"not_found"};try{let r=(await F(n))?.items.find(c=>c.id===o);if(!r)return{ok:!1,reason:"not_found"};if(!(t<=0?await _e("/cart/remove-item",{key:r.key},n):await _e("/cart/update-item",{key:r.key,quantity:t},n)).ok)return{ok:!1,reason:"not_found"};let a=await F(n),s=a?.items.find(c=>c.id===o)?.quantity??0;return!a||s!==Math.max(0,t)?{ok:!1,reason:"not_found"}:(Be(),{ok:!0,channel:"woo-store-api",verified:!0,values:Se(a)})}catch{return{ok:!1,reason:"not_found"}}}async function Pt(e=fetch){try{let t=await F(e);for(let o of t?.items??[])await _e("/cart/remove-item",{key:o.key},e);let n=await F(e);return!n||n.items.length>0?{ok:!1,reason:"not_found"}:(Be(),{ok:!0,channel:"woo-store-api",verified:!0,values:Se(n)})}catch{return{ok:!1,reason:"not_found"}}}var Mo="data-shoppingmate-bot-cursor",Nt="data-shoppingmate-cursor-keyframes",ce=null,qe=window.innerWidth-80,Ke=window.innerHeight-80;function $t(){if(ce&&ce.isConnected)return ce;Lo();let e=document.createElement("div");return e.setAttribute(Mo,""),e.innerHTML=`
    <svg width="22" height="22" viewBox="0 0 22 22" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path d="M3 2 L3 17 L7 13 L9.5 19 L12 18 L9.5 12 L15 12 Z"
            fill="#111827" stroke="#fff" stroke-width="1.2" stroke-linejoin="round"/>
    </svg>
  `,Object.assign(e.style,{position:"fixed",left:"0",top:"0",transform:`translate(${qe}px, ${Ke}px)`,transition:"transform 480ms cubic-bezier(0.22, 1, 0.36, 1), opacity 200ms",pointerEvents:"none",zIndex:"2147483647",opacity:"0",willChange:"transform, opacity",filter:"drop-shadow(0 2px 6px rgba(0,0,0,0.25))"}),document.body.appendChild(e),ce=e,e}function Lo(){if(document.head.querySelector(`style[${Nt}]`))return;let e=document.createElement("style");e.setAttribute(Nt,""),e.textContent=`
    @keyframes shoppingmate-cursor-click {
      0%   { transform: var(--sm-cursor-pos) scale(1); }
      40%  { transform: var(--sm-cursor-pos) scale(0.72); }
      100% { transform: var(--sm-cursor-pos) scale(1); }
    }
  `,document.head.appendChild(e)}function Io(e){let t=e.getBoundingClientRect();return{x:t.left+t.width/2-6,y:t.top+t.height/2-6}}function Q(e,t=480){let n=$t(),{x:o,y:r}=Io(e);return n.style.transitionDuration=`${t}ms, 200ms`,n.style.opacity="1",n.style.transform=`translate(${o}px, ${r}px)`,qe=o,Ke=r,new Promise(i=>setTimeout(i,t))}function le(){let e=$t();return e.style.setProperty("--sm-cursor-pos",`translate(${qe}px, ${Ke}px)`),e.style.animation="shoppingmate-cursor-click 280ms ease-out",new Promise(t=>{let n=()=>{e.style.animation="",e.removeEventListener("animationend",n),t()};e.addEventListener("animationend",n),setTimeout(n,360)})}function j(e=600){let t=ce;t&&setTimeout(()=>{t.style.opacity="0"},e)}function Ro(e,t){let n=e instanceof HTMLTextAreaElement?HTMLTextAreaElement.prototype:e instanceof HTMLSelectElement?HTMLSelectElement.prototype:HTMLInputElement.prototype,o=Object.getOwnPropertyDescriptor(n,"value");o?.set?o.set.call(e,t):e.value=t,e.dispatchEvent(new Event("input",{bubbles:!0})),e.dispatchEvent(new Event("change",{bubbles:!0}))}function Ge(e){return e.value??""}var Ot="sm_selector_cache_v1";function Ho(){try{return JSON.parse(localStorage.getItem(Ot)??"{}")}catch{return{}}}function Po(e){try{localStorage.setItem(Ot,JSON.stringify(e))}catch{}}function No(e){return`${location.pathname}::${e}`}function $o(e){let t=e.getAttribute("data-sm-field");if(t)return`[data-sm-field="${CSS.escape(t)}"]`;if(e.id)return`#${CSS.escape(e.id)}`;let n=e.getAttribute("name");return n?`[name="${CSS.escape(n)}"]`:null}function Oo(e,t){let n=Ho(),o=No(e),r=n[o];if(r)try{let a=document.querySelector(r);if(a?.isConnected)return a}catch{}let i=null;try{i=document.querySelector(`[data-sm-field="${CSS.escape(e)}"]`)}catch{i=null}if(i||(i=$e(e,t)),i){let a=$o(i);a&&(n[o]=a,Po(n))}return i}function Dt(e,t){let n={},o=[],r=!1;for(let{field:i,value:a,ref:s}of e){let c=s?we(s):null,l=c&&/^(INPUT|TEXTAREA|SELECT)$/.test(c.tagName)?c:Oo(i,t);if(!l){o.push({field:i,ok:!1,value:""});continue}r=!0,Ro(l,a);let p=Ge(l);n[i]=p,o.push({field:i,ok:p===a,value:p})}return r?{ok:!0,values:n,filled:o}:{ok:!1,reason:"not_found"}}function Vt(e,t){let n={};if(e&&e.length>0){for(let r of e){let i=$e(r,t);i&&(n[r]=Ge(i))}return{ok:!0,values:n}}let o=document.querySelectorAll("input, textarea, select");for(let r of o){let i=(r.getAttribute("type")??"").toLowerCase();if(i==="password"||i==="hidden")continue;let a=r.getAttribute("name")??r.id;a&&(n[a]=Ge(r))}return{ok:!0,values:n}}var Do="data-shoppingmate-pulse-ring";function zt(e,t){let n=e.getBoundingClientRect(),o=document.createElement("div");o.setAttribute(Do,""),Object.assign(o.style,{position:"fixed",left:`${n.left-6}px`,top:`${n.top-6}px`,width:`${n.width+12}px`,height:`${n.height+12}px`,borderRadius:"14px",boxShadow:"0 0 0 3px rgba(139,92,246,0.85), 0 0 24px rgba(139,92,246,0.55)",pointerEvents:"none",zIndex:"2147483646",animation:"shoppingmate-pulse 1.2s ease-in-out infinite"}),Vo(),document.body.appendChild(o);let r=!1,i=()=>{r||(r=!0,o.remove())};return setTimeout(i,t),i}var Wt=!1;function Vo(){if(Wt)return;Wt=!0;let e=document.createElement("style");e.textContent=`@keyframes shoppingmate-pulse {
    0%, 100% { transform: scale(1); opacity: 1; }
    50% { transform: scale(1.04); opacity: 0.85; }
  }`,document.head.appendChild(e)}var ue=null,Ce=null,Ye=new Set;function Ut(e){ue=e,Ce=null,Ye.clear()}function Te(e=fetch){if(!ue)return Promise.resolve([]);if(!Ce){let{apiBase:t,merchantId:n}=ue;Ce=e(`${t}/v1/site-templates/${encodeURIComponent(n)}`).then(o=>o.ok?o.json():{templates:[]}).then(o=>Array.isArray(o.templates)?o.templates:[]).catch(()=>[])}return Ce}function Je(e,t,n,o=fetch){if(!ue)return;let r=`${e}:${t}`;if(Ye.has(r))return;Ye.add(r);let{apiBase:i,merchantId:a,sessionId:s}=ue;o(`${i}/v1/site-templates/${encodeURIComponent(a)}/signal`,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({kind:e,templateId:t,coverage:n,sessionId:s,path:location.pathname}),keepalive:!0}).catch(()=>{})}var Wo=["[data-cart-count]","#cart-icon-bubble",".cart-count",".cart-count-bubble",'[class*="cart-count"]','[class*="CartCount"]'].join(",");function Ft(){return(document.querySelector(Wo)?.textContent??"").replace(/\s+/g," ").trim()}function jt(){return Array.from(document.querySelectorAll('dialog[open],[role="dialog"],[aria-modal="true"]')).filter(e=>!V(e)&&e.getAttribute("aria-hidden")!=="true").length}function Bt(e){let t=e;return[e.getAttribute("aria-expanded"),e.getAttribute("aria-checked"),e.getAttribute("aria-selected"),e.getAttribute("aria-pressed"),typeof t.checked=="boolean"?String(t.checked):"",e.className].join("|")}async function Xe(e,t,n=1500){let o=location.href,r=Ft(),i=jt(),a=e?Bt(e):"",s=0,c=new MutationObserver(p=>{for(let m of p)V(m.target)||m.type==="attributes"&&m.attributeName==="data-sm-ref"||(s+=1)});c.observe(document.body,{subtree:!0,childList:!0,attributes:!0,characterData:!0});let l=()=>{if(location.href!==o)return{verified:!0,observed:`navigated to ${location.pathname}`};let p=Ft();if(p!==r)return{verified:!0,observed:`cart count ${r||"0"} \u2192 ${p||"0"}`};let m=jt();return m>i?{verified:!0,observed:"a dialog/drawer opened"}:m<i?{verified:!0,observed:"a dialog/drawer closed"}:e?.isConnected&&Bt(e)!==a?{verified:!0,observed:"the control changed state"}:s>0?{verified:!0,observed:"the page updated"}:null};try{await t();let p=Date.now()+n;await new Promise(v=>setTimeout(v,50));let m=l();for(;!m&&Date.now()<p;)await new Promise(v=>setTimeout(v,100)),m=l();return m??{verified:!1,observed:"nothing changed on the page"}}finally{c.disconnect()}}var Ae=null;function qt(e){Ae=e??null}function Ee(){if(Ae==="shopify")return!0;if(Ae)return!1;try{return typeof window.Shopify<"u"}catch{return!1}}function de(){return Ee()?"shopify-ajax":Ae==="woocommerce"?"woo-store-api":"storefront-hooks"}async function B(e,t){let n=await t;return n.ok?{channel:e,...n}:n}async function Kt(e){switch(e.type){case"navigate":return Qe(e.path);case"scroll_to":return er(e.intent);case"highlight":return tr(e.intent,e.durationMs??2e3);case"click":return e.ref?Uo(e.ref,e.intent):nr(e.intent);case"point_at":return or(e.intent);case"demo_click":return rr(e.intent);case"cart_add":{let t=de();return t==="shopify-ajax"?B(t,_t(e.sku,e.qty)):t==="woo-store-api"?It(e.sku,e.qty):B(t,qo(e.sku,e.qty))}case"open_cart":return de()==="woo-store-api"||Ee()?Qe("/cart"):Ko();case"cart_set_qty":{let t=de();return t==="shopify-ajax"?B(t,Ct(e.sku,e.qty)):t==="woo-store-api"?Ht(e.sku,e.qty):B(t,Jo(e.sku,e.qty))}case"cart_clear":{let t=de();return t==="shopify-ajax"?B(t,Tt()):t==="woo-store-api"?Pt():B(t,Yo())}case"cart_get":{let t=de();return t==="shopify-ajax"?B(t,St()):t==="woo-store-api"?Rt():B(t,Go())}case"product_lookup":return Ee()?xt(e.handle):{ok:!1,reason:"not_found"};case"apply_coupon":return Ee()?Et(e.code):Xo(e.code);case"checkout_fill":return jo(e.details);case"checkout_place":return Bo();case"checkout_state":return Fo();case"form_fill":return Dt(e.fields);case"form_read":return Vt(e.fields);case"page_snapshot":return zo()}}var Me=null;async function zo(){let e=performance.now(),t=ee(),n={};Me=null;let o=await Te();if(o.length>0){let r=ut(ye(t.text),location.pathname,o);if(r.template){Me=r.template.id;let i=r.template.recipes.slice(0,6).map(a=>`${a.action.replace(/_/g," ")} = ${a.role} "${a.name}"`).join("; ");t=ee({collapse:new Set(r.template.skeleton),preface:[`[template] ${r.template.pageType} page (known layout, ${Math.round(r.coverage*100)}% match)${i?` \xB7 how this page works: ${i}`:""}`]}),n.template=r.template.pageType,n.coverage=r.coverage.toFixed(2)}else r.drift&&(Je("drift",r.drift.template.id,r.drift.coverage),n.drift=`${r.drift.template.pageType}:${r.drift.coverage.toFixed(2)}`)}return{ok:!0,values:{snapshot:t.text,refs:String(t.refs),chars:String(t.chars),buildMs:String(Math.round(performance.now()-e)),...n}}}function Gt(e){!e&&Me&&Je("verify",Me,0)}function Yt(e){let t=e.closest("a[href]");if(!t||t.target==="_blank")return null;try{let n=new URL(t.href,window.location.href);return n.origin!==window.location.origin||n.pathname===window.location.pathname&&n.search===window.location.search?null:n.pathname}catch{return null}}async function Uo(e,t){let n=we(e)??(t?Y(t):null);if(!n)return{ok:!1,reason:"stale_target"};if(await Ze(n),await Q(n,420),await le(),!n.isConnected)return{ok:!1,reason:"stale_target"};let o=Yt(n);if(o)return n.click(),j(800),{ok:!0,verified:!0,observed:`navigating to ${o}`};let r=await Xe(n,()=>n.click());return j(800),Gt(r.verified),{ok:!0,verified:r.verified,observed:r.observed}}async function Fo(){let e=window.__shoppingmateCheckoutState__;if(typeof e!="function")return{ok:!1,reason:"not_found"};try{return await e()?{ok:!0}:{ok:!1,reason:"not_found"}}catch{return{ok:!1,reason:"not_found"}}}async function jo(e){let t=window.__shoppingmateCheckoutFill__;if(typeof t!="function")return{ok:!1,reason:"not_found"};try{return await t(e)?{ok:!0}:{ok:!1,reason:"not_found"}}catch{return{ok:!1,reason:"not_found"}}}async function Bo(){let e=window.__shoppingmatePlaceOrder__;if(typeof e!="function")return{ok:!1,reason:"not_found"};try{return await e()?{ok:!0}:{ok:!1,reason:"not_found"}}catch{return{ok:!1,reason:"not_found"}}}function qo(e,t){let n=window.__shoppingmateCartAdd__;if(typeof n!="function")return{ok:!1,reason:"not_found"};try{return n(e,t)?{ok:!0}:{ok:!1,reason:"not_found"}}catch{return{ok:!1,reason:"not_found"}}}function Ko(){let e=window.__shoppingmateOpenCart__;if(typeof e!="function")return{ok:!1,reason:"not_found"};try{return e(),{ok:!0}}catch{return{ok:!1,reason:"not_found"}}}function Go(){let e=window.__shoppingmateGetCart__;if(typeof e!="function")return{ok:!1,reason:"not_found"};try{let t=e(),n=(t?.items??[]).map(o=>`${o.sku??o.name??"item"} x${o.quantity??1}`).join(", ");return{ok:!0,values:{count:String(t?.count??0),items:n,subtotal:t?.subtotal!=null?String(t.subtotal):""}}}catch{return{ok:!1,reason:"not_found"}}}function Yo(){let e=window.__shoppingmateClearCart__;if(typeof e!="function")return{ok:!1,reason:"not_found"};try{return e()?{ok:!0}:{ok:!1,reason:"not_found"}}catch{return{ok:!1,reason:"not_found"}}}function Jo(e,t){let n=window.__shoppingmateCartSetQty__;if(typeof n!="function")return{ok:!1,reason:"not_found"};try{return n(e,t)?{ok:!0}:{ok:!1,reason:"not_found"}}catch{return{ok:!1,reason:"not_found"}}}async function Xo(e){let t=window.__shoppingmateApplyCoupon__;if(typeof t!="function")return{ok:!1,reason:"not_found"};try{return await t(e)?{ok:!0}:{ok:!1,reason:"not_found"}}catch{return{ok:!1,reason:"not_found"}}}function Qo(e){let t=window.__shoppingmateNavigate__;if(typeof t=="function")try{return t(e),!0}catch{return!1}return!1}async function Qe(e){try{let t=new URL(e,window.location.href);if(t.origin!==window.location.origin)return{ok:!1,reason:"cross_origin"};let n=Zo(t.pathname);n&&(await Q(n,520),await le());let o=t.pathname+t.search+t.hash;return Qo(o)||window.location.assign(o),j(800),{ok:!0}}catch{return{ok:!1,reason:"route_not_found"}}}function Zo(e){let t=document.querySelectorAll("a[href]");for(let n of t)try{if(new URL(n.href,window.location.href).pathname===e)return n}catch{}return null}async function er(e){let t=Y(e);return t?(await Q(t,480),t.scrollIntoView({behavior:"smooth",block:"center"}),j(800),{ok:!0}):{ok:!1,reason:"not_found"}}function tr(e,t){let n=Y(e);return n?(zt(n,t),{ok:!0}):{ok:!1,reason:"not_found"}}async function nr(e){let t=Y(e);if(!t)return{ok:!1,reason:"not_found"};if(!t.isConnected)return{ok:!1,reason:"stale_target"};if(await Q(t,420),await le(),!t.isConnected)return{ok:!1,reason:"stale_target"};let n=Yt(t);if(n)return t.click(),j(800),{ok:!0,verified:!0,observed:`navigating to ${n}`};let o=await Xe(t,()=>t.click());return j(800),Gt(o.verified),{ok:!0,verified:o.verified,observed:o.observed}}async function Ze(e){let t=e.getBoundingClientRect(),n=window.innerHeight;(t.bottom<80||t.top>n-80)&&(e.scrollIntoView({behavior:"smooth",block:"center"}),await new Promise(r=>setTimeout(r,350)))}async function or(e){let t=Y(e);return t?t.isConnected?(await Ze(t),await Q(t,480),{ok:!0}):{ok:!1,reason:"stale_target"}:{ok:!1,reason:"not_found"}}async function rr(e){let t=Y(e);return t?t.isConnected?(await Ze(t),await Q(t,420),await le(),await new Promise(n=>setTimeout(n,120)),t.isConnected?(t.click(),j(800),{ok:!0}):{ok:!1,reason:"stale_target"}):{ok:!1,reason:"stale_target"}:{ok:!1,reason:"not_found"}}var Le="sm_visitor_id";function ir(){let e=new Uint8Array(8);return(globalThis.crypto??window.crypto).getRandomValues(e),`v_${Array.from(e,n=>n.toString(16).padStart(2,"0")).join("")}`}function sr(){try{let t=localStorage.getItem(Le);if(t){let n=JSON.parse(t);if(n?.id&&typeof n.expiresAt=="number")return n}}catch{}let e=document.cookie.match(new RegExp(`(?:^|; )${Le}=([^;]+)`));return e?{id:decodeURIComponent(e[1]??""),expiresAt:Date.now()+1}:null}function Jt(e){try{localStorage.setItem(Le,JSON.stringify(e));let t=Math.floor(6048e5/1e3);document.cookie=`${Le}=${e.id}; max-age=${t}; path=/; SameSite=Lax; Secure`}catch{}}function pe(){let e=Date.now(),t=sr();if(t&&t.expiresAt>e)return Jt({id:t.id,expiresAt:e+6048e5}),t.id;let n=ir();return Jt({id:n,expiresAt:e+6048e5}),n}var me=[200,500],Xt=e=>new Promise(t=>setTimeout(t,e));async function et(e,t){let n;for(let o=0;o<=me.length;o++)try{let r=await fetch(e,t);if(r.status>=500&&o<me.length){await Xt(me[o]??0);continue}return r}catch(r){if(n=r,o<me.length){await Xt(me[o]??0);continue}throw r}throw n}async function Qt(e){try{let t=pe(),n=await et(`${e.apiBase}/v1/install`,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({merchantId:e.merchantId,domain:e.domain,userAgent:navigator.userAgent,referrer:document.referrer||null})});if(!n.ok)return{kind:"err",reason:`install_${n.status}`};let o=await n.json();qt(o.platform??null),wt({visitorId:t,platform:o.platform??"custom"});let r=await et(`${e.apiBase}/v1/session`,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({merchantId:e.merchantId,domain:e.domain})});if(!r.ok)return{kind:"err",reason:`session_${r.status}`};let i=await r.json(),a=null;try{let s=await et(`${e.apiBase}/v1/voice/token`,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({sessionId:i.sessionId,merchantId:e.merchantId,visitorId:t})});s.ok?a=await s.json():console.warn("[shoppingmate] voice unavailable \u2014 status",s.status)}catch(s){console.warn("[shoppingmate] voice unavailable \u2014",s)}return{kind:"ok",sessionId:i.sessionId,wsUrl:i.wsUrl,merchantStatus:o.status,personaId:o.personaId??a?.personaId??null,widgetPosition:o.widgetPosition??null,widgetSize:o.widgetSize??null,widgetAccent:o.widgetAccent??null,widgetLabel:o.widgetLabel??null,widgetGreeting:o.widgetGreeting??null,voice:a,visitorId:t,insights:o.insights??null}}catch(t){return{kind:"err",reason:t instanceof Error?t.message:"network"}}}var en=24e3,Zt=48e3,Ie=640,ar=6e4,cr=8e3,Re="https://cdn.jsdelivr.net/npm/@sapphi-red/web-noise-suppressor@0.4.1",lr=`
class SmCap extends AudioWorkletProcessor {
  // Decimate to 16 kHz, then a speech gate (like Krisp gives LiveKit): only
  // speech passes, everything else becomes true silence so Gemini sees clean
  // pauses and ends the turn. 10 ms frames, adaptive noise floor, 100 ms
  // look-back so the first syllable isn't clipped, 200 ms hold (Gemini's own
  // end-of-turn tolerates longer pauses between words; a longer hold only
  // delayed every reply by passing leftover noise).
  constructor(){super();this.r=sampleRate/16000;this.acc=0;this.n=0;this.pos=0;
    this.f=new Float32Array(160);this.fi=0;this.hist=[];this.floor=0.01;this.run=0;this.hold=0;this.open=false;this.duck=false;
    // Echo guard: while Olivia is speaking, require louder input to open the gate.
    this.port.onmessage=(e)=>{if(e.data&&typeof e.data.duck==='boolean')this.duck=e.data.duck;};}
  frame(fr){let s=0;for(let i=0;i<160;i++)s+=fr[i]*fr[i];const rms=Math.sqrt(s/160);
    if(rms<this.floor)this.floor=this.floor*0.9+rms*0.1;else this.floor=this.floor*0.9995+rms*0.0005;
    const thr=Math.max(0.012,this.floor*3.5)*(this.duck?3:1);const speech=rms>thr;
    this.run=speech?this.run+1:0;
    if(!this.open&&this.run>=2){this.open=true;
      const out=new Float32Array(160*(this.hist.length+1));let o=0;for(const h of this.hist){out.set(h,o);o+=160;}out.set(fr,o);
      this.hist=[];this.hold=20;this.port.postMessage(out);return;}
    if(this.open){if(speech)this.hold=20;else if(--this.hold<=0)this.open=false;}
    if(this.open){this.port.postMessage(fr);}
    else{this.hist.push(fr);if(this.hist.length>10)this.hist.shift();this.port.postMessage(new Float32Array(160));}}
  process(inputs){const ch=inputs[0]&&inputs[0][0];if(!ch)return true;
    for(let i=0;i<ch.length;i++){this.acc+=ch[i];this.n++;this.pos+=1;
      if(this.pos>=this.r){this.f[this.fi++]=this.acc/this.n;this.acc=0;this.n=0;this.pos-=this.r;
        if(this.fi===160){this.frame(this.f.slice());this.fi=0;}}}
    return true;}}registerProcessor('sm-cap',SmCap);
class SmPlay extends AudioWorkletProcessor {
  constructor(o){super();const p=o.processorOptions||{};this.inRate=p.inRate||${en};
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
registerProcessor('sm-play',SmPlay);`;function tn(e){let t="idle",n=!1,o=!1,r=null,i=null,a=null,s=null,c=null,l=null,p=null,m=null,v=null,g=[],S=null,M=[],w=!1,y={stutters:0,micFrames:0,micPeak:0,noiseSuppression:!1,prebufferMs:150,playStarts:0,playing:!1};globalThis.__smVoiceStats=y;let L=[],H=[],h=0,d=null,u=f=>{d&&!(f in d)&&(d[f]=Math.round(performance.now()-h))},k=()=>{d&&(R(O({type:"voice_timing",sessionId:e.sessionId,timings:{...d,transport_ws:1,ns:y.noiseSuppression?1:0}})),d=null)},x=f=>{if(t!==f){t=f;for(let E of L)E(f)}},T=(f,E)=>{for(let _ of H)_({code:f,message:E})},R=f=>{r?.readyState===WebSocket.OPEN&&r.send(f)},D=()=>{a&&clearTimeout(a),a=null},$=()=>{D(),!o&&(a=setTimeout(()=>{o||ne()},ar))},ne=()=>{D();let f=r;r=null,i=null;try{f?.close(1e3)}catch{}},z=()=>{s&&clearTimeout(s),s=null,t==="connecting"&&x(n?"muted":w?"speaking":"listening")},U=()=>{if(c)return c;let f=window.AudioContext??window.webkitAudioContext;try{c=new f({sampleRate:Zt,latencyHint:"interactive"})}catch{c=new f}return l=c.createGain(),l.connect(c.destination),c},K=()=>m||(m=(async()=>{let f=U(),E=URL.createObjectURL(new Blob([lr],{type:"application/javascript"}));await f.audioWorklet.addModule(E),URL.revokeObjectURL(E),p=new AudioWorkletNode(f,"sm-play",{numberOfInputs:0,outputChannelCount:[1],processorOptions:{inRate:en,prebufferMs:y.prebufferMs}}),p.connect(l),p.port.onmessage=A=>{let I=A.data;I.t==="playing"?(w=!0,y.playing=!0,S?.port.postMessage({duck:!0}),y.playStarts++,y.stutters=I.stutters??y.stutters,y.prebufferMs=I.preMs??y.prebufferMs,d&&!("first_audio"in d)&&(u("first_audio"),k()),t==="connecting"?z():n||x("speaking")):I.t==="drained"&&(w=!1,y.playing=!1,S?.port.postMessage({duck:!1}),t==="speaking"&&x("listening"))};let _=null;try{let A=await import(`${Re}/+esm`),[I]=await Promise.all([A.loadRnnoise({url:`${Re}/dist/rnnoise.wasm`,simdUrl:`${Re}/dist/rnnoise_simd.wasm`}),f.audioWorklet.addModule(`${Re}/dist/rnnoise/workletProcessor.js`)]);f.sampleRate===Zt&&(_=new A.RnnoiseWorkletNode(f,{maxChannels:1,wasmBinary:I}),y.noiseSuppression=!0)}catch(A){console.warn("[voiceModeWs] noise suppression unavailable",A)}return{ns:_}})(),m.catch(()=>{m=null}),m),Ne=f=>{if(!(n||!r||r.readyState!==WebSocket.OPEN)){for(let E=0;E<f.length;E++){let _=f[E];M.push(_),Math.abs(_)>y.micPeak&&(y.micPeak=Math.abs(_))}for(;M.length>=Ie;){let E=M.splice(0,Ie),_=new Int16Array(Ie);for(let A=0;A<Ie;A++){let I=Math.max(-1,Math.min(1,E[A]));_[A]=I<0?I*32768:I*32767}r.send(_.buffer),y.micFrames++}}},he=async()=>{let f=U(),[E,{ns:_}]=await Promise.all([navigator.mediaDevices.getUserMedia({audio:{echoCancellation:!0,noiseSuppression:!0,autoGainControl:!0,channelCount:1}}),K()]);v=E;let A=f.createMediaStreamSource(E),I=new AudioWorkletNode(f,"sm-cap");S=I,I.port.onmessage=qn=>Ne(qn.data),_?(A.connect(_),_.connect(I)):A.connect(I),g=[A,..._?[_]:[],I]},P=()=>{for(let f of g)try{f.disconnect()}catch{}g=[];for(let f of v?.getTracks()??[])f.stop();v=null,M=[]},N=()=>{p?.port.postMessage("clear"),w=!1,t==="speaking"&&x(n?"muted":"listening")},ge=f=>{if(!p)return;let E=new Int16Array(f),_=new Float32Array(E.length);for(let A=0;A<E.length;A++)_[A]=E[A]/32768;p.port.postMessage(_,[_.buffer])},lt=()=>r&&r.readyState===WebSocket.OPEN?($(),Promise.resolve(r)):i||(i=new Promise((f,E)=>{let _=new WebSocket(e.url);_.binaryType="arraybuffer",_.onopen=()=>{r=_,$(),f(_)},_.onerror=()=>E(new Error("voice websocket connect failed")),_.onmessage=A=>{if(A.data instanceof ArrayBuffer){ge(A.data);return}let I=String(A.data);if(I.includes('"audio_clear"')){N();return}e.onAgentEvent(new TextEncoder().encode(I))},_.onclose=()=>{_.readyState!==WebSocket.OPEN&&r!==_&&E(new Error("voice websocket connect failed")),r===_&&(r=null),i=null,o&&(o=!1,P(),N(),x("idle"),T("connect_failed","voice connection closed"))}}),i.catch(()=>{i=null}),i),Bn=f=>{let E=f instanceof Error?f.message:String(f),_=f instanceof Error?f.name:"";return/permissions? policy|feature policy/i.test(E)?"mic_policy_blocked":_==="NotAllowedError"||/denied|permission/i.test(E)?"mic_denied":_==="NotFoundError"||/no.*microphone|not.*found/i.test(E)?"mic_unavailable":/connect|network|websocket|timeout/i.test(E)?"connect_failed":"unknown"};return{warm:()=>{lt().catch(f=>console.warn("[voiceModeWs] warm failed",f)),K().catch(f=>console.warn("[voiceModeWs] audio setup failed",f))},start:()=>{t==="idle"&&(x("connecting"),D(),h=performance.now(),d={was_warm:r?.readyState===WebSocket.OPEN?1:0},U().resume(),(async()=>{try{await lt(),u("room_connected"),await he(),u("mic_on"),globalThis.__smVoiceMicOnAt=Date.now(),o=!0,R(O({type:"start_voice",sessionId:e.sessionId})),n&&x("muted")}catch(f){P(),x("idle"),T(Bn(f),f instanceof Error?f.message:String(f))}})())},stop:()=>{d&&(u("hung_up"),k()),s&&clearTimeout(s),s=null,o=!1,P(),N(),ne(),x("idle")},speak:async()=>{},setMuted:f=>{n=f,l&&(l.gain.value=f?0:1),f?x("muted"):t==="muted"&&x(w?"speaking":"listening")},getState:()=>t,onStateChange:f=>{L.push(f)},onError:f=>{H.push(f)},signalAgentReady:()=>{u("agent_ready"),t==="connecting"&&!s&&(s=setTimeout(z,cr))},publishData:async f=>{R(new TextDecoder().decode(f))}}}function nn(e,t,n={}){let o=e,r=null,i=!1,a=!1,s=null,c=[],l=[],p=n.noAudioMs??7e3,m=()=>{s&&clearTimeout(s),s=null},v=g=>{if(i)return;let S=t();if(S){i=!0,m(),r=S,n.onSwitch?.(g);try{e.stop()}catch{}S.onStateChange(M=>c.forEach(w=>w(M))),S.onError?.(M=>l.forEach(w=>w(M))),o=S,S.start()}};return e.onStateChange(g=>{o===e&&(g==="speaking"&&(a=!0,m()),c.forEach(S=>S(g)))}),e.onError?.(g=>{if(o===e){if(!a&&g.code==="connect_failed"&&!i){v(g.code);return}l.forEach(S=>S(g))}}),{warm:()=>o.warm?.(),start:()=>{a=!1,o.start(),o===e&&!i&&(m(),s=setTimeout(()=>{!a&&o===e&&e.getState()==="connecting"&&v("no_audio")},p))},stop:()=>{m(),o.stop()},speak:g=>o.speak(g),setMuted:g=>o.setMuted(g),getState:()=>o.getState(),onStateChange:g=>{c.push(g)},onError:g=>{l.push(g)},signalAgentReady:()=>o.signalAgentReady?.(),publishData:async g=>{await o.publishData?.(g)}}}function on(e){let t=0,n=a=>{let s=Date.now();s-t<200||(t=s,e.send(a))},o=a=>{let s=a.target;if(!s)return;let c=ur(s),l=c?dr(c,e.hints):null;n({type:"visitor_action",sessionId:e.sessionId,action:"click",intentKey:l,url:window.location.href,elementLabel:c,timestamp:Date.now()})},r=()=>{n({type:"visitor_action",sessionId:e.sessionId,action:"route_change",intentKey:null,url:window.location.href,elementLabel:null,timestamp:Date.now()})},i=a=>{let s=a.target;if(!s)return;let c=s.tagName?.toLowerCase();c!=="input"&&c!=="textarea"&&c!=="select"||s.type==="password"||n({type:"visitor_action",sessionId:e.sessionId,action:"form_focus",intentKey:null,url:window.location.href,elementLabel:s.name||s.id||null,timestamp:Date.now()})};return document.addEventListener("click",o,{passive:!0,capture:!0}),window.addEventListener("popstate",r),document.addEventListener("focusin",i,{passive:!0}),()=>{document.removeEventListener("click",o,!0),window.removeEventListener("popstate",r),document.removeEventListener("focusin",i)}}function ur(e){return e.getAttribute("aria-label")??e.getAttribute("title")??(e.textContent??"").trim().slice(0,80)??null}function dr(e,t){let n=e.toLowerCase();if(t.has(n))return n;for(let o of t.keys())if(n.includes(o)||o.includes(n))return o;return null}function an(e){return e.replace(/[-_]+/g," ").trim().replace(/\b\w/g,t=>t.toUpperCase())}function rn(e){let t=String(e??"").trim();return!t||/^\d+$/.test(t)?null:an(t)}function sn(e){let t=(e||"/").split(/[?#]/)[0]??"/";if(t==="/"||t==="")return"the home page";if(/^\/checkout/.test(t))return"checkout";if(/^\/cart\/?$/.test(t))return"your cart";let n=t.replace(/\/+$/,"").split("/").pop()??"";return n?`the ${an(n)} page`:"that page"}function cn(e,t){switch(e.type){case"cart_add":{let n=rn(e.sku),o=n?`${e.qty>1?`${e.qty} \xD7 `:""}${n}`:"that";return t.ok?{text:`Added ${o} to your cart`,ok:!0}:{text:`Couldn't add ${n??"that"} to your cart`,ok:!1}}case"cart_set_qty":{let n=rn(e.sku)??"that item";return t.ok?e.qty<=0?{text:`Removed ${n} from your cart`,ok:!0}:{text:`Set ${n} to ${e.qty}`,ok:!0}:{text:`Couldn't update ${n}`,ok:!1}}case"cart_clear":return t.ok?{text:"Emptied your cart",ok:!0}:{text:"Couldn't empty your cart",ok:!1};case"apply_coupon":return t.ok?{text:`Applied code ${e.code.toUpperCase()}`,ok:!0}:{text:`Code ${e.code.toUpperCase()} didn't apply`,ok:!1};case"navigate":return t.ok?{text:`Opened ${sn(e.path)}`,ok:!0}:{text:`Couldn't open ${sn(e.path)}`,ok:!1};case"form_fill":case"checkout_fill":return t.ok?(t.filled??[]).filter(r=>!r.ok).length>0?{text:"Filled in some of your details \u2014 please check the page",ok:!1}:{text:"Filled in your details \u2014 please check them on the page",ok:!0}:{text:"Couldn't fill in your details \u2014 please type them on the page",ok:!1};case"checkout_place":return t.ok?{text:"Sent your order to the payment page",ok:!0}:{text:"Couldn't place the order",ok:!1};case"click":return t.ok?t.verified===!1?{text:"That tap didn't change anything \u2014 trying another way",ok:!1}:null:{text:"Couldn't find that on the page",ok:!1};default:return null}}var tt=10,ln='[data-cart-count],#cart-icon-bubble,.cart-count,.cart-count-bubble,[class*="cart-count"],[class*="CartCount"]';function pr(e=window){try{if(navigator.globalPrivacyControl)return!1;let t=e.Shopify?.customerPrivacy?.analyticsProcessingAllowed;if(typeof t=="function")return!!t();if(typeof e.OnetrustActiveGroups=="string")return e.OnetrustActiveGroups.includes("C0002");if(e.Cookiebot?.hasResponse)return!!e.Cookiebot.consent?.statistics}catch{}return null}function mr(e,t){return e!==null?e:!/^Europe\//.test(t)}function fr(e){return e<768?"mobile":e<1024?"tablet":"desktop"}function un(e,t,n){let o=new URLSearchParams(e).get("utm_source");if(o)return o.toLowerCase().slice(0,40);if(!t)return"direct";try{let r=new URL(t).hostname.replace(/^www\./,"");return r===n.replace(/^www\./,"")?"internal":/google\./.test(r)?"google":/facebook|fb\.|instagram/.test(r)?"meta":r.slice(0,40)}catch{return"direct"}}function hr(e,t){if(/\/(thank|order-confirm|order-success|checkouts\/.*\/thank_you)/i.test(e))return"purchase";if(/\/checkout/i.test(e))return"checkout";if(/^\/cart\/?$/i.test(e))return"cart";for(let n of t)try{if(new RegExp(n.urlPattern).test(e))return n.pageType}catch{}return e==="/"||e===""?"home":"other"}function nt(){return Math.max(document.documentElement.scrollHeight,document.body?.scrollHeight??0,window.innerHeight,1)}function dn(){try{let t=window.__shoppingmateGetCart__;if(typeof t=="function"){let n=t()?.count;if(typeof n=="number")return n}}catch{}let e=Number((document.querySelector(ln)?.textContent??"").replace(/\D/g,""));return Number.isFinite(e)&&document.querySelector(ln)!==null?e:null}function gr(e){let t=e?.closest?.('a,button,input,select,textarea,summary,[role="button"],[role="link"],[role="tab"]');if(!t)return null;let n=t.tagName==="A"?"link":t.tagName==="BUTTON"?"button":t.getAttribute("role")??t.tagName.toLowerCase();return oe(n,Z(t)||t.getAttribute("name")||"")}var He="sm_ins_visit",yr=30*60*1e3;function br(e=Date.now(),t=()=>Math.random().toString(36).slice(2)){let n=null;try{n=JSON.parse(sessionStorage.getItem(He)??"null")}catch{n=null}if(!n||e-n.last>yr){let o=!1;try{o=!localStorage.getItem("sm_seen"),localStorage.setItem("sm_seen","1")}catch{}n={id:`v_${t()}${e.toString(36)}`,last:e,isNew:o,bot:!1,qa:!1}}n.last=e;try{sessionStorage.setItem(He,JSON.stringify(n))}catch{}return n}function ot(e){try{let t=JSON.parse(sessionStorage.getItem(He)??"null");t&&sessionStorage.setItem(He,JSON.stringify({...t,...e}))}catch{}}var rt=!1;function pn(){rt=!0,ot({bot:!0})}function vr(e,t){if(e>=1)return!0;if(e<=0)return!1;let n=0;for(let o of t)n=n*31+o.charCodeAt(0)>>>0;return n%1e3/1e3<e}function mn(e){if(!e.config?.enabled)return null;let t=br();if(!vr(e.config.sampleRate,t.id))return null;let n=(()=>{try{return Intl.DateTimeFormat().resolvedOptions().timeZone??""}catch{return""}})();if(!mr(pr(),n))return null;let o=[];Te().then(d=>{o=d});let r=t.qa||/ShoppingmateBot|HeadlessChrome/.test(navigator.userAgent)||new URLSearchParams(location.search).has("sm_qa");r&&!t.qa&&ot({qa:!0});let i=t.isNew;t.bot&&(rt=!0);let a=(()=>{try{let d=sessionStorage.getItem("sm_src")??un(location.search,document.referrer,location.hostname);return sessionStorage.setItem("sm_src",d),d}catch{return un(location.search,document.referrer,location.hostname)}})(),s=c();function c(){return{path:location.pathname,start:Date.now(),maxScroll:0,attention:new Array(tt).fill(0),cells:{},elements:{},rage:0,dead:0,errorClicks:0,deadTargets:[],rageTargets:[],focused:new Set,submitted:!1,lcp:null,cls:0,inp:null,jsErrors:0,cartStart:dn(),recent:[],lastClickAt:0,sent:!1}}let l=()=>{let d=Math.min(100,Math.round((window.scrollY+window.innerHeight)/nt()*100));d>s.maxScroll&&(s.maxScroll=d)},p=window.setInterval(()=>{if(document.visibilityState!=="visible")return;let d=Math.min(tt-1,Math.floor((window.scrollY+window.innerHeight/2)/nt()*tt));s.attention[d]=(s.attention[d]??0)+1},1e3),m=d=>{if(V(d.target))return;let u=Date.now(),k=Math.min(9,Math.floor((d.clientX+window.scrollX)/Math.max(document.documentElement.scrollWidth,1)*10)),x=Math.min(9,Math.floor((d.clientY+window.scrollY)/nt()*10)),T=`${k},${x}`;s.cells[T]=(s.cells[T]??0)+1;let R=gr(d.target);R&&(s.elements[R]=(s.elements[R]??0)+1),s.recent=s.recent.filter(P=>u-P.t<700&&Math.abs(P.x-d.clientX)<30&&Math.abs(P.y-d.clientY)<30),s.recent.push({t:u,x:d.clientX,y:d.clientY}),s.recent.length===3&&(s.rage+=1,R&&s.rageTargets.length<5&&s.rageTargets.push(R)),s.lastClickAt=u;let D=location.href,$=d.target instanceof Element?d.target:null,z=$?.closest('a,button,label,summary,[role="button"],[role="tab"],[role="option"]')??$?.parentElement??$,U=document.activeElement,K=!1,Ne=P=>P instanceof HTMLElement&&(P.matches('dialog,[role="dialog"],[aria-modal="true"],[role="alert"],[role="status"]')||/fixed|sticky/.test(getComputedStyle(P).position)),he=new MutationObserver(P=>{for(let N of P)if(!V(N.target)){if(z?.contains(N.target)){K=!0;return}if(N.type==="attributes"&&z&&N.target.contains?.(z)&&/^(aria-|open$|hidden$)/.test(N.attributeName??"")){K=!0;return}if(N.type==="childList"&&[...N.addedNodes].some(Ne)){K=!0;return}}});he.observe(document.body,{subtree:!0,childList:!0,attributes:!0,characterData:!0}),window.setTimeout(()=>{he.disconnect();let P=document.activeElement!==U&&document.activeElement!==document.body;if(!K&&!P&&location.href===D&&s.path===location.pathname){s.dead+=1;let N=R??(()=>{let ge=($?.textContent??$?.getAttribute("alt")??"").replace(/\s+/g," ").trim().toLowerCase();return ge?`text|${ge.slice(0,30)}`:null})();N&&s.deadTargets.length<5&&!s.deadTargets.includes(N)&&s.deadTargets.push(N)}},800)},v=d=>{/shoppingmate|widget\/v1/.test(`${d.filename??""}`)||(s.jsErrors+=1,Date.now()-s.lastClickAt<1e3&&(s.errorClicks+=1))},g=d=>{let u=d.target;if(!u||V(u)||!/^(INPUT|TEXTAREA|SELECT)$/.test(u.tagName))return;let k=(u.getAttribute("type")??"").toLowerCase();if(k==="hidden"||k==="password")return;let x=(u.getAttribute("name")||u.id||u.getAttribute("placeholder")||u.tagName).slice(0,40);s.focused.add(x)},S=()=>{s.submitted=!0},M=[];try{let d=new PerformanceObserver(x=>{let T=x.getEntries().at(-1);T&&(s.lcp=Math.round(T.startTime))});d.observe({type:"largest-contentful-paint",buffered:!0});let u=new PerformanceObserver(x=>{for(let T of x.getEntries())T.hadRecentInput||(s.cls+=T.value??0)});u.observe({type:"layout-shift",buffered:!0});let k=new PerformanceObserver(x=>{for(let T of x.getEntries())s.inp=Math.max(s.inp??0,Math.round(T.duration))});k.observe({type:"event",buffered:!0,durationThreshold:40}),M=[d,u,k]}catch{}let w=()=>{if(s.sent)return;s.sent=!0,ot({last:Date.now()});let d=Object.fromEntries(Object.entries(s.elements).sort((R,D)=>D[1]-R[1]).slice(0,20)),u=dn(),k={v:1,merchantId:e.merchantId,sessionId:t.id,visitorId:e.visitorId,path:s.path,pageType:hr(s.path,o),device:fr(window.innerWidth),source:a,newVisitor:i,dwellMs:Date.now()-s.start,maxScroll:s.maxScroll,attention:s.attention,cells:s.cells,elements:d,rage:s.rage,dead:s.dead,errorClicks:s.errorClicks,deadTargets:s.deadTargets,rageTargets:s.rageTargets,abandonedFields:s.submitted?[]:[...s.focused].slice(0,10),lcp:s.lcp,cls:Math.round(s.cls*1e3)/1e3,inp:s.inp,jsErrors:s.jsErrors,botEngaged:rt,cartIncreased:s.cartStart!==null&&u!==null&&u>s.cartStart,qa:r},x=JSON.stringify(k),T=`${e.apiBase}/v1/insights/pageview`;try{navigator.sendBeacon?.(T,new Blob([x],{type:"text/plain"}))||fetch(T,{method:"POST",body:x,keepalive:!0,headers:{"content-type":"text/plain"}}).catch(()=>{})}catch{}},y=()=>{location.pathname!==s.path&&(w(),s=c(),l())},L=history.pushState,H=history.replaceState;history.pushState=function(...d){let u=L.apply(this,d);return window.setTimeout(y,0),u},history.replaceState=function(...d){let u=H.apply(this,d);return window.setTimeout(y,0),u};let h=()=>w();return window.addEventListener("scroll",l,{passive:!0}),window.addEventListener("popstate",y),window.addEventListener("pagehide",h),document.addEventListener("visibilitychange",()=>{document.visibilityState==="hidden"&&w()}),document.addEventListener("click",m,!0),document.addEventListener("focusin",g,!0),document.addEventListener("submit",S,!0),window.addEventListener("error",v),l(),()=>{w(),window.clearInterval(p);for(let d of M)d.disconnect();history.pushState=L,history.replaceState=H,window.removeEventListener("scroll",l),window.removeEventListener("popstate",y),window.removeEventListener("pagehide",h),document.removeEventListener("click",m,!0),document.removeEventListener("focusin",g,!0),document.removeEventListener("submit",S,!0),window.removeEventListener("error",v)}}var fn={"calm-clinician":"Sage","calmosis-clinician":"Calmio",stylist:"Lumi",coach:"Kai",concierge:"Olivia",curator:"Theo",guide:"Maya",expert:"Arjun",host:"Ana"},wr={"calmosis-clinician":"calm-clinician"};function kr(){let e="https://shoppingmate-web.vercel.app/widget/personas";return e&&typeof e=="string"?e.replace(/\/$/,""):"https://cdn.shoppingmate.ai/v1/personas"}var hn={id:"pending",name:"Assistant",initial:"A",avatarUrl:""};function gn(){return hn}function yn(e){if(!e||!fn[e])return hn;let t=fn[e],n=wr[e]??e;return{id:e,name:t,initial:t.charAt(0).toUpperCase(),avatarUrl:`${kr()}/${n}.png`}}var bn=0,W=()=>(bn+=1,`t${bn}`);function xr(e,t){switch(t.type){case"set_mode":return{...e,mode:t.mode};case"set_voice_state":return t.state!=="idle"?{...e,voiceState:t.state,voiceError:null,invited:!1}:{...e,voiceState:t.state};case"set_connection":return{...e,connection:t.status,thinking:t.status==="connected"?e.thinking:!1};case"set_voice_error":return{...e,voiceError:t.error};case"set_invited":return{...e,invited:t.invited};case"receipt":{let n=e.transcript[e.transcript.length-1];return n&&n.kind==="receipt"&&n.text===t.text&&n.ok===t.ok?e:{...e,transcript:[...e.transcript,{id:W(),role:"system",kind:"receipt",text:t.text,ok:t.ok,ts:Date.now()}]}}case"reset":return{...e,transcript:[],thinking:!1,closed:!1,closedReason:null,checkoutUrl:null,capWarning:null};case"user_input":return{...e,transcript:[...e.transcript,{id:W(),role:"user",kind:"text",text:t.text,ts:Date.now()}]};case"agent_event":{let n=t.event;switch(n.type){case"thinking":return{...e,thinking:!0};case"end_of_turn":return{...e,thinking:!1};case"say":{let o=e.transcript[e.transcript.length-1];return o&&o.role==="agent"&&o.kind==="text"&&o.partial?{...e,thinking:!1,transcript:[...e.transcript.slice(0,-1),{...o,text:n.text,partial:!1,ts:Date.now()}]}:{...e,thinking:!1,transcript:[...e.transcript,{id:W(),role:"agent",kind:"text",text:n.text,ts:Date.now()}]}}case"say_partial":{let o=e.transcript[e.transcript.length-1];return o&&o.role==="agent"&&o.kind==="text"&&o.partial?{...e,thinking:!1,transcript:[...e.transcript.slice(0,-1),{...o,text:n.text,ts:Date.now()}]}:{...e,thinking:!1,transcript:[...e.transcript,{id:W(),role:"agent",kind:"text",text:n.text,ts:Date.now(),partial:!0}]}}case"user_text":return{...e,transcript:[...e.transcript,{id:W(),role:"user",kind:"text",text:n.text,ts:Date.now()}]};case"cards":return{...e,transcript:[...e.transcript,{id:W(),role:"agent",kind:"cards",items:n.items,ts:Date.now()}]};case"tool_result":return n.toolName==="case.open"&&n.ok?{...e,transcript:[...e.transcript,{id:W(),role:"system",kind:"receipt",text:"Your request is with the team \u2014 they\u2019ll contact you",ok:!0,ts:Date.now()}]}:e;case"checkout_redirect":return{...e,checkoutUrl:n.url};case"cap_warning":return{...e,capWarning:{reason:n.reason,remaining:n.remaining},transcript:[...e.transcript,{id:W(),role:"system",kind:"cap_warning",remaining:n.remaining,ts:Date.now()}]};case"session_closed":return{...e,closed:!0,closedReason:n.reason,transcript:[...e.transcript,{id:W(),role:"system",kind:"closed",reason:n.reason,ts:Date.now()}]};default:return e}}default:return e}}function it(e){let t={sessionId:e.sessionId,mode:"pill",voiceState:"idle",transcript:[],thinking:!1,closed:!1,closedReason:null,checkoutUrl:null,capWarning:null,connection:"connecting",voiceError:null,invited:!1},n=[];return{get:()=>t,dispatch:o=>{t=xr(t,o);for(let r of n)r(t)},subscribe:o=>(n.push(o),()=>{let r=n.indexOf(o);r>=0&&n.splice(r,1)})}}var vn=`
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
`;var wn=[1e3,2e3,4e3,8e3,16e3],_r=5;function kn(e,t){let n=null,o=0,r=!1,i=[];function a(){r||(t.onStatus(o>0?"reconnecting":"connecting"),n=new WebSocket(e),n.onopen=()=>{t.onStatus("connected"),o>0&&n?.send(JSON.stringify({type:"session_resume",sessionId:t.sessionId})),o=0;for(let s of i)n?.send(s);i=[]},n.onmessage=s=>t.onEvent(typeof s.data=="string"?s.data:""),n.onerror=()=>{},n.onclose=()=>{if(r)return;if(o+=1,o>=_r){t.onStatus("disconnected");return}let s=Math.min(o-1,wn.length-1),c=wn[s]??3e4;t.onStatus("reconnecting"),setTimeout(a,c)})}return a(),{send:s=>{n&&n.readyState===1?n.send(s):i.push(s)},close:()=>{r=!0,n?.close()}}}var b={captionResting:"AI ASSISTANT",captionIncoming:"INCOMING CALL",captionThinking:"THINKING",captionConnected:"CONNECTED",captionRetry:"TAP TO RETRY",captionOffline:"OFFLINE",talkToPrefix:"Talk to",callCta:"Call",acceptCta:"Accept",callAria:"Start voice call",acceptAria:"Accept call",micMute:"Mute mic",micUnmute:"Unmute mic",retryAria:"Retry call",endCallAria:"End call",closeAria:"Close",openAria:"Open shoppingmate",chatAria:"Chat instead",callFailedTitle:"Could not start the call. Please try again.",callHelpHeading:"How can I help you?",callBullets:["Find the right product","Compare options out loud","Check out on this page"],panelHelpHeading:"Hi, I'm",panelHelpSubtitle:"I'm here to help you:",panelBullets:["Find the right product fast","Compare options out loud","Check out without leaving the page"],panelPrompts:["Help me find the right product","Can you compare your products for me?","I'd like to check out"],poweredBy:"Powered by shoppingmate",chatPlaceholder:"Type a quick question\u2026",reconnecting:"Reconnecting\u2026",disconnected:"Connection lost \u2014 reload to retry",closed:{user:"Conversation ended",cap:"Time to wrap up \u2014 reload for a new chat",error:"Something went wrong"},payNow:"Pay now \u2192",capWarning:"A couple minutes left",thinking:"thinking\u2026",micDenied:"Mic blocked \u2014 switching to text"};var q=e=>`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${e}</svg>`,st=q('<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>'),xn=q('<path d="M18 6 6 18"/><path d="m6 6 12 12"/>'),_n=q('<path d="M5 12h14"/>'),Sn=q('<path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>'),Cn=q('<path d="M10.68 13.31a16 16 0 0 0 3.41 2.6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7 2 2 0 0 1 1.72 2v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.42 19.42 0 0 1-3.33-2.67"/><path d="M5 5a2 2 0 0 1 2-2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L10.9 11.1"/><line x1="22" y1="2" x2="2" y2="22"/>'),Tn=q('<path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="22"/>'),En=q('<line x1="2" y1="2" x2="22" y2="22"/><path d="M18.89 13.23A7.12 7.12 0 0 0 19 12v-2"/><path d="M5 10v2a7 7 0 0 0 12 5"/><path d="M15 9.34V5a3 3 0 0 0-5.68-1.33"/><path d="M9 9v3a3 3 0 0 0 5.12 2.12"/><line x1="12" y1="19" x2="12" y2="22"/>'),An=q('<path d="M22 2 11 13"/><path d="M22 2l-7 20-4-9-9-4 20-7z"/>');function fe(e){return e.replace(/[&<>"']/g,t=>t==="&"?"&amp;":t==="<"?"&lt;":t===">"?"&gt;":t==='"'?"&quot;":"&#39;")}function Sr(e){return fe(e.trim()).replace(/\*\*([^*\n]+)\*\*/g,"<strong>$1</strong>").replace(/__([^_\n]+)__/g,"<strong>$1</strong>").replace(/(^|\s)\*([^*\n]+)\*(?=\s|$|[.,!?])/g,"$1$2").replace(/^#{1,6}\s+/gm,"").replace(/^\s*[-•]\s+/gm,"\u2022 ").replace(/\n{2,}/g,`
`).replace(/\n/g,"<br>")}function Ln(e,t,n){t==="user"?e.textContent=n:e.innerHTML=Sr(n)}function Cr(e,t){let n=document.createElement("button");return n.className="card",n.type="button",n.dataset.sku=e.sku,n.innerHTML=`
    ${e.image?`<img src="${fe(e.image)}" alt="${fe(e.title)}" />`:'<div class="card-img-fallback"></div>'}
    <div class="title">${fe(e.title)}</div>
    <div class="price">${fe(e.priceFormatted)}</div>
  `,n.addEventListener("click",()=>t({sku:e.sku,variantId:e.variantId})),n}function Tr(e,t){if(e.kind==="text"){let o=document.createElement("div");return o.className=`bubble ${e.role}`,Ln(o,e.role,e.text),o}if(e.kind==="cards"){let o=document.createElement("div");o.className="cards-row";for(let r of e.items)o.appendChild(Cr(r,t));return o}if(e.kind==="receipt"){let o=document.createElement("div");o.className=`receipt ${e.ok?"ok":"warn"}`,o.setAttribute("role","status");let r=document.createElement("span");r.className="receipt-icon",r.setAttribute("aria-hidden","true"),r.textContent=e.ok?"\u2713":"!";let i=document.createElement("span");return i.textContent=e.text,o.append(r,i),o}if(e.kind==="cap_warning"){let o=document.createElement("div");return o.className="bubble system",o.textContent=b.capWarning,o}let n=document.createElement("div");return n.className="bubble system",n.textContent=b.closed[e.reason],n}var Mn=new WeakMap;function Pe(e,t,n){let o=Mn.get(e)??[],r=new Map(o.map(c=>[c.id,c])),i=new Set(t.map(c=>c.id));for(let c of o)i.has(c.id)||c.el.remove();let a=[],s=!1;for(let c=0;c<t.length;c++){let l=t[c];if(!l)continue;let p=r.get(l.id);if(p)l.kind==="text"&&p.text!==l.text&&(Ln(p.el,l.role,l.text),p.text=l.text,s=!0),a.push(p);else{let m=Tr(l,n);e.appendChild(m),a.push({id:l.id,el:m,text:l.kind==="text"?l.text:void 0}),s=!0}}Mn.set(e,a),s&&(e.scrollTop=e.scrollHeight)}function Er(e){switch(e){case"mic_policy_blocked":return"Voice is disabled on this page \u2014 text chat still works.";case"mic_denied":return"Microphone blocked. Allow mic access in your browser, then tap Call.";case"mic_unavailable":return"No microphone found \u2014 check your audio device, then tap Call.";case"connect_failed":return"Couldn't reach voice. Tap Call to retry.";default:return"Tap Call to try again."}}function In(e){return e.muted?"you're muted":e.voiceState==="connecting"?`connecting to ${e.personaName}\u2026`:e.voiceState==="speaking"?`${e.personaName} is speaking\u2026`:e.voiceState==="listening"?`${e.personaName} is listening\u2026`:`${e.personaName} is ready`}function Rn(e){return e.voiceState==="idle"&&e.voiceError?"error":e.transcript.length===0?"prompt":"transcript"}function Ar(e){return`${Rn(e)}|${e.checkoutUrl??""}|${e.personaName}|${e.voiceError?.code??""}`}function Hn(e,t){let n=Ar(t),o=Rn(t);if(e.dataset.chromeKey!==n){let a=o==="error"?`
          <div class="call-error">
            <p class="call-error-title">${b.callFailedTitle}</p>
            <p class="call-error-hint">${Er(t.voiceError?.code??"unknown")}</p>
          </div>`:"",s=o==="prompt"?`
          <div class="call-prompt">
            <h2 class="call-prompt-heading">${b.callHelpHeading}</h2>
            <ul class="call-prompt-bullets">
              ${b.callBullets.map(l=>`<li>${l}</li>`).join("")}
            </ul>
          </div>`:"",c=o!=="transcript";e.innerHTML=`
      <div class="panel call-panel">
        <button class="panel-close" data-action="close" aria-label="${b.closeAria}">${_n}</button>
        ${a}
        ${s}
        <div class="status-line ${o==="error"?"hidden":""}" data-region="status">${In(t)}</div>
        <div class="transcript ${c?"hidden":""}" data-region="transcript" aria-live="polite"></div>
        ${t.checkoutUrl?`<a class="checkout-cta" data-action="checkout" href="${t.checkoutUrl}" target="_blank" rel="noopener">${b.payNow}</a>`:""}
        <div class="panel-footer">${b.poweredBy}</div>
      </div>
    `,e.querySelector('[data-action="close"]')?.addEventListener("click",t.onClose),e.querySelector('[data-action="checkout"]')?.addEventListener("click",t.onCheckout),e.dataset.chromeKey=n}let r=e.querySelector('[data-region="status"]');if(r instanceof HTMLElement){let a=In(t);r.textContent!==a&&(r.textContent=a)}let i=e.querySelector('[data-region="transcript"]');i instanceof HTMLElement&&o==="transcript"&&Pe(i,t.transcript,t.onCardTap)}function Mr(e){return`${e.transcript.length===0?"1":"0"}|${e.checkoutUrl??""}|${e.closed?"1":"0"}|${e.personaName}|${e.personaInitial}|${e.personaAvatarUrl}`}function Pn(e,t){let n=Mr(t);if(e.dataset.chromeKey!==n){let r=t.transcript.length===0,i=b.panelBullets.map((l,p)=>`<button type="button" class="welcome-bullet" data-prompt="${p}" ${t.closed?"disabled":""}>${l}<span class="welcome-bullet-arrow" aria-hidden="true">\u2192</span></button>`).join(""),a=r?`
        <div class="welcome">
          <div class="welcome-avatar">
            <img src="${t.personaAvatarUrl}" alt="" onerror="this.style.display='none'; this.nextElementSibling.style.display='grid';" />
            <span class="welcome-avatar-fallback" aria-hidden="true">${t.personaInitial}</span>
          </div>
          <h2 class="welcome-heading">${b.panelHelpHeading} ${t.personaName}.</h2>
          <p class="welcome-sub">${b.panelHelpSubtitle}</p>
          <div class="welcome-bullets">${i}</div>
        </div>
      `:"";e.innerHTML=`
      <div class="panel">
        <button class="panel-close" data-action="close" aria-label="${b.closeAria}">${xn}</button>
        ${a}
        <div class="transcript ${r?"transcript-empty":""}" data-region="transcript" aria-live="polite"></div>
        ${t.checkoutUrl?`<a class="checkout-cta" href="${t.checkoutUrl}" target="_blank" rel="noopener">${b.payNow}</a>`:""}
        <form class="input-row">
          <input type="text" placeholder="${b.chatPlaceholder}" ${t.closed?"disabled":""} />
          <button class="send" type="submit" aria-label="Send" ${t.closed?"disabled":""}>${An}</button>
        </form>
        <div class="panel-footer">${b.poweredBy}</div>
      </div>
    `,e.querySelector('[data-action="close"]')?.addEventListener("click",t.onClose),e.querySelectorAll(".welcome-bullet").forEach(l=>{l.addEventListener("click",()=>{if(t.closed)return;let p=Number(l.dataset.prompt),m=b.panelPrompts[p]??b.panelBullets[p];m&&t.onSend(m)})});let s=e.querySelector("form"),c=e.querySelector("input");s instanceof HTMLFormElement&&c instanceof HTMLInputElement&&s.addEventListener("submit",l=>{l.preventDefault();let p=c.value.trim();p&&(c.value="",t.onSend(p))}),e.dataset.chromeKey=n}let o=e.querySelector('[data-region="transcript"]');o instanceof HTMLElement&&Pe(o,t.transcript,t.onCardTap)}function Lr(e,t,n,o,r,i,a=8){let s=Math.max(a,r-n-a),c=Math.max(a,i-o-a);return{x:Math.min(Math.max(a,e),s),y:Math.min(Math.max(a,t),c)}}function Ir(e,t,n,o=8){let r=(e.left+e.right)/2,i=(e.top+e.bottom)/2,a=r>t/2?"right":"left",s=i>n/2?"bottom":"top",c=Math.max(o,a==="right"?t-e.right:e.left),l=Math.max(o,s==="bottom"?n-e.bottom:e.top);return{hSide:a,hVal:c,vSide:s,vVal:l}}function at(e,t){e.classList.add("dragged"),e.style.transform="none",t.hSide==="right"?(e.style.right=`${t.hVal}px`,e.style.left="auto"):(e.style.left=`${t.hVal}px`,e.style.right="auto"),t.vSide==="bottom"?(e.style.bottom=`${t.vVal}px`,e.style.top="auto"):(e.style.top=`${t.vVal}px`,e.style.bottom="auto"),e.classList.toggle("dock-top",t.vSide==="top"),e.classList.toggle("dock-bottom",t.vSide==="bottom"),e.classList.toggle("dock-left",t.hSide==="left"),e.classList.toggle("dock-right",t.hSide==="right")}function Nn(e){try{let t=window.localStorage.getItem(e);if(!t)return null;let n=JSON.parse(t);if((n.hSide==="left"||n.hSide==="right")&&(n.vSide==="top"||n.vSide==="bottom")&&typeof n.hVal=="number"&&typeof n.vVal=="number")return n}catch{}return null}function Rr(e,t){try{window.localStorage.setItem(e,JSON.stringify(t))}catch{}}function $n(e,t){let n=t.offsetWidth||0,o=t.offsetHeight||0,r=window.innerWidth,i=window.innerHeight;return{...e,hVal:Math.min(Math.max(8,e.hVal),Math.max(8,r-n-8)),vVal:Math.min(Math.max(8,e.vVal),Math.max(8,i-o-8))}}function On(e){let{root:t,surface:n,storageKey:o}=e,r=()=>n.querySelector(".tray")??n,i=Nn(o);i&&at(t,$n(i,r()));let a=0,s=0,c=0,l=0,p=!1,m=null,v=w=>{if(m!==null&&w.pointerId!==m)return;let y=w.clientX-a,L=w.clientY-s;if(!p&&Math.hypot(y,L)<6)return;if(!p)try{m!=null&&n.setPointerCapture(m)}catch{}p=!0,t.classList.add("dragging","dragged"),t.style.transform="none";let H=t.offsetWidth,h=t.offsetHeight,{x:d,y:u}=Lr(c+y,l+L,H,h,window.innerWidth,window.innerHeight);t.style.left=`${d}px`,t.style.top=`${u}px`,t.style.right="auto",t.style.bottom="auto",t.classList.remove("dock-top","dock-bottom","dock-left","dock-right"),w.preventDefault()},g=w=>{if(window.removeEventListener("pointermove",v),window.removeEventListener("pointerup",g),m=null,!p)return;p=!1,t.classList.remove("dragging");let y=h=>{h.stopPropagation(),h.preventDefault()};n.addEventListener("click",y,{capture:!0,once:!0}),window.setTimeout(()=>n.removeEventListener("click",y,{capture:!0}),350);let L=r().getBoundingClientRect(),H=Ir({top:L.top,left:L.left,right:L.right,bottom:L.bottom},window.innerWidth,window.innerHeight);at(t,H),Rr(o,H),w.preventDefault()},S=w=>{if(w.button!=null&&w.button!==0)return;let y=r().getBoundingClientRect();a=w.clientX,s=w.clientY,c=y.left,l=y.top,p=!1,m=w.pointerId??null,window.addEventListener("pointermove",v),window.addEventListener("pointerup",g)},M=()=>{let w=Nn(o);w&&at(t,$n(w,r()))};return n.addEventListener("pointerdown",S),window.addEventListener("resize",M),()=>{n.removeEventListener("pointerdown",S),window.removeEventListener("pointermove",v),window.removeEventListener("pointerup",g),window.removeEventListener("resize",M)}}function Hr(e){return e.voiceState==="connecting"?"connecting":e.voiceState!=="idle"?"connected":e.voiceError?"error":e.invited?"incoming":"resting"}function Pr(e,t){return[t,e.mode,e.callable?"1":"0",e.voiceState,e.connection,e.invited?"1":"0",e.personaName,e.personaInitial,e.personaAvatarUrl,e.launcherLabel??"",e.launcherCaption??""].join("|")}function Nr(e,t){let n=e.voiceState==="muted",o=e.voiceState==="speaking",r=e.connection==="disconnected",i=(g,S)=>`
    <button class="tray-call" data-action="call" aria-label="${S}">
      ${Sn}<span class="tray-call-label">${g}</span>
    </button>`,a=`
    <button class="tray-btn ghost" data-action="chat" aria-label="${b.openAria}">${st}</button>`,s=`
    <button class="tray-btn tray-chat" data-action="chat" aria-label="${b.chatAria}" title="${b.chatAria}">${st}</button>`,c=g=>`
    <button class="tray-btn ${n?"muted":""}" data-action="mic" ${g?"disabled":""}
      aria-pressed="${n}" aria-label="${n?b.micUnmute:b.micMute}">${n?En:Tn}</button>`,l=`
    <button class="tray-btn end" data-action="end" aria-label="${b.endCallAria}">${Cn}</button>`,p='<span class="tray-spinner" aria-hidden="true"></span>',m=`
    <div class="tray-waveform active ${o?"speaking":""}" aria-hidden="true">
      ${Array.from({length:14}).map(()=>'<span class="bar"></span>').join("")}
    </div>`,v=r?"offline":"online";switch(t){case"incoming":return{caption:b.captionIncoming,captionClass:"incoming",presenceClass:v,nameText:e.personaName,controls:`${i(b.acceptCta,b.acceptAria)}${s}`};case"connecting":return{caption:b.captionThinking,captionClass:"thinking",presenceClass:"online",nameText:e.personaName,controls:`${p}${c(!0)}${l}`};case"connected":return{caption:b.captionConnected,captionClass:"connected",presenceClass:"online",nameText:e.personaName,controls:`${m}${c(!1)}${l}`};case"error":return{caption:b.captionRetry,captionClass:"retry",presenceClass:"offline",nameText:e.personaName,controls:`${i(b.callCta,b.retryAria)}${l}`};default:{let g=e.launcherLabel?.trim(),S=e.launcherCaption?.trim();return{caption:r?b.captionOffline:S||b.captionResting,captionClass:r?"retry":"resting",presenceClass:v,nameText:g||`${b.talkToPrefix} ${e.personaName}`,controls:e.callable?`${i(b.callCta,b.callAria)}${s}`:a}}}}function Dn(e,t){let n=Hr(t),o=Pr(t,n);if(e.dataset.trayKey===o)return;let r=Nr(t,n),i=t.mode==="chat"||t.mode==="call"||t.mode==="expanded";e.innerHTML=`
    <div class="tray phase-${n}" role="region" aria-label="shoppingmate">
      <button class="tray-avatar" data-action="toggle" aria-expanded="${i}" aria-label="${b.openAria}">
        <span class="tray-avatar-ring" aria-hidden="true"></span>
        <img src="${t.personaAvatarUrl}" alt="" class="tray-avatar-img" draggable="false" onerror="this.style.display='none'; this.nextElementSibling.style.display='grid';" />
        <span class="tray-avatar-fallback" aria-hidden="true">${t.personaInitial}</span>
        <span class="tray-presence ${r.presenceClass}"></span>
      </button>
      <div class="tray-meta">
        <div class="tray-name">${r.nameText}</div>
        <div class="tray-caption ${r.captionClass}">${r.caption}</div>
      </div>
      <div class="tray-controls">${r.controls}</div>
    </div>
  `,e.querySelector('[data-action="toggle"]')?.addEventListener("click",()=>{i?t.onClose():t.onChat()}),e.querySelector('[data-action="call"]')?.addEventListener("click",t.onCall),e.querySelector('[data-action="chat"]')?.addEventListener("click",t.onChat),e.querySelector('[data-action="mic"]')?.addEventListener("click",()=>{t.onMute(t.voiceState!=="muted")}),e.querySelector('[data-action="end"]')?.addEventListener("click",t.onEnd),e.dataset.trayKey=o}var Vn="shoppingmate-widget",Wn="SM-XPK2EN",zn="SM-2SCCLZ",Un=new Set(["bottom-right","bottom-left","bottom-center","center","center-left","center-right","top-right","top-left"]),Fn=new Set(["small","medium","large"]),$r=6e3,Or=12e3,Dr=["cart-sidebar-show","cart-open","cart--open","cart-drawer-open","cart-drawer--active","cart-drawer-is-open","js-drawer-open","drawer-open","drawer--open","js-drawer-open-right","cart-active","is-cart-open","cart-is-open","cart-visible","show-cart","cart-show","mini-cart-active","minicart-active","mini-cart--active","ajaxcart-open","header-cart-open"],Vr=["menu-open","menu--open","menu-is-open","is-menu-open","menu-drawer-open","menu-drawer--active","mobile-menu-open","mobile-menu--open","mobile-nav-open","nav-open","nav--open","nav-is-open","is-nav-open","js-nav-open","js-menu-open","navigation-open","header-menu-open","offcanvas-open","off-canvas-open","offcanvas-nav-open","offcanvas-menu-open"];function Wr(e,t){if(t==="/cart"||t.startsWith("/cart/")||t.startsWith("/cart?"))return!0;let n=e.toLowerCase();return Dr.some(o=>n.includes(o))||Vr.some(o=>n.includes(o))}function zr(){try{let e=window.location.pathname||"",t=`${document.documentElement.className} ${document.body?document.body.className:""}`;return Wr(t,e)}catch{return!1}}function Ur(){return"live-kit"==="web-speech"?"web-speech":"live-kit"}var ct=class extends HTMLElement{constructor(){super(...arguments);C(this,"rootEl",null);C(this,"pillHost",null);C(this,"panelHost",null);C(this,"store",it({sessionId:"pending"}));C(this,"socket",null);C(this,"voiceMode",te(null,ke()));C(this,"voice",null);C(this,"persona",gn());C(this,"launcherLabel",null);C(this,"launcherCaption",null);C(this,"heldCaptions",[]);C(this,"apiBase","");C(this,"merchantId","");C(this,"domain",window.location.host);C(this,"stopActivityTracker",null);C(this,"inviteTimer",null);C(this,"inviteDismissTimer",null);C(this,"collapseTimer",null);C(this,"stopCollapse",null);C(this,"cartObserver",null);C(this,"scrollResizeRaf",!1);C(this,"overlayRecheck",null);C(this,"stopDrag",null);C(this,"ambience",De(!1));C(this,"onHostGesture",()=>{this.onCartVisibilityChange(),window.setTimeout(this.onCartVisibilityChange,200),window.setTimeout(this.onCartVisibilityChange,550)});C(this,"onScrollResize",()=>{this.scrollResizeRaf||(this.scrollResizeRaf=!0,requestAnimationFrame(()=>{this.scrollResizeRaf=!1,this.onCartVisibilityChange()}))});C(this,"onCartVisibilityChange",()=>{if(!this.rootEl)return;let n=this.store.get(),o=n.mode==="call"||n.voiceState!=="idle",r=n.mode==="chat"||n.mode==="expanded",i=(zr()||!r&&this.launcherCovered())&&!o;this.rootEl.classList.toggle("host-overlay-hidden",i)})}connectedCallback(){if(this.shadowRoot)return;let n=this.getAttribute("data-id"),o=this.getAttribute("data-api")??this.apiBase;if(!n){console.warn("[shoppingmate] data-id missing on widget element");return}this.merchantId=n,this.apiBase=o,this.ambience=De(this.getAttribute("data-ambience")!=="off");let r=this.attachShadow({mode:"open"}),i=document.createElement("style");i.textContent=vn,r.appendChild(i);let a=document.createElement("div"),s=this.merchantId===zn?"center-left":"bottom-right",c=(this.getAttribute("data-position")??s).toLowerCase(),l=Un.has(c)?`pos-${c}`:"pos-bottom-right",p=(this.getAttribute("data-size")??"medium").toLowerCase(),m=Fn.has(p)&&p!=="medium"?` size-${p}`:"";a.className=`root ${l}${m}`,r.appendChild(a),this.rootEl=a,this.panelHost=document.createElement("div"),this.pillHost=document.createElement("div"),a.appendChild(this.panelHost),a.appendChild(this.pillHost),this.store.subscribe(()=>this.render()),this.render(),this.stopDrag=On({root:a,surface:this.pillHost,storageKey:`sm-widget-pos:${this.merchantId}`}),this.stopCollapse=this.setupAutoCollapse(a,this.pillHost),this.setupCartVisibility(a),this.start()}applyServerPosition(n){let o=this.rootEl;if(!o||o.classList.contains("dragged"))return;let r=n.toLowerCase();if(Un.has(r)){for(let i of Array.from(o.classList))i.startsWith("pos-")&&o.classList.remove(i);o.classList.add(`pos-${r}`)}}applyAccent(n){let o=this.rootEl;if(!o)return;let r=n.trim();!/^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(r)&&!/^rgba?\([\d.,\s%]+\)$/i.test(r)||o.style.setProperty("--sm-accent",r)}applyServerSize(n){let o=this.rootEl;if(!o)return;let r=n.toLowerCase();Fn.has(r)&&(o.classList.remove("size-small","size-large"),r!=="medium"&&o.classList.add(`size-${r}`))}disconnectedCallback(){this.socket?.close(),this.voiceMode.stop(),this.ambience.stop(),this.stopActivityTracker?.(),this.inviteTimer&&clearTimeout(this.inviteTimer),this.inviteDismissTimer&&clearTimeout(this.inviteDismissTimer),this.collapseTimer&&clearTimeout(this.collapseTimer),this.stopCollapse?.(),this.cartObserver?.disconnect(),window.removeEventListener("popstate",this.onCartVisibilityChange),document.removeEventListener("click",this.onHostGesture,!0),document.removeEventListener("keyup",this.onHostGesture,!0),window.removeEventListener("scroll",this.onScrollResize),window.removeEventListener("resize",this.onScrollResize),this.overlayRecheck&&window.clearInterval(this.overlayRecheck),this.stopDrag?.()}setupCartVisibility(n){this.onCartVisibilityChange(),this.cartObserver=new MutationObserver(this.onCartVisibilityChange),this.cartObserver.observe(document.documentElement,{attributes:!0,attributeFilter:["class"]}),document.body&&this.cartObserver.observe(document.body,{attributes:!0,attributeFilter:["class"]}),window.addEventListener("popstate",this.onCartVisibilityChange),document.addEventListener("click",this.onHostGesture,!0),document.addEventListener("keyup",this.onHostGesture,!0),window.addEventListener("scroll",this.onScrollResize,{passive:!0}),window.addEventListener("resize",this.onScrollResize),this.overlayRecheck=window.setInterval(()=>{this.rootEl?.classList.contains("host-overlay-hidden")&&this.onCartVisibilityChange()},1500)}launcherCovered(){let n=this.rootEl;if(!n||typeof document.elementsFromPoint!="function")return!1;let o=n.getBoundingClientRect();if(!o.width||!o.height)return!1;let r=o.left+o.width/2,i=o.top+o.height/2;for(let a of document.elementsFromPoint(r,i)){if(a===this||this.contains(a)||a.contains(this)||a.tagName==="SHOPPINGMATE-WIDGET")continue;let s=a;for(;s&&s!==document.body&&s!==document.documentElement;){let c=getComputedStyle(s);if(c.position==="fixed"&&c.pointerEvents!=="none"){let l=s.getBoundingClientRect(),p=l.left<=r&&l.right>=r&&l.top<=i&&l.bottom>=i,m=l.width>=window.innerWidth*.4||l.height>=window.innerHeight*.4,v=c.visibility!=="hidden"&&c.display!=="none"&&Number(c.opacity)>.01;if(p&&m&&v)return!0}s=s.parentElement}}return!1}setupAutoCollapse(n,o){let r=()=>{this.collapseTimer&&clearTimeout(this.collapseTimer),this.collapseTimer=setTimeout(()=>n.classList.add("collapsed"),$r)},i=()=>{n.classList.remove("collapsed"),r()};return o.addEventListener("pointerenter",i),o.addEventListener("pointerdown",i),o.addEventListener("focusin",i),o.addEventListener("pointerleave",r),r(),()=>{o.removeEventListener("pointerenter",i),o.removeEventListener("pointerdown",i),o.removeEventListener("focusin",i),o.removeEventListener("pointerleave",r)}}async start(){let n=await Qt({apiBase:this.apiBase,merchantId:this.merchantId,domain:this.domain});if(n.kind==="err"){console.warn("[shoppingmate] bootstrap failed:",n.reason);return}this.store=it({sessionId:n.sessionId}),this.store.subscribe(()=>this.render()),Ut({apiBase:this.apiBase,merchantId:this.merchantId,sessionId:n.sessionId}),n.insights?.enabled&&mn({apiBase:this.apiBase,merchantId:this.merchantId,sessionId:n.sessionId,visitorId:n.visitorId,config:n.insights}),this.voice=n.voice,this.persona=yn(n.personaId??n.voice?.personaId??null),n.widgetPosition&&this.applyServerPosition(n.widgetPosition),n.widgetSize&&this.applyServerSize(n.widgetSize),n.widgetAccent&&this.applyAccent(n.widgetAccent),this.launcherLabel=n.widgetLabel?.trim()||null,this.launcherCaption=n.widgetGreeting?.trim()||null,this.render();let o=Ur(),r=ie();if(o==="live-kit"&&this.voice?.transport==="ws"&&this.voice.voiceWsUrl){let i=this.voice;this.voiceMode=nn(tn({sessionId:n.sessionId,url:i.voiceWsUrl,onAgentEvent:a=>this.handleLiveKitData(a)}),()=>(We(),se({stack:"live-kit",livekit:{sessionId:n.sessionId,wsUrl:i.wsUrl,token:i.token,roomName:i.roomName,onTranscriptEvent:a=>this.handleLiveKitData(a)}})),{onSwitch:a=>console.warn("[shoppingmate] voice fell back to LiveKit:",a)}),this.armVoiceWarm()}else if(o==="live-kit"&&this.voice){We();let i=se({stack:"live-kit",livekit:{sessionId:n.sessionId,wsUrl:this.voice.wsUrl,token:this.voice.token,roomName:this.voice.roomName,onTranscriptEvent:a=>this.handleLiveKitData(a)}});i&&(this.voiceMode=i,this.armVoiceWarm())}else{let i=se({stack:"web-speech"});i&&(this.voiceMode=i),r?.onFinal(a=>{this.store.dispatch({type:"user_input",text:a,mode:"voice"}),this.socket?.send(O({type:"user_text",sessionId:n.sessionId,text:a,mode:"voice",visitorId:pe()}))})}this.voiceMode.onStateChange(i=>{if(this.store.dispatch({type:"set_voice_state",state:i}),i!=="connecting"&&this.heldCaptions.length)for(let a of this.heldCaptions.splice(0))i!=="idle"&&this.store.dispatch({type:"agent_event",event:a})}),this.voiceMode.onError?.(i=>{console.warn("[shoppingmate] voice error",i),this.store.dispatch({type:"set_voice_error",error:i})}),this.socket=kn(n.wsUrl,{sessionId:n.sessionId,onEvent:i=>{let a=Ve(i);a&&this.handleAgentEvent(a)},onStatus:i=>this.store.dispatch({type:"set_connection",status:i})}),(this.merchantId===Wn||this.merchantId===zn)&&(this.inviteTimer=setTimeout(()=>{this.store.get().voiceState==="idle"&&this.store.get().mode==="pill"&&(this.store.dispatch({type:"set_invited",invited:!0}),this.inviteDismissTimer=setTimeout(()=>{let i=this.store.get();i.invited&&i.voiceState==="idle"&&i.mode==="pill"&&this.store.dispatch({type:"set_invited",invited:!1})},Or))},5e3)),this.stopActivityTracker=on({sessionId:n.sessionId,hints:new Map,send:i=>this.publishWidgetMessage(i)})}armVoiceWarm(){let n=this.pillHost;if(!n)return;let o=()=>this.voiceMode.warm?.();for(let i of["pointerenter","touchstart","focusin"])n.addEventListener(i,o,{passive:!0});let r=!1;this.store.subscribe(()=>{let i=this.store.get(),a=i.invited||i.mode==="chat"||i.mode==="expanded";a&&!r&&o(),r=a})}async handleAgentEvent(n,o="ws"){if(n.type==="host_action_request"){let r=await Kt(n.action),i=cn(n.action,r);i&&this.store.dispatch({type:"receipt",text:i.text,ok:i.ok}),this.publishWidgetMessage({type:"host_action_result",callId:n.callId,result:r},o);return}if(n.type!=="persona_swap"&&n.type!=="agent_warmed"){if(n.type==="agent_ready"){this.voiceMode.signalAgentReady?.();return}if((n.type==="say"||n.type==="say_partial")&&this.voiceMode.getState()==="connecting"){this.heldCaptions.push(n);return}this.store.dispatch({type:"agent_event",event:n}),n.type==="say"&&this.voiceMode.speak(n.text)}}publishWidgetMessage(n,o="ws"){let r=O(n);if(o==="livekit"&&this.voiceMode.publishData){let i=new TextEncoder().encode(r);this.voiceMode.publishData(i);return}this.socket?.send(r)}render(){if(!this.pillHost||!this.panelHost)return;let n=this.store.get();this.onCartVisibilityChange();let o=ie()!==null;n.mode==="call"?Hn(this.panelHost,{voiceState:n.voiceState,muted:n.voiceState==="muted",transcript:n.transcript,checkoutUrl:n.checkoutUrl,personaName:this.persona.name,voiceError:n.voiceError,onClose:()=>this.store.dispatch({type:"set_mode",mode:"pill"}),onCardTap:r=>this.cardTap(r),onCheckout:()=>{}}):n.mode==="chat"||n.mode==="expanded"?Pn(this.panelHost,{transcript:n.transcript,checkoutUrl:n.checkoutUrl,personaName:this.persona.name,personaInitial:this.persona.initial,personaAvatarUrl:this.persona.avatarUrl,onSend:r=>this.userText(r,"text"),onCall:()=>this.openCall(),onClose:()=>this.store.dispatch({type:"set_mode",mode:"pill"}),onCardTap:r=>this.cardTap(r),closed:n.closed}):this.panelHost.innerHTML="",Dn(this.pillHost,{mode:n.mode,callable:o,voiceState:n.voiceState,connection:n.connection,voiceError:n.voiceError,invited:n.invited,personaName:this.persona.name,personaInitial:this.persona.initial,personaAvatarUrl:this.persona.avatarUrl,launcherLabel:this.launcherLabel,launcherCaption:this.launcherCaption,onCall:()=>this.openCall(),onMute:r=>this.voiceMode.setMuted(r),onEnd:()=>{this.voiceMode.stop(),this.ambience.stop(),this.store.dispatch({type:"set_mode",mode:"pill"})},onChat:()=>{n.invited&&this.store.dispatch({type:"set_invited",invited:!1}),this.store.dispatch({type:"set_mode",mode:"chat"})},onClose:()=>this.store.dispatch({type:"set_mode",mode:"pill"})})}openCall(){this.store.get().invited&&(this.merchantId===Wn&&this.publishWidgetMessage({type:"tour_request"}),this.store.dispatch({type:"set_invited",invited:!1})),this.inviteTimer&&(clearTimeout(this.inviteTimer),this.inviteTimer=null),this.store.dispatch({type:"set_mode",mode:"call"}),this.voiceMode.start(),this.ambience.start()}userText(n,o){pn(),this.store.dispatch({type:"user_input",text:n,mode:o});let r=this.store.get().sessionId;this.socket?.send(O({type:"user_text",sessionId:r,text:n,mode:o,visitorId:pe()}))}handleLiveKitData(n){let o;try{o=new TextDecoder().decode(n)}catch{return}let r=Ve(o);r&&this.handleAgentEvent(r,"livekit")}cardTap(n){let o=this.store.get().sessionId;this.socket?.send(O({type:"card_tap",sessionId:o,action:"cartAdd",sku:n.sku,variantId:n.variantId,qty:1}))}};function jn(){customElements.get(Vn)||customElements.define(Vn,ct)}window.__shoppingmateNav__={snapshot:()=>ee().text,keys:()=>ye(ee().text)};function Fr(){let e=document.currentScript instanceof HTMLScriptElement?document.currentScript:null,t=e?.dataset.id;if(!t){console.warn("[shoppingmate] data-id missing on script tag");return}let o=(e?.dataset.api??"https://api-production-1ea1.up.railway.app").trim(),r=document.querySelector("shoppingmate-widget");r&&(r.getAttribute("data-api")||r.setAttribute("data-api",o),r.getAttribute("data-id")||r.setAttribute("data-id",t)),jn();let i=()=>{let a=document.querySelector("shoppingmate-widget");if(a){a.getAttribute("data-api")||a.setAttribute("data-api",o),a.getAttribute("data-id")||a.setAttribute("data-id",t);return}let s=document.createElement("shoppingmate-widget");s.setAttribute("data-id",t),s.setAttribute("data-api",o),document.body.appendChild(s)};document.readyState==="loading"?document.addEventListener("DOMContentLoaded",i,{once:!0}):i()}Fr();})();
