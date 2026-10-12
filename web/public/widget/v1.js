"use strict";(()=>{var Yn=Object.defineProperty;var Jn=(e,t,n)=>t in e?Yn(e,t,{enumerable:!0,configurable:!0,writable:!0,value:n}):e[t]=n;var k=(e,t,n)=>Jn(e,typeof t!="symbol"?t+"":t,n);function re(e,t){let n=t.toLowerCase().replace(/[₹$£€]|rs\.?|inr|usd/g," ").replace(/\d+([.,]\d+)?/g," ").replace(/[^a-z\s]/g," ").replace(/\s+/g," ").trim().slice(0,40);return n.length<2||e==="text"?null:`${e}|${n}`}function be(e){let t=new Set;for(let n of e.split(`
`)){let o=/^\[e\d+\] ([a-z]+) "([^"]*)"/.exec(n);if(!o)continue;let r=re(o[1],o[2]);r&&t.add(r)}return[...t]}function Xn(e,t){if(e.length===0)return 0;let n=0;for(let o of e)t.has(o)&&(n+=1);return n/e.length}function Qn(e,t){try{return new RegExp(e).test(t)}catch{return!1}}function ft(e,t,n){let o=new Set(e),r=null,i=null;for(let s of n){if(s.skeleton.length<4)continue;let a=Xn(s.skeleton,o),l=Qn(s.urlPattern,t),u=a+(l?.05:0);a>=.7&&(!r||u>r.c)&&(r={t:s,c:u}),l&&a<.7&&(!i||a<i.coverage)&&(i={template:s,coverage:a})}return r?{template:r.t,coverage:Math.min(1,r.c),drift:null}:{template:null,coverage:0,drift:i}}var Zn=new Set(["the","a","an","to","of","on","in","and","or","section","button","link","card","tile","now"]),eo=[{keyword:"button",matchTag:/^(button)$/i,matchRole:"button"},{keyword:"link",matchTag:/^(a)$/i,matchRole:"link"},{keyword:"card",matchTag:/^(article|div|section)$/i},{keyword:"section",matchTag:/^(section|main|article)$/i}],to=.4;function X(e,t){if(t){let i=t.get(e.toLowerCase().trim());if(i)try{let s=document.querySelector(i);if(s instanceof HTMLElement&&J(s))return s}catch{}}let n=ie(e);if(n.size===0)return null;let o=no(document.body),r=null;for(let i of o){if(!i.visible)continue;let s=oo(i,e,n);s<to||(!r||s>r.score)&&(r={c:i,score:s})}return r?.c.element??null}function ie(e){return new Set(e.toLowerCase().replace(/[^a-z0-9 ]/g," ").split(/\s+/).filter(t=>t.length>0&&!Zn.has(t)))}function no(e){let t=[],n=document.createTreeWalker(e,NodeFilter.SHOW_ELEMENT),o=n.nextNode();for(;o;){if(o instanceof HTMLElement){let r=te(o);r&&t.push({element:o,role:o.getAttribute("role")??o.tagName.toLowerCase(),name:r,visible:J(o)})}o=n.nextNode()}return t}function te(e){let t=e.getAttribute("aria-labelledby");if(t){let i=t.split(/\s+/).map(s=>document.getElementById(s)?.textContent?.trim()??"").filter(Boolean);if(i.length>0)return i.join(" ")}let n=e.getAttribute("aria-label");if(n)return n.trim();if(e.id){let i=document.querySelector(`label[for="${ht(e.id)}"]`);if(i?.textContent)return i.textContent.trim()}let o=e.getAttribute("alt")??e.getAttribute("title");if(o)return o.trim();let r=(e.textContent??"").trim();return r&&r.length<200?r:""}function J(e){if(!e.isConnected)return!1;let t=e.ownerDocument.defaultView?.getComputedStyle(e);return t?!(t.display==="none"||t.visibility==="hidden"||t.opacity==="0"):!0}function oo(e,t,n){let o=ie(e.name);if(o.size===0)return 0;let r=0;for(let p of n)o.has(p)&&r++;let i=new Set([...n,...o]).size,s=i===0?0:r/i,a=0,l=t.toLowerCase();for(let p of eo)if(l.includes(p.keyword)&&(p.matchTag.test(e.element.tagName)||e.role===p.matchRole)){a=.15;break}let u=e.element.getAttribute("data-tour-stop"),d=0;if(u){let p=ie(u.replace(/-/g," ")),b=0;for(let S of n)p.has(S)&&b++;b>0&&(d=.5*(b/n.size))}return Math.min(1,s+a+d)}function ht(e){return e.replace(/(["\\])/g,"\\$1")}function ze(e,t){if(t){let i=t.get(e.toLowerCase().trim());if(i)try{let s=document.querySelector(i);if(s instanceof HTMLElement&&J(s))return s}catch{}}let n=ie(e);if(n.size===0)return null;let o=Array.from(document.querySelectorAll("input, textarea, select")).filter(i=>J(i)&&!ro(i)),r=null;for(let i of o){let s=so(i,n);s<=0||(!r||s>r.score)&&(r={el:i,score:s})}return r?.el??null}function ro(e){let t=(e.getAttribute("type")??"").toLowerCase();return t==="hidden"||t==="submit"||t==="button"||e.disabled}function io(e){let t=[],n=e.id;if(n){t.push(n);let l=document.querySelector(`label[for="${ht(n)}"]`);l?.textContent&&t.push(l.textContent)}let o=e.getAttribute("name");o&&t.push(o);let r=e.getAttribute("data-field")??e.getAttribute("data-testid");r&&t.push(r);let i=e.getAttribute("aria-label");i&&t.push(i);let s=e.getAttribute("placeholder");s&&t.push(s);let a=e.closest("label");return a?.textContent&&t.push(a.textContent),t}var ao=[["phone","mobile","cell","contact","phonenumber","tel","whatsapp"],["pincode","pin","postal","postcode","zip","zipcode"],["name","fullname"],["email","mail","emailaddress"],["address","street","addr","address1"],["city","town"],["state","province","region"],["landmark","apartment","flat","floor"]],yt=new Map;for(let e of ao)for(let t of e)yt.set(t,e[0]);function gt(e){return yt.get(e)??e}function so(e,t){let n=new Set([...t].map(gt)),o=0;for(let r of io(e)){let i=new Set([...ie(r)].map(gt));if(i.size===0)continue;let s=0;for(let l of n)i.has(l)&&s++;if(s===0)continue;let a=s/n.size;a>o&&(o=a)}return o}var we="data-sm-ref",co=6e3,ve=["a[href]","button","input","select","textarea","summary",'[role="button"]','[role="link"]','[role="tab"]','[role="radio"]','[role="checkbox"]','[role="switch"]','[role="option"]','[role="menuitem"]','[role="combobox"]'].join(","),bt='h1,h2,h3,[role="heading"],[role="alert"],[role="status"]',lo='dialog[open],[role="dialog"],[role="alertdialog"],[aria-modal="true"]',uo=/(₹|\$|£|€|Rs\.?\s?|INR\s?|USD\s?|AED\s?)\s?\d[\d,]*(\.\d+)?|\d[\d,]*(\.\d+)?\s?(₹|\$|£|€)/,Ue=new Map;function z(e){let t=e;for(;t;){if(t instanceof Element){if(t.tagName==="SHOPPINGMATE-WIDGET")return!0;for(let n of Array.from(t.attributes))if(n.name.startsWith("data-shoppingmate"))return!0}t=t.parentNode}return!1}function po(e){return e.closest('[aria-hidden="true"],[inert]')!==null}function mo(){return(document.body?.getBoundingClientRect().width??0)>0}function fo(e,t){if(!t)return!0;let n=e.getBoundingClientRect();return n.width>0||n.height>0}function go(e){let t=e.getAttribute("role");if(t)return t;let n=e.tagName.toLowerCase();if(n==="a")return"link";if(/^h[1-6]$/.test(n))return"heading";if(n==="select")return"select";if(n==="textarea")return"textbox";if(n==="input"){let o=(e.getAttribute("type")??"text").toLowerCase();return o==="radio"||o==="checkbox"?o:o==="submit"||o==="button"||o==="reset"?"button":o==="number"?"spinbutton":"textbox"}return n}function ho(e){let t=te(e);if(t)return t;if(e instanceof HTMLInputElement||e instanceof HTMLTextAreaElement||e instanceof HTMLSelectElement){let n=e.closest("label")?.textContent?.trim();if(n)return n}return e instanceof HTMLInputElement||e instanceof HTMLTextAreaElement?e.placeholder||e.name||"":e instanceof HTMLSelectElement&&e.name||""}function Q(e,t=80){let n=e.replace(/\s+/g," ").trim();return n.length>t?`${n.slice(0,t-1)}\u2026`:n}function yo(e,t){let n=[];e instanceof HTMLInputElement&&(t==="radio"||t==="checkbox")?e.checked&&n.push("checked"):e.getAttribute("aria-checked")==="true"&&n.push("checked"),e.getAttribute("aria-selected")==="true"&&n.push("selected"),e.getAttribute("aria-pressed")==="true"&&n.push("pressed");let o=e.getAttribute("aria-expanded");if(o==="true"&&n.push("expanded"),o==="false"&&n.push("collapsed"),(e.disabled||e.getAttribute("aria-disabled")==="true")&&n.push("disabled"),e instanceof HTMLInputElement&&t!=="radio"&&t!=="checkbox"&&((e.getAttribute("type")??"text").toLowerCase()==="password"?e.value&&n.push("filled"):e.value&&n.push(`value="${Q(e.value,40)}"`)),e instanceof HTMLTextAreaElement&&e.value&&n.push(`value="${Q(e.value,40)}"`),e instanceof HTMLSelectElement){let r=e.selectedOptions[0];r&&n.push(`value="${Q(r.textContent??"",40)}"`)}return n}function bo(e){let t=e.getBoundingClientRect();if(t.width===0&&t.height===0&&t.top===0)return!0;let n=window.innerHeight||800;return t.bottom>-n&&t.top<n*2}function vo(e){return e.closest('footer,[role="contentinfo"]')!==null}function wo(){return Array.from(document.querySelectorAll(lo)).filter(t=>J(t)&&!z(t))}function xo(e){if(e.children.length>0)return!1;let t=(e.textContent??"").trim();return!t||t.length>40?!1:uo.test(t)}function ne(e={}){let t=e.maxChars??co,n=[];for(let f of Array.from(document.querySelectorAll(`[${we}]`)))f.removeAttribute(we);Ue=new Map;let o=wo(),r=[],i=new Set,s=0,a=mo(),l=(f,c,g)=>{if(i.has(f)||z(f)||!J(f)||po(f)||!fo(f,a)||f instanceof HTMLInputElement&&f.type==="hidden")return;i.add(f);let C=c==="price"?"text":go(f),w=c==="price"?Q(f.textContent??"",40):Q(ho(f)),E=c==="price"?[]:yo(f,C);if(!w&&E.length===0&&c!=="interactive"||!w&&c==="interactive"&&(C==="link"||C==="button"))return;let P=!g&&vo(f),D=!g&&f.closest('nav,header,[role="navigation"],[role="banner"]')!==null;if(e.collapse&&C==="link"&&(P||D)){let K=re(C,w);if(K&&e.collapse.has(K)){n.length<12&&w.length<=24&&!/\d{3}|@/.test(w)&&!n.includes(w)&&n.push(w);return}}let $=g?0:c==="interactive"?2:c==="context"?1:2;!g&&!bo(f)&&($+=3),P&&($+=4),D&&($+=2);let ge=E.length>0?` (${E.join(", ")})`:"",j=`${C} "${w}"${ge}`;r.push({el:f,line:j,priority:$,order:s++})};for(let f of o){let c=Q(te(f)||"dialog",60);r.push({el:f,line:`dialog "${c}" (open)`,priority:0,order:s++}),i.add(f);for(let g of Array.from(f.querySelectorAll(`${ve},${bt}`)))l(g,g.matches(ve)?"interactive":"context",!0)}let u=document.querySelector('main,[role="main"]')??document.body,d=u===document.body?[document.body]:[u,document.body];for(let f of d)for(let c of Array.from(f.querySelectorAll(`${ve},${bt}`)))l(c,c.matches(ve)?"interactive":"context",!1);let p=0;for(let f of Array.from(u.querySelectorAll("span,div,p,strong,b,s,del,ins,bdi"))){if(p>=15)break;if(!xo(f))continue;let c=r.length;l(f,"price",!1),r.length>c&&(p+=1)}let b=[`[page] ${Q(document.title||"",70)} \xB7 ${location.pathname}`,...e.preface??[]];n.length>0&&b.push(`[site links] ${n.join(", ")} (standard site navigation \u2014 use site.navigate)`);let S=[...r].sort((f,c)=>f.priority-c.priority||f.order-c.order),_=[],R=b.join(`
`).length+1;for(let f of S){let c=f.line.length+8;R+c>t||(_.push(f),R+=c)}_.sort((f,c)=>f.order-c.order);let y=[...b],T=0;for(let f of _){T+=1;let c=`e${T}`;f.el.setAttribute(we,c),Ue.set(c,f.el),y.push(`[${c}] ${f.line}`)}let x=r.length-_.length;x>0&&y.push(`\u2026 ${x} more elements not shown (lower on the page or in the footer)`);let L=y.join(`
`);return{text:L,refs:T,chars:L.length,truncated:x}}function xe(e){let t=e.replace(/^\[|\]$/g,"").trim(),n=Ue.get(t);if(n?.isConnected)return n;try{let o=document.querySelector(`[${we}="${CSS.escape(t)}"]`);return o?.isConnected?o:null}catch{return null}}var vt={start:()=>{},stop:()=>{}};function je(e){if(!e||typeof window>"u")return vt;let t=window.AudioContext??window.webkitAudioContext;if(!t)return vt;let n=null,o=null;return{start(){if(!n)try{n=new t;let r=Math.floor(n.sampleRate*2),i=n.createBuffer(1,r,n.sampleRate),s=i.getChannelData(0),a=0;for(let d=0;d<r;d++){let p=Math.random()*2-1;a=(a+.02*p)/1.02,s[d]=a*3.5}o=n.createBufferSource(),o.buffer=i,o.loop=!0;let l=n.createBiquadFilter();l.type="lowpass",l.frequency.value=900;let u=n.createGain();u.gain.value=.02,o.connect(l).connect(u).connect(n.destination),o.start(),n.resume?.().catch(()=>{})}catch{this.stop()}},stop(){try{o?.stop()}catch{}o=null;try{n?.close()}catch{}n=null}}}function ae(){let e=globalThis,t=e.SpeechRecognition??e.webkitSpeechRecognition;if(!t)return null;let n=new t;n.continuous=!0,n.interimResults=!1,n.lang="en-US";let o=!1,r=[],i=[];return n.onresult=s=>{for(let a=0;a<s.results.length;a+=1){let l=s.results[a];if(l?.isFinal){let u=l[0]?.transcript?.trim();if(u)for(let d of r)d(u)}}},n.onerror=s=>{for(let a of i)a(String(s?.error??"unknown"))},n.onend=()=>{o=!1},{start:()=>{if(!o){o=!0;try{n.start()}catch{}}},stop:()=>{if(o){o=!1;try{n.stop()}catch{}}},onFinal:s=>{r.push(s)},onError:s=>{i.push(s)},isActive:()=>o}}function ke(){let e=globalThis.speechSynthesis;if(!e)return{speak:async()=>{},cancel:()=>{},available:()=>!1};function t(){if(!e)return null;let n=e.getVoices();return n.find(o=>o.lang.startsWith("en-")&&o.default)??n.find(o=>o.lang.startsWith("en-"))??n[0]??null}return{speak:n=>new Promise(o=>{let r=new SpeechSynthesisUtterance(n),i=t();i&&(r.voice=i),r.rate=1,r.onend=()=>o(),r.onerror=()=>o(),e.speak(r)}),cancel:()=>e.cancel(),available:()=>!0}}function oe(e,t){let n="idle",o=!1,r=[],i=s=>{if(n!==s){n=s;for(let a of r)a(s)}};return{start:()=>{if(n==="idle"){if(o){i("muted");return}e?.start(),i("listening")}},stop:()=>{e?.stop(),t.cancel(),i("idle")},speak:async s=>{n!=="idle"&&(e?.stop(),i("speaking"),await t.speak(s),o?i("muted"):(e?.start(),i("listening")))},setMuted:s=>{o=s,s?(e?.stop(),n==="listening"&&i("muted")):n==="muted"&&(e?.start(),i("listening"))},getState:()=>n,onStateChange:s=>{r.push(s)}}}function ko(e){if(!e||typeof e.type!="string")return!1;switch(e.type){case"navigate":return typeof e.path=="string";case"click":return typeof e.intent=="string"&&(e.ref===void 0||typeof e.ref=="string");case"scroll_to":case"highlight":case"point_at":case"demo_click":return typeof e.intent=="string";case"cart_add":case"cart_set_qty":return typeof e.sku=="string"&&typeof e.qty=="number";case"open_cart":case"cart_clear":case"cart_get":case"checkout_place":case"checkout_state":case"page_snapshot":return!0;case"apply_coupon":return typeof e.code=="string";case"product_lookup":return typeof e.handle=="string";case"checkout_fill":return!!e.details&&typeof e.details.name=="string"&&typeof e.details.phone=="string"&&typeof e.details.email=="string"&&typeof e.details.address=="string"&&typeof e.details.city=="string"&&typeof e.details.state=="string"&&typeof e.details.pincode=="string"&&(e.details.payment==="cod"||e.details.payment==="prepaid");case"form_fill":return Array.isArray(e.fields)&&e.fields.every(t=>t&&typeof t.field=="string"&&typeof t.value=="string"&&(t.ref===void 0||typeof t.ref=="string"));case"form_read":return e.fields===void 0||Array.isArray(e.fields);default:return!1}}function O(e){return JSON.stringify(e)}function We(e){let t;try{t=JSON.parse(e)}catch{return null}if(!t||typeof t!="object")return null;let n=t;switch(n.type){case"thinking":return{type:"thinking"};case"say":return typeof n.text=="string"?{type:"say",text:n.text}:null;case"say_partial":return typeof n.text=="string"?{type:"say_partial",text:n.text}:null;case"user_text":return typeof n.text=="string"?{type:"user_text",text:n.text}:null;case"cards":return Array.isArray(n.items)?{type:"cards",items:n.items}:null;case"tool_result":return typeof n.toolName!="string"||typeof n.ok!="boolean"?null:{type:"tool_result",toolName:n.toolName,ok:n.ok,summary:typeof n.summary=="string"?n.summary:void 0};case"checkout_redirect":return typeof n.url=="string"?{type:"checkout_redirect",url:n.url}:null;case"cap_warning":return n.reason!=="turns"&&n.reason!=="voice_ms"&&n.reason!=="duration_ms"||typeof n.remaining!="number"?null:{type:"cap_warning",reason:n.reason,remaining:n.remaining};case"end_of_turn":return{type:"end_of_turn"};case"session_closed":return n.reason!=="user"&&n.reason!=="cap"&&n.reason!=="error"?null:{type:"session_closed",reason:n.reason};case"host_action_request":{if(typeof n.callId!="string"||!n.action)return null;let o=n.action;return ko(o)?{type:"host_action_request",callId:n.callId,action:o}:null}case"persona_swap":return typeof n.personaId=="string"?{type:"persona_swap",personaId:n.personaId}:null;case"agent_warmed":return{type:"agent_warmed"};case"agent_ready":return{type:"agent_ready"};default:return null}}var wt="https://cdn.jsdelivr.net/npm",_o="2.7.0",So="0.3.0",_e=null;function Co(){return _e||(_e=import(`${wt}/@livekit/krisp-noise-filter@${So}/dist/index.mjs`).catch(()=>null),_e)}async function To(e){let t=await Co();if(!t?.KrispNoiseFilter||t.isKrispNoiseFilterSupported&&!t.isKrispNoiseFilterSupported())return;let n=e.localParticipant.getTrackPublication?.("microphone"),o=n?.audioTrack??n?.track;o?.setProcessor&&await o.setProcessor(t.KrispNoiseFilter())}var Z=null;function xt(){return Z||(typeof globalThis.__SHOPPINGMATE_LIVEKIT_LOADER__=="function"?(Z=globalThis.__SHOPPINGMATE_LIVEKIT_LOADER__(),Z):(Z=import(`${wt}/livekit-client@${_o}/dist/livekit-client.esm.mjs`),Z))}function kt(){xt().catch(()=>{Z=null})}function Eo(){try{if(typeof window<"u"){let t=window;if(typeof t.__SM_AUDIO_FULL__=="boolean")return t.__SM_AUDIO_FULL__}let e=new URLSearchParams(location.search).get("smAudioFull");return!(e==="0"||e==="false")}catch{return!0}}async function _t(e){let t=await xt(),n=Eo(),o=new t.Room({audioCaptureDefaults:{echoCancellation:!0,noiseSuppression:!0,autoGainControl:n,channelCount:1}}),r=new Map,i=!1;o.on("trackSubscribed",a=>{let l=a;if(l.kind!=="audio")return;let u=l.attach();u.style.display="none",u.muted=i,document.body.appendChild(u),r.set(a,u)}),o.on("trackUnsubscribed",a=>{let l=r.get(a);l&&(l.remove(),r.delete(a)),a.detach?.()});let s=[];return o.on("activeSpeakersChanged",a=>{let u=(a??[]).some(d=>!d.isLocal);for(let d of s)d(u)}),await o.connect(e.wsUrl,e.token),{setMicEnabled:async a=>{await o.localParticipant.setMicrophoneEnabled(a),a&&n&&To(o).catch(()=>{})},onData:a=>{o.on("dataReceived",l=>{l instanceof Uint8Array&&a(l)})},onAgentSpeaking:a=>{s.push(a)},setAgentAudioMuted:a=>{i=a;for(let l of r.values())l.muted=a},onReconnected:a=>{o.on("reconnected",()=>a())},publishData:a=>o.localParticipant.publishData(a,{reliable:!0}),disconnect:async()=>{for(let a of r.values())a.remove();r.clear(),await o.disconnect()}}}function St(e){let t="idle",n=null,o=null,r=!1,i=!1,s=!1,a=6e4,l=null,u=()=>{l&&clearTimeout(l),l=null},d=0,p=null,b=c=>{p&&!(c in p)&&(p[c]=Math.round(performance.now()-d))},S=()=>{if(!p||!n)return;let c=O({type:"voice_timing",sessionId:e.sessionId,timings:p});p=null,n.publishData(new TextEncoder().encode(c)).catch(()=>{})},_=[],R=[],y=c=>{if(t!==c){t=c;for(let g of _)g(c)}},T=c=>{let g=c instanceof Error?c.message:String(c),C=c instanceof Error?c.name:"",w;/permissions? policy|feature policy/i.test(g)?w="mic_policy_blocked":C==="NotAllowedError"||/denied|permission/i.test(g)?w="mic_denied":C==="NotFoundError"||/no.*microphone|not.*found/i.test(g)?w="mic_unavailable":/connect|network|websocket|timeout|token/i.test(g)?w="connect_failed":w="unknown";for(let E of R)E({code:w,message:g})},x=async c=>{await c.setMicEnabled(!r);let g=new TextEncoder().encode(O({type:"start_voice",sessionId:e.sessionId}));await c.publishData(g)},L=()=>{u(),!s&&(l=setTimeout(()=>{s||!n||(n.disconnect().catch(()=>{}),n=null,o=null)},a))},f=()=>n?(L(),Promise.resolve(n)):o||(o=(async()=>{let c=await _t({wsUrl:e.wsUrl,token:e.token,roomName:e.roomName});return c.onData(g=>e.onTranscriptEvent(g)),c.onAgentSpeaking(g=>{g&&p&&(b("first_audio"),S()),!r&&(g&&(i=!0),i&&y(g?"speaking":"listening"))}),c.onReconnected(()=>{s&&(y("connecting"),i=!1,x(c).catch(g=>console.warn("[voiceModeLiveKit] re-start after reconnect failed",g)))}),n=c,L(),c})(),o.catch(()=>{o=null}),o);return{warm:()=>{f().catch(c=>console.warn("[voiceModeLiveKit] warm failed",c))},start:()=>{t==="idle"&&(y("connecting"),i=!1,u(),d=performance.now(),p={was_warm:n?1:0},(async()=>{try{let c=await f();u(),b("room_connected"),await x(c),b("mic_on"),s=!0,r&&y("muted")}catch(c){throw y("idle"),T(c),c}})().catch(c=>{console.warn("[voiceModeLiveKit] start failed",c)}))},stop:()=>{u(),p&&(b("hung_up"),S()),n?.disconnect().catch(()=>{}),n=null,o=null,s=!1,y("idle")},speak:async()=>{},setMuted:c=>{r=c,n?.setMicEnabled(!c).catch(()=>{}),n?.setAgentAudioMuted(c),c?y("muted"):t==="muted"&&y("listening")},getState:()=>t,onStateChange:c=>{_.push(c)},onError:c=>{R.push(c)},signalAgentReady:()=>{i=!0,b("agent_ready"),t==="connecting"&&y(r?"muted":"listening")},publishData:async c=>{n&&await n.publishData(c)}}}function Se(e){return e.stack==="web-speech"?oe(ae(),ke()):e.stack==="live-kit"?e.livekit?St(e.livekit):(console.warn("[voiceModeFactory] live-kit stack requires livekit opts; returning null \u2192 caller falls back to chat"),null):null}async function Ct(e){if(e.platform!=="shopify")return;let t=e.fetchFn??fetch;try{await t("/cart/update.js",{method:"POST",credentials:"same-origin",headers:{"Content-Type":"application/json"},body:JSON.stringify({attributes:{sm_visitor_id:e.visitorId}})})}catch{}}var Fe={"Content-Type":"application/json"};function Tt(e){let t=Number(String(e).trim());return Number.isFinite(t)&&t>0?t:null}function Be(e){try{let t={cart:e},n=["cart:refresh","cart:updated","cart:change","cart:build","cart:rerender","ajaxCart:afterCartLoad","cart.requestComplete","added.ajaxProduct"];for(let i of n)document.dispatchEvent(new CustomEvent(i,{bubbles:!0,detail:t})),window.dispatchEvent(new CustomEvent(i,{bubbles:!0,detail:t}));let o=window;typeof o.getCartUpdate=="function"&&o.getCartUpdate(),typeof o.after_add_to_cart=="function"&&o.after_add_to_cart(e);let r=o.jQuery;if(r)try{r(document.body).trigger("cart:updated",[e]),r(document.body).trigger("added.ajaxProduct")}catch{}}catch{}Mo()}var Ao=["cart-icon-bubble","cart-live-region-text","cart-notification-button","cart-drawer"];async function Mo(e=fetch){try{let t=Ao.filter(i=>document.getElementById(`shopify-section-${i}`)||document.getElementById(i));if(t.length===0)return 0;let n=await e(`${location.pathname}?sections=${t.join(",")}`,{credentials:"same-origin"});if(!n.ok)return 0;let o=await n.json(),r=0;for(let[i,s]of Object.entries(o)){if(!s)continue;let a=document.getElementById(`shopify-section-${i}`)??document.getElementById(i);if(!a)continue;let l=new DOMParser().parseFromString(s,"text/html"),u=l.getElementById(`shopify-section-${i}`)??l.querySelector(".shopify-section")??l.body;a.innerHTML=u.innerHTML,r+=1}return r}catch{return 0}}async function Et(e,t=fetch){let n=String(e??"").trim().replace(/^\/?products\//,"").replace(/[?#].*$/,"").replace(/\/$/,"");if(!n)return{ok:!1,reason:"not_found"};try{let o=await t(`/products/${encodeURIComponent(n)}.js`,{credentials:"same-origin"});if(!o.ok)return{ok:!1,reason:"not_found"};let r=await o.json(),i=(r.variants??[]).slice(0,30).map(s=>`${s.title??"Default"} (variantId ${s.id}, ${s.available?"in stock":"SOLD OUT"}${s.price!=null?`, ${(s.price/100).toFixed(2)}`:""})`).join("; ");return{ok:!0,channel:"shopify-ajax",values:{title:r.title??n,available:String(r.available??!1),variants:i}}}catch{return{ok:!1,reason:"not_found"}}}async function qe(e){try{let t=await e("/cart.js",{credentials:"same-origin"});return t.ok?await t.json():null}catch{return null}}function Ge(e){let t=(e.items??[]).map(n=>`${n.product_title??"item"}${n.variant_title?` ${n.variant_title}`:""} x${n.quantity}`).join(", ");return{count:String(e.item_count??0),items:t,subtotal:e.total_price!=null?(e.total_price/100).toFixed(2):""}}async function At(e,t,n=fetch){let o=Tt(e);if(o==null)return{ok:!1,reason:"not_found"};try{if(!(await n("/cart/add.js",{method:"POST",credentials:"same-origin",headers:Fe,body:JSON.stringify({id:o,quantity:t>0?t:1})})).ok)return{ok:!1,reason:"not_found"};let i=await qe(n);return i&&i.items.some(s=>s.id===o)?(Be(i),{ok:!0,values:Ge(i)}):{ok:!1,reason:"not_found"}}catch{return{ok:!1,reason:"not_found"}}}async function Mt(e=fetch){let t=await qe(e);return t?{ok:!0,values:Ge(t)}:{ok:!1,reason:"not_found"}}async function Lt(e,t,n=fetch){let o=Tt(e);if(o==null)return{ok:!1,reason:"not_found"};try{let r=await n("/cart/change.js",{method:"POST",credentials:"same-origin",headers:Fe,body:JSON.stringify({id:o,quantity:Math.max(0,t)})});if(!r.ok)return{ok:!1,reason:"not_found"};let i=await r.json().catch(()=>null);return Be(i),i?{ok:!0,values:Ge(i)}:{ok:!0}}catch{return{ok:!1,reason:"not_found"}}}async function It(e=fetch){try{return(await e("/cart/clear.js",{method:"POST",credentials:"same-origin",headers:Fe})).ok?(Be(await qe(e)),{ok:!0}):{ok:!1,reason:"not_found"}}catch{return{ok:!1,reason:"not_found"}}}async function Ht(e,t=fetch){let n=String(e??"").trim();if(!n)return{ok:!1,reason:"not_found"};try{return await t(`/discount/${encodeURIComponent(n)}`,{method:"GET",credentials:"same-origin",redirect:"manual"})?{ok:!0}:{ok:!1,reason:"not_found"}}catch{return{ok:!1,reason:"not_found"}}}var Rt="/wp-json/wc/store/v1",se=null;function Lo(){let e={"Content-Type":"application/json"};return se&&(e.Nonce=se,e["X-WC-Store-API-Nonce"]=se),e}function Pt(e){let t=e.headers.get("Nonce")??e.headers.get("X-WC-Store-API-Nonce");t&&(se=t)}async function F(e){try{let t=await e(`${Rt}/cart`,{credentials:"same-origin"});return Pt(t),t.ok?await t.json():null}catch{return null}}function Te(e){let t=e.totals?.currency_minor_unit??2,n=e.totals?.total_price;return{count:String(e.items_count??0),items:(e.items??[]).map(o=>`${o.name??"item"} x${o.quantity}`).join(", "),subtotal:n!=null?(Number(n)/10**t).toFixed(t):""}}function Ke(){try{document.body.dispatchEvent(new CustomEvent("wc-blocks_added_to_cart",{bubbles:!0}));let e=window.jQuery;e?.(document.body).trigger("wc_fragment_refresh")}catch{}}function $t(e){let t=Number(String(e).trim());return Number.isFinite(t)&&t>0?t:null}async function Ce(e,t,n){se||await F(n);let o=await n(`${Rt}${e}`,{method:"POST",credentials:"same-origin",headers:Lo(),body:JSON.stringify(t)});return Pt(o),o}async function Nt(e,t,n=fetch){let o=$t(e);if(o==null)return{ok:!1,reason:"not_found"};try{let r=(await F(n))?.items.find(l=>l.id===o)?.quantity??0;if(!(await Ce("/cart/add-item",{id:o,quantity:t>0?t:1},n)).ok)return{ok:!1,reason:"not_found"};let s=await F(n),a=s?.items.find(l=>l.id===o)?.quantity??0;return!s||a<=r?{ok:!1,reason:"not_found"}:(Ke(),{ok:!0,channel:"woo-store-api",verified:!0,values:Te(s)})}catch{return{ok:!1,reason:"not_found"}}}async function Ot(e=fetch){let t=await F(e);return t?{ok:!0,channel:"woo-store-api",values:Te(t)}:{ok:!1,reason:"not_found"}}async function Dt(e,t,n=fetch){let o=$t(e);if(o==null)return{ok:!1,reason:"not_found"};try{let r=(await F(n))?.items.find(l=>l.id===o);if(!r)return{ok:!1,reason:"not_found"};if(!(t<=0?await Ce("/cart/remove-item",{key:r.key},n):await Ce("/cart/update-item",{key:r.key,quantity:t},n)).ok)return{ok:!1,reason:"not_found"};let s=await F(n),a=s?.items.find(l=>l.id===o)?.quantity??0;return!s||a!==Math.max(0,t)?{ok:!1,reason:"not_found"}:(Ke(),{ok:!0,channel:"woo-store-api",verified:!0,values:Te(s)})}catch{return{ok:!1,reason:"not_found"}}}async function Vt(e=fetch){try{let t=await F(e);for(let o of t?.items??[])await Ce("/cart/remove-item",{key:o.key},e);let n=await F(e);return!n||n.items.length>0?{ok:!1,reason:"not_found"}:(Ke(),{ok:!0,channel:"woo-store-api",verified:!0,values:Te(n)})}catch{return{ok:!1,reason:"not_found"}}}var Io="data-shoppingmate-bot-cursor",zt="data-shoppingmate-cursor-keyframes",ce=null,Ye=window.innerWidth-80,Je=window.innerHeight-80;function Ut(){if(ce&&ce.isConnected)return ce;Ho();let e=document.createElement("div");return e.setAttribute(Io,""),e.innerHTML=`
    <svg width="22" height="22" viewBox="0 0 22 22" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path d="M3 2 L3 17 L7 13 L9.5 19 L12 18 L9.5 12 L15 12 Z"
            fill="#111827" stroke="#fff" stroke-width="1.2" stroke-linejoin="round"/>
    </svg>
  `,Object.assign(e.style,{position:"fixed",left:"0",top:"0",transform:`translate(${Ye}px, ${Je}px)`,transition:"transform 480ms cubic-bezier(0.22, 1, 0.36, 1), opacity 200ms",pointerEvents:"none",zIndex:"2147483647",opacity:"0",willChange:"transform, opacity",filter:"drop-shadow(0 2px 6px rgba(0,0,0,0.25))"}),document.body.appendChild(e),ce=e,e}function Ho(){if(document.head.querySelector(`style[${zt}]`))return;let e=document.createElement("style");e.setAttribute(zt,""),e.textContent=`
    @keyframes shoppingmate-cursor-click {
      0%   { transform: var(--sm-cursor-pos) scale(1); }
      40%  { transform: var(--sm-cursor-pos) scale(0.72); }
      100% { transform: var(--sm-cursor-pos) scale(1); }
    }
  `,document.head.appendChild(e)}function Ro(e){let t=e.getBoundingClientRect();return{x:t.left+t.width/2-6,y:t.top+t.height/2-6}}function ee(e,t=480){let n=Ut(),{x:o,y:r}=Ro(e);return n.style.transitionDuration=`${t}ms, 200ms`,n.style.opacity="1",n.style.transform=`translate(${o}px, ${r}px)`,Ye=o,Je=r,new Promise(i=>setTimeout(i,t))}function le(){let e=Ut();return e.style.setProperty("--sm-cursor-pos",`translate(${Ye}px, ${Je}px)`),e.style.animation="shoppingmate-cursor-click 280ms ease-out",new Promise(t=>{let n=()=>{e.style.animation="",e.removeEventListener("animationend",n),t()};e.addEventListener("animationend",n),setTimeout(n,360)})}function B(e=600){let t=ce;t&&setTimeout(()=>{t.style.opacity="0"},e)}function Po(e,t){let n=e instanceof HTMLTextAreaElement?HTMLTextAreaElement.prototype:e instanceof HTMLSelectElement?HTMLSelectElement.prototype:HTMLInputElement.prototype,o=Object.getOwnPropertyDescriptor(n,"value");o?.set?o.set.call(e,t):e.value=t,e.dispatchEvent(new Event("input",{bubbles:!0})),e.dispatchEvent(new Event("change",{bubbles:!0}))}function Xe(e){return e.value??""}var jt="sm_selector_cache_v1";function $o(){try{return JSON.parse(localStorage.getItem(jt)??"{}")}catch{return{}}}function No(e){try{localStorage.setItem(jt,JSON.stringify(e))}catch{}}function Oo(e){return`${location.pathname}::${e}`}function Do(e){let t=e.getAttribute("data-sm-field");if(t)return`[data-sm-field="${CSS.escape(t)}"]`;if(e.id)return`#${CSS.escape(e.id)}`;let n=e.getAttribute("name");return n?`[name="${CSS.escape(n)}"]`:null}function Vo(e,t){let n=$o(),o=Oo(e),r=n[o];if(r)try{let s=document.querySelector(r);if(s?.isConnected)return s}catch{}let i=null;try{i=document.querySelector(`[data-sm-field="${CSS.escape(e)}"]`)}catch{i=null}if(i||(i=ze(e,t)),i){let s=Do(i);s&&(n[o]=s,No(n))}return i}function Wt(e,t){let n={},o=[],r=!1;for(let{field:i,value:s,ref:a}of e){let l=a?xe(a):null,u=l&&/^(INPUT|TEXTAREA|SELECT)$/.test(l.tagName)?l:Vo(i,t);if(!u){o.push({field:i,ok:!1,value:""});continue}r=!0,Po(u,s);let d=Xe(u);n[i]=d,o.push({field:i,ok:d===s,value:d})}return r?{ok:!0,values:n,filled:o}:{ok:!1,reason:"not_found"}}function Ft(e,t){let n={};if(e&&e.length>0){for(let r of e){let i=ze(r,t);i&&(n[r]=Xe(i))}return{ok:!0,values:n}}let o=document.querySelectorAll("input, textarea, select");for(let r of o){let i=(r.getAttribute("type")??"").toLowerCase();if(i==="password"||i==="hidden")continue;let s=r.getAttribute("name")??r.id;s&&(n[s]=Xe(r))}return{ok:!0,values:n}}var zo="data-shoppingmate-pulse-ring";function qt(e,t){let n=e.getBoundingClientRect(),o=document.createElement("div");o.setAttribute(zo,""),Object.assign(o.style,{position:"fixed",left:`${n.left-6}px`,top:`${n.top-6}px`,width:`${n.width+12}px`,height:`${n.height+12}px`,borderRadius:"14px",boxShadow:"0 0 0 3px rgba(139,92,246,0.85), 0 0 24px rgba(139,92,246,0.55)",pointerEvents:"none",zIndex:"2147483646",animation:"shoppingmate-pulse 1.2s ease-in-out infinite"}),Uo(),document.body.appendChild(o);let r=!1,i=()=>{r||(r=!0,o.remove())};return setTimeout(i,t),i}var Bt=!1;function Uo(){if(Bt)return;Bt=!0;let e=document.createElement("style");e.textContent=`@keyframes shoppingmate-pulse {
    0%, 100% { transform: scale(1); opacity: 1; }
    50% { transform: scale(1.04); opacity: 0.85; }
  }`,document.head.appendChild(e)}var ue=null,Ee=null,Qe=new Set;function Gt(e){ue=e,Ee=null,Qe.clear()}function Ae(e=fetch){if(!ue)return Promise.resolve([]);if(!Ee){let{apiBase:t,merchantId:n}=ue;Ee=e(`${t}/v1/site-templates/${encodeURIComponent(n)}`).then(o=>o.ok?o.json():{templates:[]}).then(o=>Array.isArray(o.templates)?o.templates:[]).catch(()=>[])}return Ee}function Ze(e,t,n,o=fetch){if(!ue)return;let r=`${e}:${t}`;if(Qe.has(r))return;Qe.add(r);let{apiBase:i,merchantId:s,sessionId:a}=ue;o(`${i}/v1/site-templates/${encodeURIComponent(s)}/signal`,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({kind:e,templateId:t,coverage:n,sessionId:a,path:location.pathname}),keepalive:!0}).catch(()=>{})}var jo=["[data-cart-count]","#cart-icon-bubble",".cart-count",".cart-count-bubble",'[class*="cart-count"]','[class*="CartCount"]'].join(",");function Kt(){return(document.querySelector(jo)?.textContent??"").replace(/\s+/g," ").trim()}function Yt(){return Array.from(document.querySelectorAll('dialog[open],[role="dialog"],[aria-modal="true"]')).filter(e=>!z(e)&&e.getAttribute("aria-hidden")!=="true").length}function Jt(e){let t=e;return[e.getAttribute("aria-expanded"),e.getAttribute("aria-checked"),e.getAttribute("aria-selected"),e.getAttribute("aria-pressed"),typeof t.checked=="boolean"?String(t.checked):"",e.className].join("|")}async function et(e,t,n=1500){let o=location.href,r=Kt(),i=Yt(),s=e?Jt(e):"",a=0,l=new MutationObserver(d=>{for(let p of d)z(p.target)||p.type==="attributes"&&p.attributeName==="data-sm-ref"||(a+=1)});l.observe(document.body,{subtree:!0,childList:!0,attributes:!0,characterData:!0});let u=()=>{if(location.href!==o)return{verified:!0,observed:`navigated to ${location.pathname}`};let d=Kt();if(d!==r)return{verified:!0,observed:`cart count ${r||"0"} \u2192 ${d||"0"}`};let p=Yt();return p>i?{verified:!0,observed:"a dialog/drawer opened"}:p<i?{verified:!0,observed:"a dialog/drawer closed"}:e?.isConnected&&Jt(e)!==s?{verified:!0,observed:"the control changed state"}:a>0?{verified:!0,observed:"the page updated"}:null};try{await t();let d=Date.now()+n;await new Promise(b=>setTimeout(b,50));let p=u();for(;!p&&Date.now()<d;)await new Promise(b=>setTimeout(b,100)),p=u();return p??{verified:!1,observed:"nothing changed on the page"}}finally{l.disconnect()}}var Le=null;function Xt(e){Le=e??null}function Me(){if(Le==="shopify")return!0;if(Le)return!1;try{return typeof window.Shopify<"u"}catch{return!1}}function de(){return Me()?"shopify-ajax":Le==="woocommerce"?"woo-store-api":"storefront-hooks"}async function q(e,t){let n=await t;return n.ok?{channel:e,...n}:n}async function Qt(e){switch(e.type){case"navigate":return tt(e.path);case"scroll_to":return nr(e.intent);case"highlight":return or(e.intent,e.durationMs??2e3);case"click":return e.ref?Fo(e.ref,e.intent):rr(e.intent);case"point_at":return ir(e.intent);case"demo_click":return ar(e.intent);case"cart_add":{let t=de();return t==="shopify-ajax"?q(t,At(e.sku,e.qty)):t==="woo-store-api"?Nt(e.sku,e.qty):q(t,Ko(e.sku,e.qty))}case"open_cart":return de()==="woo-store-api"||Me()?tt("/cart"):Yo();case"cart_set_qty":{let t=de();return t==="shopify-ajax"?q(t,Lt(e.sku,e.qty)):t==="woo-store-api"?Dt(e.sku,e.qty):q(t,Qo(e.sku,e.qty))}case"cart_clear":{let t=de();return t==="shopify-ajax"?q(t,It()):t==="woo-store-api"?Vt():q(t,Xo())}case"cart_get":{let t=de();return t==="shopify-ajax"?q(t,Mt()):t==="woo-store-api"?Ot():q(t,Jo())}case"product_lookup":return Me()?Et(e.handle):{ok:!1,reason:"not_found"};case"apply_coupon":return Me()?Ht(e.code):Zo(e.code);case"checkout_fill":return qo(e.details);case"checkout_place":return Go();case"checkout_state":return Bo();case"form_fill":return Wt(e.fields);case"form_read":return Ft(e.fields);case"page_snapshot":return Wo()}}var Ie=null;async function Wo(){let e=performance.now(),t=ne(),n={};Ie=null;let o=await Ae();if(o.length>0){let r=ft(be(t.text),location.pathname,o);if(r.template){Ie=r.template.id;let i=r.template.recipes.slice(0,6).map(s=>`${s.action.replace(/_/g," ")} = ${s.role} "${s.name}"`).join("; ");t=ne({collapse:new Set(r.template.skeleton),preface:[`[template] ${r.template.pageType} page (known layout, ${Math.round(r.coverage*100)}% match)${i?` \xB7 how this page works: ${i}`:""}`]}),n.template=r.template.pageType,n.coverage=r.coverage.toFixed(2)}else r.drift&&(Ze("drift",r.drift.template.id,r.drift.coverage),n.drift=`${r.drift.template.pageType}:${r.drift.coverage.toFixed(2)}`)}return{ok:!0,values:{snapshot:t.text,refs:String(t.refs),chars:String(t.chars),buildMs:String(Math.round(performance.now()-e)),...n}}}function Zt(e){!e&&Ie&&Ze("verify",Ie,0)}function en(e){let t=e.closest("a[href]");if(!t||t.target==="_blank")return null;try{let n=new URL(t.href,window.location.href);return n.origin!==window.location.origin||n.pathname===window.location.pathname&&n.search===window.location.search?null:n.pathname}catch{return null}}async function Fo(e,t){let n=xe(e)??(t?X(t):null);if(!n)return{ok:!1,reason:"stale_target"};if(await nt(n),await ee(n,420),await le(),!n.isConnected)return{ok:!1,reason:"stale_target"};let o=en(n);if(o)return n.click(),B(800),{ok:!0,verified:!0,observed:`navigating to ${o}`};let r=await et(n,()=>n.click());return B(800),Zt(r.verified),{ok:!0,verified:r.verified,observed:r.observed}}async function Bo(){let e=window.__shoppingmateCheckoutState__;if(typeof e!="function")return{ok:!1,reason:"not_found"};try{return await e()?{ok:!0}:{ok:!1,reason:"not_found"}}catch{return{ok:!1,reason:"not_found"}}}async function qo(e){let t=window.__shoppingmateCheckoutFill__;if(typeof t!="function")return{ok:!1,reason:"not_found"};try{return await t(e)?{ok:!0}:{ok:!1,reason:"not_found"}}catch{return{ok:!1,reason:"not_found"}}}async function Go(){let e=window.__shoppingmatePlaceOrder__;if(typeof e!="function")return{ok:!1,reason:"not_found"};try{return await e()?{ok:!0}:{ok:!1,reason:"not_found"}}catch{return{ok:!1,reason:"not_found"}}}function Ko(e,t){let n=window.__shoppingmateCartAdd__;if(typeof n!="function")return{ok:!1,reason:"not_found"};try{return n(e,t)?{ok:!0}:{ok:!1,reason:"not_found"}}catch{return{ok:!1,reason:"not_found"}}}function Yo(){let e=window.__shoppingmateOpenCart__;if(typeof e!="function")return{ok:!1,reason:"not_found"};try{return e(),{ok:!0}}catch{return{ok:!1,reason:"not_found"}}}function Jo(){let e=window.__shoppingmateGetCart__;if(typeof e!="function")return{ok:!1,reason:"not_found"};try{let t=e(),n=(t?.items??[]).map(o=>`${o.sku??o.name??"item"} x${o.quantity??1}`).join(", ");return{ok:!0,values:{count:String(t?.count??0),items:n,subtotal:t?.subtotal!=null?String(t.subtotal):""}}}catch{return{ok:!1,reason:"not_found"}}}function Xo(){let e=window.__shoppingmateClearCart__;if(typeof e!="function")return{ok:!1,reason:"not_found"};try{return e()?{ok:!0}:{ok:!1,reason:"not_found"}}catch{return{ok:!1,reason:"not_found"}}}function Qo(e,t){let n=window.__shoppingmateCartSetQty__;if(typeof n!="function")return{ok:!1,reason:"not_found"};try{return n(e,t)?{ok:!0}:{ok:!1,reason:"not_found"}}catch{return{ok:!1,reason:"not_found"}}}async function Zo(e){let t=window.__shoppingmateApplyCoupon__;if(typeof t!="function")return{ok:!1,reason:"not_found"};try{return await t(e)?{ok:!0}:{ok:!1,reason:"not_found"}}catch{return{ok:!1,reason:"not_found"}}}function er(e){let t=window.__shoppingmateNavigate__;if(typeof t=="function")try{return t(e),!0}catch{return!1}return!1}async function tt(e){try{let t=new URL(e,window.location.href);if(t.origin!==window.location.origin)return{ok:!1,reason:"cross_origin"};let n=tr(t.pathname);n&&(await ee(n,520),await le());let o=t.pathname+t.search+t.hash;return er(o)||window.location.assign(o),B(800),{ok:!0}}catch{return{ok:!1,reason:"route_not_found"}}}function tr(e){let t=document.querySelectorAll("a[href]");for(let n of t)try{if(new URL(n.href,window.location.href).pathname===e)return n}catch{}return null}async function nr(e){let t=X(e);return t?(await ee(t,480),t.scrollIntoView({behavior:"smooth",block:"center"}),B(800),{ok:!0}):{ok:!1,reason:"not_found"}}function or(e,t){let n=X(e);return n?(qt(n,t),{ok:!0}):{ok:!1,reason:"not_found"}}async function rr(e){let t=X(e);if(!t)return{ok:!1,reason:"not_found"};if(!t.isConnected)return{ok:!1,reason:"stale_target"};if(await ee(t,420),await le(),!t.isConnected)return{ok:!1,reason:"stale_target"};let n=en(t);if(n)return t.click(),B(800),{ok:!0,verified:!0,observed:`navigating to ${n}`};let o=await et(t,()=>t.click());return B(800),Zt(o.verified),{ok:!0,verified:o.verified,observed:o.observed}}async function nt(e){let t=e.getBoundingClientRect(),n=window.innerHeight;(t.bottom<80||t.top>n-80)&&(e.scrollIntoView({behavior:"smooth",block:"center"}),await new Promise(r=>setTimeout(r,350)))}async function ir(e){let t=X(e);return t?t.isConnected?(await nt(t),await ee(t,480),{ok:!0}):{ok:!1,reason:"stale_target"}:{ok:!1,reason:"not_found"}}async function ar(e){let t=X(e);return t?t.isConnected?(await nt(t),await ee(t,420),await le(),await new Promise(n=>setTimeout(n,120)),t.isConnected?(t.click(),B(800),{ok:!0}):{ok:!1,reason:"stale_target"}):{ok:!1,reason:"stale_target"}:{ok:!1,reason:"not_found"}}var He="sm_visitor_id";function sr(){let e=new Uint8Array(8);return(globalThis.crypto??window.crypto).getRandomValues(e),`v_${Array.from(e,n=>n.toString(16).padStart(2,"0")).join("")}`}function cr(){try{let t=localStorage.getItem(He);if(t){let n=JSON.parse(t);if(n?.id&&typeof n.expiresAt=="number")return n}}catch{}let e=document.cookie.match(new RegExp(`(?:^|; )${He}=([^;]+)`));return e?{id:decodeURIComponent(e[1]??""),expiresAt:Date.now()+1}:null}function tn(e){try{localStorage.setItem(He,JSON.stringify(e));let t=Math.floor(6048e5/1e3);document.cookie=`${He}=${e.id}; max-age=${t}; path=/; SameSite=Lax; Secure`}catch{}}function pe(){let e=Date.now(),t=cr();if(t&&t.expiresAt>e)return tn({id:t.id,expiresAt:e+6048e5}),t.id;let n=sr();return tn({id:n,expiresAt:e+6048e5}),n}var me=[200,500],nn=e=>new Promise(t=>setTimeout(t,e));async function ot(e,t){let n;for(let o=0;o<=me.length;o++)try{let r=await fetch(e,t);if(r.status>=500&&o<me.length){await nn(me[o]??0);continue}return r}catch(r){if(n=r,o<me.length){await nn(me[o]??0);continue}throw r}throw n}async function on(e){try{let t=pe(),n=await ot(`${e.apiBase}/v1/install`,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({merchantId:e.merchantId,domain:e.domain,userAgent:navigator.userAgent,referrer:document.referrer||null})});if(!n.ok)return{kind:"err",reason:`install_${n.status}`};let o=await n.json();Xt(o.platform??null),Ct({visitorId:t,platform:o.platform??"custom"});let r=await ot(`${e.apiBase}/v1/session`,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({merchantId:e.merchantId,domain:e.domain})});if(!r.ok)return{kind:"err",reason:`session_${r.status}`};let i=await r.json(),s=null;try{let a=await ot(`${e.apiBase}/v1/voice/token`,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({sessionId:i.sessionId,merchantId:e.merchantId,visitorId:t})});a.ok?s=await a.json():console.warn("[shoppingmate] voice unavailable \u2014 status",a.status)}catch(a){console.warn("[shoppingmate] voice unavailable \u2014",a)}return{kind:"ok",sessionId:i.sessionId,wsUrl:i.wsUrl,merchantStatus:o.status,personaId:o.personaId??s?.personaId??null,widgetPosition:o.widgetPosition??null,widgetSize:o.widgetSize??null,widgetAccent:o.widgetAccent??null,widgetLabel:o.widgetLabel??null,widgetGreeting:o.widgetGreeting??null,voice:s,visitorId:t,insights:o.insights??null}}catch(t){return{kind:"err",reason:t instanceof Error?t.message:"network"}}}var rn=16e3,lr=24e3,Re=640,ur=6e4,dr=`class SmCap extends AudioWorkletProcessor {
  constructor(){super();this.r=sampleRate/${rn};this.acc=0;this.n=0;this.pos=0;}
  process(inputs){const ch=inputs[0]&&inputs[0][0];if(!ch)return true;const out=[];
    for(let i=0;i<ch.length;i++){this.acc+=ch[i];this.n++;this.pos+=1;
      if(this.pos>=this.r){out.push(this.acc/this.n);this.acc=0;this.n=0;this.pos-=this.r;}}
    if(out.length)this.port.postMessage(new Float32Array(out));return true;}}
registerProcessor('sm-cap',SmCap);`;function an(e){let t="idle",n=!1,o=!1,r=null,i=null,s=null,a=null,l=null,u=null,d=null,p=null,b=[],S=0,_=new Set,R=[],y=[],T=0,x=null,L=m=>{x&&!(m in x)&&(x[m]=Math.round(performance.now()-T))},f=()=>{x&&(C(O({type:"voice_timing",sessionId:e.sessionId,timings:{...x,transport_ws:1}})),x=null)},c=m=>{if(t!==m){t=m;for(let v of R)v(m)}},g=(m,v)=>{for(let A of y)A({code:m,message:v})},C=m=>{r?.readyState===WebSocket.OPEN&&r.send(m)},w=()=>{s&&clearTimeout(s),s=null},E=()=>{w(),!o&&(s=setTimeout(()=>{o||P()},ur))},P=()=>{w();let m=r;r=null,i=null;try{m?.close(1e3)}catch{}},D=()=>{if(a)return a;let m=window.AudioContext??window.webkitAudioContext;a=new m,l=a.createGain();try{let v=a.createMediaStreamDestination();l.connect(v),u=new Audio,u.autoplay=!0,u.srcObject=v.stream}catch{l.connect(a.destination)}return a},$=()=>{for(let m of _)try{m.stop()}catch{}_.clear(),S=0,t==="speaking"&&c(n?"muted":"listening")},ge=m=>{if(!a||!l)return;let v=new Int16Array(m);if(v.length===0)return;let A=new Float32Array(v.length);for(let W=0;W<v.length;W++)A[W]=v[W]/32768;let H=a.createBuffer(1,A.length,lr);H.copyToChannel(A,0);let M=a.createBufferSource();M.buffer=H,M.connect(l);let Y=Math.max(a.currentTime+.04,S);M.start(Y),S=Y+H.duration,_.add(M),n||c("speaking"),x&&!("first_audio"in x)&&(L("first_audio"),f()),M.onended=()=>{_.delete(M),_.size===0&&t==="speaking"&&c("listening")}},j=()=>r&&r.readyState===WebSocket.OPEN?(E(),Promise.resolve(r)):i||(i=new Promise((m,v)=>{let A=new WebSocket(e.url);A.binaryType="arraybuffer",A.onopen=()=>{r=A,E(),m(A)},A.onerror=()=>v(new Error("voice websocket connect failed")),A.onmessage=H=>{if(H.data instanceof ArrayBuffer){ge(H.data);return}let M=String(H.data);if(M.includes('"audio_clear"')){$();return}e.onAgentEvent(new TextEncoder().encode(M))},A.onclose=()=>{r===A&&(r=null),i=null,o&&(o=!1,I(),$(),c("idle"),g("connect_failed","voice connection closed"))}}),i.catch(()=>{i=null}),i),K=m=>{if(!(n||!r||r.readyState!==WebSocket.OPEN)){for(let v=0;v<m.length;v++)b.push(m[v]);for(;b.length>=Re;){let v=b.splice(0,Re),A=new Int16Array(Re);for(let H=0;H<Re;H++){let M=Math.max(-1,Math.min(1,v[H]));A[H]=M<0?M*32768:M*32767}r.send(A.buffer)}}},V=null,he=m=>V||(V=(async()=>{try{let v=URL.createObjectURL(new Blob([dr],{type:"application/javascript"}));return await m.audioWorklet.addModule(v),URL.revokeObjectURL(v),!0}catch{return!1}})(),V),ye=async m=>{let[v,A]=await Promise.all([navigator.mediaDevices.getUserMedia({audio:{echoCancellation:!0,noiseSuppression:!0,autoGainControl:!0,channelCount:1}}),he(m)]);d=v;let H=m.createMediaStreamSource(d);try{if(!A)throw new Error("no worklet");let M=new AudioWorkletNode(m,"sm-cap");M.port.onmessage=Y=>K(Y.data),H.connect(M),p=M}catch{let M=m.createScriptProcessor(2048,1,1),Y=m.sampleRate/rn,W=0,Ne=0,Oe=0;M.onaudioprocess=Kn=>{let pt=Kn.inputBuffer.getChannelData(0),mt=[];for(let Ve=0;Ve<pt.length;Ve++)W+=pt[Ve],Ne++,Oe+=1,Oe>=Y&&(mt.push(W/Ne),W=0,Ne=0,Oe-=Y);K(new Float32Array(mt))},H.connect(M);let De=m.createGain();De.gain.value=0,M.connect(De),De.connect(m.destination),p=M}},I=()=>{try{p?.disconnect()}catch{}p=null;for(let m of d?.getTracks()??[])m.stop();d=null,b=[]},N=m=>{let v=m instanceof Error?m.message:String(m),A=m instanceof Error?m.name:"";return/permissions? policy|feature policy/i.test(v)?"mic_policy_blocked":A==="NotAllowedError"||/denied|permission/i.test(v)?"mic_denied":A==="NotFoundError"||/no.*microphone|not.*found/i.test(v)?"mic_unavailable":/connect|network|websocket|timeout/i.test(v)?"connect_failed":"unknown"};return{warm:()=>{j().catch(m=>console.warn("[voiceModeWs] warm failed",m));try{he(D())}catch{}},start:()=>{if(t!=="idle")return;c("connecting"),w(),T=performance.now(),x={was_warm:r?.readyState===WebSocket.OPEN?1:0};let m=D();m.resume(),u?.play().catch(()=>{}),(async()=>{try{await j(),L("room_connected"),await ye(m),L("mic_on"),o=!0,C(O({type:"start_voice",sessionId:e.sessionId})),n&&c("muted")}catch(v){I(),c("idle"),g(N(v),v instanceof Error?v.message:String(v))}})()},stop:()=>{x&&(L("hung_up"),f()),o=!1,I(),$(),P(),c("idle")},speak:async()=>{},setMuted:m=>{n=m,l&&(l.gain.value=m?0:1),m?c("muted"):t==="muted"&&c(_.size?"speaking":"listening")},getState:()=>t,onStateChange:m=>{R.push(m)},onError:m=>{y.push(m)},signalAgentReady:()=>{L("agent_ready"),t==="connecting"&&c(n?"muted":_.size?"speaking":"listening")},publishData:async m=>{C(new TextDecoder().decode(m))}}}function sn(e){let t=0,n=s=>{let a=Date.now();a-t<200||(t=a,e.send(s))},o=s=>{let a=s.target;if(!a)return;let l=pr(a),u=l?mr(l,e.hints):null;n({type:"visitor_action",sessionId:e.sessionId,action:"click",intentKey:u,url:window.location.href,elementLabel:l,timestamp:Date.now()})},r=()=>{n({type:"visitor_action",sessionId:e.sessionId,action:"route_change",intentKey:null,url:window.location.href,elementLabel:null,timestamp:Date.now()})},i=s=>{let a=s.target;if(!a)return;let l=a.tagName?.toLowerCase();l!=="input"&&l!=="textarea"&&l!=="select"||a.type==="password"||n({type:"visitor_action",sessionId:e.sessionId,action:"form_focus",intentKey:null,url:window.location.href,elementLabel:a.name||a.id||null,timestamp:Date.now()})};return document.addEventListener("click",o,{passive:!0,capture:!0}),window.addEventListener("popstate",r),document.addEventListener("focusin",i,{passive:!0}),()=>{document.removeEventListener("click",o,!0),window.removeEventListener("popstate",r),document.removeEventListener("focusin",i)}}function pr(e){return e.getAttribute("aria-label")??e.getAttribute("title")??(e.textContent??"").trim().slice(0,80)??null}function mr(e,t){let n=e.toLowerCase();if(t.has(n))return n;for(let o of t.keys())if(n.includes(o)||o.includes(n))return o;return null}function un(e){return e.replace(/[-_]+/g," ").trim().replace(/\b\w/g,t=>t.toUpperCase())}function cn(e){let t=String(e??"").trim();return!t||/^\d+$/.test(t)?null:un(t)}function ln(e){let t=(e||"/").split(/[?#]/)[0]??"/";if(t==="/"||t==="")return"the home page";if(/^\/checkout/.test(t))return"checkout";if(/^\/cart\/?$/.test(t))return"your cart";let n=t.replace(/\/+$/,"").split("/").pop()??"";return n?`the ${un(n)} page`:"that page"}function dn(e,t){switch(e.type){case"cart_add":{let n=cn(e.sku),o=n?`${e.qty>1?`${e.qty} \xD7 `:""}${n}`:"that";return t.ok?{text:`Added ${o} to your cart`,ok:!0}:{text:`Couldn't add ${n??"that"} to your cart`,ok:!1}}case"cart_set_qty":{let n=cn(e.sku)??"that item";return t.ok?e.qty<=0?{text:`Removed ${n} from your cart`,ok:!0}:{text:`Set ${n} to ${e.qty}`,ok:!0}:{text:`Couldn't update ${n}`,ok:!1}}case"cart_clear":return t.ok?{text:"Emptied your cart",ok:!0}:{text:"Couldn't empty your cart",ok:!1};case"apply_coupon":return t.ok?{text:`Applied code ${e.code.toUpperCase()}`,ok:!0}:{text:`Code ${e.code.toUpperCase()} didn't apply`,ok:!1};case"navigate":return t.ok?{text:`Opened ${ln(e.path)}`,ok:!0}:{text:`Couldn't open ${ln(e.path)}`,ok:!1};case"form_fill":case"checkout_fill":return t.ok?(t.filled??[]).filter(r=>!r.ok).length>0?{text:"Filled in some of your details \u2014 please check the page",ok:!1}:{text:"Filled in your details \u2014 please check them on the page",ok:!0}:{text:"Couldn't fill in your details \u2014 please type them on the page",ok:!1};case"checkout_place":return t.ok?{text:"Sent your order to the payment page",ok:!0}:{text:"Couldn't place the order",ok:!1};case"click":return t.ok?t.verified===!1?{text:"That tap didn't change anything \u2014 trying another way",ok:!1}:null:{text:"Couldn't find that on the page",ok:!1};default:return null}}var rt=10,pn='[data-cart-count],#cart-icon-bubble,.cart-count,.cart-count-bubble,[class*="cart-count"],[class*="CartCount"]';function fr(e=window){try{if(navigator.globalPrivacyControl)return!1;let t=e.Shopify?.customerPrivacy?.analyticsProcessingAllowed;if(typeof t=="function")return!!t();if(typeof e.OnetrustActiveGroups=="string")return e.OnetrustActiveGroups.includes("C0002");if(e.Cookiebot?.hasResponse)return!!e.Cookiebot.consent?.statistics}catch{}return null}function gr(e,t){return e!==null?e:!/^Europe\//.test(t)}function hr(e){return e<768?"mobile":e<1024?"tablet":"desktop"}function mn(e,t,n){let o=new URLSearchParams(e).get("utm_source");if(o)return o.toLowerCase().slice(0,40);if(!t)return"direct";try{let r=new URL(t).hostname.replace(/^www\./,"");return r===n.replace(/^www\./,"")?"internal":/google\./.test(r)?"google":/facebook|fb\.|instagram/.test(r)?"meta":r.slice(0,40)}catch{return"direct"}}function yr(e,t){if(/\/(thank|order-confirm|order-success|checkouts\/.*\/thank_you)/i.test(e))return"purchase";if(/\/checkout/i.test(e))return"checkout";if(/^\/cart\/?$/i.test(e))return"cart";for(let n of t)try{if(new RegExp(n.urlPattern).test(e))return n.pageType}catch{}return e==="/"||e===""?"home":"other"}function it(){return Math.max(document.documentElement.scrollHeight,document.body?.scrollHeight??0,window.innerHeight,1)}function fn(){try{let t=window.__shoppingmateGetCart__;if(typeof t=="function"){let n=t()?.count;if(typeof n=="number")return n}}catch{}let e=Number((document.querySelector(pn)?.textContent??"").replace(/\D/g,""));return Number.isFinite(e)&&document.querySelector(pn)!==null?e:null}function br(e){let t=e?.closest?.('a,button,input,select,textarea,summary,[role="button"],[role="link"],[role="tab"]');if(!t)return null;let n=t.tagName==="A"?"link":t.tagName==="BUTTON"?"button":t.getAttribute("role")??t.tagName.toLowerCase();return re(n,te(t)||t.getAttribute("name")||"")}var Pe="sm_ins_visit",vr=30*60*1e3;function wr(e=Date.now(),t=()=>Math.random().toString(36).slice(2)){let n=null;try{n=JSON.parse(sessionStorage.getItem(Pe)??"null")}catch{n=null}if(!n||e-n.last>vr){let o=!1;try{o=!localStorage.getItem("sm_seen"),localStorage.setItem("sm_seen","1")}catch{}n={id:`v_${t()}${e.toString(36)}`,last:e,isNew:o,bot:!1,qa:!1}}n.last=e;try{sessionStorage.setItem(Pe,JSON.stringify(n))}catch{}return n}function at(e){try{let t=JSON.parse(sessionStorage.getItem(Pe)??"null");t&&sessionStorage.setItem(Pe,JSON.stringify({...t,...e}))}catch{}}var st=!1;function gn(){st=!0,at({bot:!0})}function xr(e,t){if(e>=1)return!0;if(e<=0)return!1;let n=0;for(let o of t)n=n*31+o.charCodeAt(0)>>>0;return n%1e3/1e3<e}function hn(e){if(!e.config?.enabled)return null;let t=wr();if(!xr(e.config.sampleRate,t.id))return null;let n=(()=>{try{return Intl.DateTimeFormat().resolvedOptions().timeZone??""}catch{return""}})();if(!gr(fr(),n))return null;let o=[];Ae().then(c=>{o=c});let r=t.qa||/ShoppingmateBot|HeadlessChrome/.test(navigator.userAgent)||new URLSearchParams(location.search).has("sm_qa");r&&!t.qa&&at({qa:!0});let i=t.isNew;t.bot&&(st=!0);let s=(()=>{try{let c=sessionStorage.getItem("sm_src")??mn(location.search,document.referrer,location.hostname);return sessionStorage.setItem("sm_src",c),c}catch{return mn(location.search,document.referrer,location.hostname)}})(),a=l();function l(){return{path:location.pathname,start:Date.now(),maxScroll:0,attention:new Array(rt).fill(0),cells:{},elements:{},rage:0,dead:0,errorClicks:0,deadTargets:[],rageTargets:[],focused:new Set,submitted:!1,lcp:null,cls:0,inp:null,jsErrors:0,cartStart:fn(),recent:[],lastClickAt:0,sent:!1}}let u=()=>{let c=Math.min(100,Math.round((window.scrollY+window.innerHeight)/it()*100));c>a.maxScroll&&(a.maxScroll=c)},d=window.setInterval(()=>{if(document.visibilityState!=="visible")return;let c=Math.min(rt-1,Math.floor((window.scrollY+window.innerHeight/2)/it()*rt));a.attention[c]=(a.attention[c]??0)+1},1e3),p=c=>{if(z(c.target))return;let g=Date.now(),C=Math.min(9,Math.floor((c.clientX+window.scrollX)/Math.max(document.documentElement.scrollWidth,1)*10)),w=Math.min(9,Math.floor((c.clientY+window.scrollY)/it()*10)),E=`${C},${w}`;a.cells[E]=(a.cells[E]??0)+1;let P=br(c.target);P&&(a.elements[P]=(a.elements[P]??0)+1),a.recent=a.recent.filter(I=>g-I.t<700&&Math.abs(I.x-c.clientX)<30&&Math.abs(I.y-c.clientY)<30),a.recent.push({t:g,x:c.clientX,y:c.clientY}),a.recent.length===3&&(a.rage+=1,P&&a.rageTargets.length<5&&a.rageTargets.push(P)),a.lastClickAt=g;let D=location.href,$=c.target instanceof Element?c.target:null,j=$?.closest('a,button,label,summary,[role="button"],[role="tab"],[role="option"]')??$?.parentElement??$,K=document.activeElement,V=!1,he=I=>I instanceof HTMLElement&&(I.matches('dialog,[role="dialog"],[aria-modal="true"],[role="alert"],[role="status"]')||/fixed|sticky/.test(getComputedStyle(I).position)),ye=new MutationObserver(I=>{for(let N of I)if(!z(N.target)){if(j?.contains(N.target)){V=!0;return}if(N.type==="attributes"&&j&&N.target.contains?.(j)&&/^(aria-|open$|hidden$)/.test(N.attributeName??"")){V=!0;return}if(N.type==="childList"&&[...N.addedNodes].some(he)){V=!0;return}}});ye.observe(document.body,{subtree:!0,childList:!0,attributes:!0,characterData:!0}),window.setTimeout(()=>{ye.disconnect();let I=document.activeElement!==K&&document.activeElement!==document.body;if(!V&&!I&&location.href===D&&a.path===location.pathname){a.dead+=1;let N=P??(()=>{let m=($?.textContent??$?.getAttribute("alt")??"").replace(/\s+/g," ").trim().toLowerCase();return m?`text|${m.slice(0,30)}`:null})();N&&a.deadTargets.length<5&&!a.deadTargets.includes(N)&&a.deadTargets.push(N)}},800)},b=c=>{/shoppingmate|widget\/v1/.test(`${c.filename??""}`)||(a.jsErrors+=1,Date.now()-a.lastClickAt<1e3&&(a.errorClicks+=1))},S=c=>{let g=c.target;if(!g||z(g)||!/^(INPUT|TEXTAREA|SELECT)$/.test(g.tagName))return;let C=(g.getAttribute("type")??"").toLowerCase();if(C==="hidden"||C==="password")return;let w=(g.getAttribute("name")||g.id||g.getAttribute("placeholder")||g.tagName).slice(0,40);a.focused.add(w)},_=()=>{a.submitted=!0},R=[];try{let c=new PerformanceObserver(w=>{let E=w.getEntries().at(-1);E&&(a.lcp=Math.round(E.startTime))});c.observe({type:"largest-contentful-paint",buffered:!0});let g=new PerformanceObserver(w=>{for(let E of w.getEntries())E.hadRecentInput||(a.cls+=E.value??0)});g.observe({type:"layout-shift",buffered:!0});let C=new PerformanceObserver(w=>{for(let E of w.getEntries())a.inp=Math.max(a.inp??0,Math.round(E.duration))});C.observe({type:"event",buffered:!0,durationThreshold:40}),R=[c,g,C]}catch{}let y=()=>{if(a.sent)return;a.sent=!0,at({last:Date.now()});let c=Object.fromEntries(Object.entries(a.elements).sort((P,D)=>D[1]-P[1]).slice(0,20)),g=fn(),C={v:1,merchantId:e.merchantId,sessionId:t.id,visitorId:e.visitorId,path:a.path,pageType:yr(a.path,o),device:hr(window.innerWidth),source:s,newVisitor:i,dwellMs:Date.now()-a.start,maxScroll:a.maxScroll,attention:a.attention,cells:a.cells,elements:c,rage:a.rage,dead:a.dead,errorClicks:a.errorClicks,deadTargets:a.deadTargets,rageTargets:a.rageTargets,abandonedFields:a.submitted?[]:[...a.focused].slice(0,10),lcp:a.lcp,cls:Math.round(a.cls*1e3)/1e3,inp:a.inp,jsErrors:a.jsErrors,botEngaged:st,cartIncreased:a.cartStart!==null&&g!==null&&g>a.cartStart,qa:r},w=JSON.stringify(C),E=`${e.apiBase}/v1/insights/pageview`;try{navigator.sendBeacon?.(E,new Blob([w],{type:"text/plain"}))||fetch(E,{method:"POST",body:w,keepalive:!0,headers:{"content-type":"text/plain"}}).catch(()=>{})}catch{}},T=()=>{location.pathname!==a.path&&(y(),a=l(),u())},x=history.pushState,L=history.replaceState;history.pushState=function(...c){let g=x.apply(this,c);return window.setTimeout(T,0),g},history.replaceState=function(...c){let g=L.apply(this,c);return window.setTimeout(T,0),g};let f=()=>y();return window.addEventListener("scroll",u,{passive:!0}),window.addEventListener("popstate",T),window.addEventListener("pagehide",f),document.addEventListener("visibilitychange",()=>{document.visibilityState==="hidden"&&y()}),document.addEventListener("click",p,!0),document.addEventListener("focusin",S,!0),document.addEventListener("submit",_,!0),window.addEventListener("error",b),u(),()=>{y(),window.clearInterval(d);for(let c of R)c.disconnect();history.pushState=x,history.replaceState=L,window.removeEventListener("scroll",u),window.removeEventListener("popstate",T),window.removeEventListener("pagehide",f),document.removeEventListener("click",p,!0),document.removeEventListener("focusin",S,!0),document.removeEventListener("submit",_,!0),window.removeEventListener("error",b)}}var yn={"calm-clinician":"Sage","calmosis-clinician":"Calmio",stylist:"Lumi",coach:"Kai",concierge:"Olivia",curator:"Theo",guide:"Maya",expert:"Arjun",host:"Ana"},kr={"calmosis-clinician":"calm-clinician"};function _r(){let e="https://shoppingmate-web.vercel.app/widget/personas";return e&&typeof e=="string"?e.replace(/\/$/,""):"https://cdn.shoppingmate.ai/v1/personas"}var bn={id:"pending",name:"Assistant",initial:"A",avatarUrl:""};function vn(){return bn}function wn(e){if(!e||!yn[e])return bn;let t=yn[e],n=kr[e]??e;return{id:e,name:t,initial:t.charAt(0).toUpperCase(),avatarUrl:`${_r()}/${n}.png`}}var xn=0,U=()=>(xn+=1,`t${xn}`);function Sr(e,t){switch(t.type){case"set_mode":return{...e,mode:t.mode};case"set_voice_state":return t.state!=="idle"?{...e,voiceState:t.state,voiceError:null,invited:!1}:{...e,voiceState:t.state};case"set_connection":return{...e,connection:t.status,thinking:t.status==="connected"?e.thinking:!1};case"set_voice_error":return{...e,voiceError:t.error};case"set_invited":return{...e,invited:t.invited};case"receipt":{let n=e.transcript[e.transcript.length-1];return n&&n.kind==="receipt"&&n.text===t.text&&n.ok===t.ok?e:{...e,transcript:[...e.transcript,{id:U(),role:"system",kind:"receipt",text:t.text,ok:t.ok,ts:Date.now()}]}}case"reset":return{...e,transcript:[],thinking:!1,closed:!1,closedReason:null,checkoutUrl:null,capWarning:null};case"user_input":return{...e,transcript:[...e.transcript,{id:U(),role:"user",kind:"text",text:t.text,ts:Date.now()}]};case"agent_event":{let n=t.event;switch(n.type){case"thinking":return{...e,thinking:!0};case"end_of_turn":return{...e,thinking:!1};case"say":{let o=e.transcript[e.transcript.length-1];return o&&o.role==="agent"&&o.kind==="text"&&o.partial?{...e,thinking:!1,transcript:[...e.transcript.slice(0,-1),{...o,text:n.text,partial:!1,ts:Date.now()}]}:{...e,thinking:!1,transcript:[...e.transcript,{id:U(),role:"agent",kind:"text",text:n.text,ts:Date.now()}]}}case"say_partial":{let o=e.transcript[e.transcript.length-1];return o&&o.role==="agent"&&o.kind==="text"&&o.partial?{...e,thinking:!1,transcript:[...e.transcript.slice(0,-1),{...o,text:n.text,ts:Date.now()}]}:{...e,thinking:!1,transcript:[...e.transcript,{id:U(),role:"agent",kind:"text",text:n.text,ts:Date.now(),partial:!0}]}}case"user_text":return{...e,transcript:[...e.transcript,{id:U(),role:"user",kind:"text",text:n.text,ts:Date.now()}]};case"cards":return{...e,transcript:[...e.transcript,{id:U(),role:"agent",kind:"cards",items:n.items,ts:Date.now()}]};case"tool_result":return n.toolName==="case.open"&&n.ok?{...e,transcript:[...e.transcript,{id:U(),role:"system",kind:"receipt",text:"Your request is with the team \u2014 they\u2019ll contact you",ok:!0,ts:Date.now()}]}:e;case"checkout_redirect":return{...e,checkoutUrl:n.url};case"cap_warning":return{...e,capWarning:{reason:n.reason,remaining:n.remaining},transcript:[...e.transcript,{id:U(),role:"system",kind:"cap_warning",remaining:n.remaining,ts:Date.now()}]};case"session_closed":return{...e,closed:!0,closedReason:n.reason,transcript:[...e.transcript,{id:U(),role:"system",kind:"closed",reason:n.reason,ts:Date.now()}]};default:return e}}default:return e}}function ct(e){let t={sessionId:e.sessionId,mode:"pill",voiceState:"idle",transcript:[],thinking:!1,closed:!1,closedReason:null,checkoutUrl:null,capWarning:null,connection:"connecting",voiceError:null,invited:!1},n=[];return{get:()=>t,dispatch:o=>{t=Sr(t,o);for(let r of n)r(t)},subscribe:o=>(n.push(o),()=>{let r=n.indexOf(o);r>=0&&n.splice(r,1)})}}var kn=`
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
`;var _n=[1e3,2e3,4e3,8e3,16e3],Cr=5;function Sn(e,t){let n=null,o=0,r=!1,i=[];function s(){r||(t.onStatus(o>0?"reconnecting":"connecting"),n=new WebSocket(e),n.onopen=()=>{t.onStatus("connected"),o>0&&n?.send(JSON.stringify({type:"session_resume",sessionId:t.sessionId})),o=0;for(let a of i)n?.send(a);i=[]},n.onmessage=a=>t.onEvent(typeof a.data=="string"?a.data:""),n.onerror=()=>{},n.onclose=()=>{if(r)return;if(o+=1,o>=Cr){t.onStatus("disconnected");return}let a=Math.min(o-1,_n.length-1),l=_n[a]??3e4;t.onStatus("reconnecting"),setTimeout(s,l)})}return s(),{send:a=>{n&&n.readyState===1?n.send(a):i.push(a)},close:()=>{r=!0,n?.close()}}}var h={captionResting:"AI ASSISTANT",captionIncoming:"INCOMING CALL",captionThinking:"THINKING",captionConnected:"CONNECTED",captionRetry:"TAP TO RETRY",captionOffline:"OFFLINE",talkToPrefix:"Talk to",callCta:"Call",acceptCta:"Accept",callAria:"Start voice call",acceptAria:"Accept call",micMute:"Mute mic",micUnmute:"Unmute mic",retryAria:"Retry call",endCallAria:"End call",closeAria:"Close",openAria:"Open shoppingmate",chatAria:"Chat instead",callFailedTitle:"Could not start the call. Please try again.",callHelpHeading:"How can I help you?",callBullets:["Find the right product","Compare options out loud","Check out on this page"],panelHelpHeading:"Hi, I'm",panelHelpSubtitle:"I'm here to help you:",panelBullets:["Find the right product fast","Compare options out loud","Check out without leaving the page"],panelPrompts:["Help me find the right product","Can you compare your products for me?","I'd like to check out"],poweredBy:"Powered by shoppingmate",chatPlaceholder:"Type a quick question\u2026",reconnecting:"Reconnecting\u2026",disconnected:"Connection lost \u2014 reload to retry",closed:{user:"Conversation ended",cap:"Time to wrap up \u2014 reload for a new chat",error:"Something went wrong"},payNow:"Pay now \u2192",capWarning:"A couple minutes left",thinking:"thinking\u2026",micDenied:"Mic blocked \u2014 switching to text"};var G=e=>`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${e}</svg>`,lt=G('<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>'),Cn=G('<path d="M18 6 6 18"/><path d="m6 6 12 12"/>'),Tn=G('<path d="M5 12h14"/>'),En=G('<path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>'),An=G('<path d="M10.68 13.31a16 16 0 0 0 3.41 2.6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7 2 2 0 0 1 1.72 2v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.42 19.42 0 0 1-3.33-2.67"/><path d="M5 5a2 2 0 0 1 2-2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L10.9 11.1"/><line x1="22" y1="2" x2="2" y2="22"/>'),Mn=G('<path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="22"/>'),Ln=G('<line x1="2" y1="2" x2="22" y2="22"/><path d="M18.89 13.23A7.12 7.12 0 0 0 19 12v-2"/><path d="M5 10v2a7 7 0 0 0 12 5"/><path d="M15 9.34V5a3 3 0 0 0-5.68-1.33"/><path d="M9 9v3a3 3 0 0 0 5.12 2.12"/><line x1="12" y1="19" x2="12" y2="22"/>'),In=G('<path d="M22 2 11 13"/><path d="M22 2l-7 20-4-9-9-4 20-7z"/>');function fe(e){return e.replace(/[&<>"']/g,t=>t==="&"?"&amp;":t==="<"?"&lt;":t===">"?"&gt;":t==='"'?"&quot;":"&#39;")}function Tr(e){return fe(e.trim()).replace(/\*\*([^*\n]+)\*\*/g,"<strong>$1</strong>").replace(/__([^_\n]+)__/g,"<strong>$1</strong>").replace(/(^|\s)\*([^*\n]+)\*(?=\s|$|[.,!?])/g,"$1$2").replace(/^#{1,6}\s+/gm,"").replace(/^\s*[-•]\s+/gm,"\u2022 ").replace(/\n{2,}/g,`
`).replace(/\n/g,"<br>")}function Rn(e,t,n){t==="user"?e.textContent=n:e.innerHTML=Tr(n)}function Er(e,t){let n=document.createElement("button");return n.className="card",n.type="button",n.dataset.sku=e.sku,n.innerHTML=`
    ${e.image?`<img src="${fe(e.image)}" alt="${fe(e.title)}" />`:'<div class="card-img-fallback"></div>'}
    <div class="title">${fe(e.title)}</div>
    <div class="price">${fe(e.priceFormatted)}</div>
  `,n.addEventListener("click",()=>t({sku:e.sku,variantId:e.variantId})),n}function Ar(e,t){if(e.kind==="text"){let o=document.createElement("div");return o.className=`bubble ${e.role}`,Rn(o,e.role,e.text),o}if(e.kind==="cards"){let o=document.createElement("div");o.className="cards-row";for(let r of e.items)o.appendChild(Er(r,t));return o}if(e.kind==="receipt"){let o=document.createElement("div");o.className=`receipt ${e.ok?"ok":"warn"}`,o.setAttribute("role","status");let r=document.createElement("span");r.className="receipt-icon",r.setAttribute("aria-hidden","true"),r.textContent=e.ok?"\u2713":"!";let i=document.createElement("span");return i.textContent=e.text,o.append(r,i),o}if(e.kind==="cap_warning"){let o=document.createElement("div");return o.className="bubble system",o.textContent=h.capWarning,o}let n=document.createElement("div");return n.className="bubble system",n.textContent=h.closed[e.reason],n}var Hn=new WeakMap;function $e(e,t,n){let o=Hn.get(e)??[],r=new Map(o.map(l=>[l.id,l])),i=new Set(t.map(l=>l.id));for(let l of o)i.has(l.id)||l.el.remove();let s=[],a=!1;for(let l=0;l<t.length;l++){let u=t[l];if(!u)continue;let d=r.get(u.id);if(d)u.kind==="text"&&d.text!==u.text&&(Rn(d.el,u.role,u.text),d.text=u.text,a=!0),s.push(d);else{let p=Ar(u,n);e.appendChild(p),s.push({id:u.id,el:p,text:u.kind==="text"?u.text:void 0}),a=!0}}Hn.set(e,s),a&&(e.scrollTop=e.scrollHeight)}function Mr(e){switch(e){case"mic_policy_blocked":return"Voice is disabled on this page \u2014 text chat still works.";case"mic_denied":return"Microphone blocked. Allow mic access in your browser, then tap Call.";case"mic_unavailable":return"No microphone found \u2014 check your audio device, then tap Call.";case"connect_failed":return"Couldn't reach voice. Tap Call to retry.";default:return"Tap Call to try again."}}function Pn(e){return e.muted?"you're muted":e.voiceState==="connecting"?`connecting to ${e.personaName}\u2026`:e.voiceState==="speaking"?`${e.personaName} is speaking\u2026`:e.voiceState==="listening"?`${e.personaName} is listening\u2026`:`${e.personaName} is ready`}function $n(e){return e.voiceState==="idle"&&e.voiceError?"error":e.transcript.length===0?"prompt":"transcript"}function Lr(e){return`${$n(e)}|${e.checkoutUrl??""}|${e.personaName}|${e.voiceError?.code??""}`}function Nn(e,t){let n=Lr(t),o=$n(t);if(e.dataset.chromeKey!==n){let s=o==="error"?`
          <div class="call-error">
            <p class="call-error-title">${h.callFailedTitle}</p>
            <p class="call-error-hint">${Mr(t.voiceError?.code??"unknown")}</p>
          </div>`:"",a=o==="prompt"?`
          <div class="call-prompt">
            <h2 class="call-prompt-heading">${h.callHelpHeading}</h2>
            <ul class="call-prompt-bullets">
              ${h.callBullets.map(u=>`<li>${u}</li>`).join("")}
            </ul>
          </div>`:"",l=o!=="transcript";e.innerHTML=`
      <div class="panel call-panel">
        <button class="panel-close" data-action="close" aria-label="${h.closeAria}">${Tn}</button>
        ${s}
        ${a}
        <div class="status-line ${o==="error"?"hidden":""}" data-region="status">${Pn(t)}</div>
        <div class="transcript ${l?"hidden":""}" data-region="transcript" aria-live="polite"></div>
        ${t.checkoutUrl?`<a class="checkout-cta" data-action="checkout" href="${t.checkoutUrl}" target="_blank" rel="noopener">${h.payNow}</a>`:""}
        <div class="panel-footer">${h.poweredBy}</div>
      </div>
    `,e.querySelector('[data-action="close"]')?.addEventListener("click",t.onClose),e.querySelector('[data-action="checkout"]')?.addEventListener("click",t.onCheckout),e.dataset.chromeKey=n}let r=e.querySelector('[data-region="status"]');if(r instanceof HTMLElement){let s=Pn(t);r.textContent!==s&&(r.textContent=s)}let i=e.querySelector('[data-region="transcript"]');i instanceof HTMLElement&&o==="transcript"&&$e(i,t.transcript,t.onCardTap)}function Ir(e){return`${e.transcript.length===0?"1":"0"}|${e.checkoutUrl??""}|${e.closed?"1":"0"}|${e.personaName}|${e.personaInitial}|${e.personaAvatarUrl}`}function On(e,t){let n=Ir(t);if(e.dataset.chromeKey!==n){let r=t.transcript.length===0,i=h.panelBullets.map((u,d)=>`<button type="button" class="welcome-bullet" data-prompt="${d}" ${t.closed?"disabled":""}>${u}<span class="welcome-bullet-arrow" aria-hidden="true">\u2192</span></button>`).join(""),s=r?`
        <div class="welcome">
          <div class="welcome-avatar">
            <img src="${t.personaAvatarUrl}" alt="" onerror="this.style.display='none'; this.nextElementSibling.style.display='grid';" />
            <span class="welcome-avatar-fallback" aria-hidden="true">${t.personaInitial}</span>
          </div>
          <h2 class="welcome-heading">${h.panelHelpHeading} ${t.personaName}.</h2>
          <p class="welcome-sub">${h.panelHelpSubtitle}</p>
          <div class="welcome-bullets">${i}</div>
        </div>
      `:"";e.innerHTML=`
      <div class="panel">
        <button class="panel-close" data-action="close" aria-label="${h.closeAria}">${Cn}</button>
        ${s}
        <div class="transcript ${r?"transcript-empty":""}" data-region="transcript" aria-live="polite"></div>
        ${t.checkoutUrl?`<a class="checkout-cta" href="${t.checkoutUrl}" target="_blank" rel="noopener">${h.payNow}</a>`:""}
        <form class="input-row">
          <input type="text" placeholder="${h.chatPlaceholder}" ${t.closed?"disabled":""} />
          <button class="send" type="submit" aria-label="Send" ${t.closed?"disabled":""}>${In}</button>
        </form>
        <div class="panel-footer">${h.poweredBy}</div>
      </div>
    `,e.querySelector('[data-action="close"]')?.addEventListener("click",t.onClose),e.querySelectorAll(".welcome-bullet").forEach(u=>{u.addEventListener("click",()=>{if(t.closed)return;let d=Number(u.dataset.prompt),p=h.panelPrompts[d]??h.panelBullets[d];p&&t.onSend(p)})});let a=e.querySelector("form"),l=e.querySelector("input");a instanceof HTMLFormElement&&l instanceof HTMLInputElement&&a.addEventListener("submit",u=>{u.preventDefault();let d=l.value.trim();d&&(l.value="",t.onSend(d))}),e.dataset.chromeKey=n}let o=e.querySelector('[data-region="transcript"]');o instanceof HTMLElement&&$e(o,t.transcript,t.onCardTap)}function Hr(e,t,n,o,r,i,s=8){let a=Math.max(s,r-n-s),l=Math.max(s,i-o-s);return{x:Math.min(Math.max(s,e),a),y:Math.min(Math.max(s,t),l)}}function Rr(e,t,n,o=8){let r=(e.left+e.right)/2,i=(e.top+e.bottom)/2,s=r>t/2?"right":"left",a=i>n/2?"bottom":"top",l=Math.max(o,s==="right"?t-e.right:e.left),u=Math.max(o,a==="bottom"?n-e.bottom:e.top);return{hSide:s,hVal:l,vSide:a,vVal:u}}function ut(e,t){e.classList.add("dragged"),e.style.transform="none",t.hSide==="right"?(e.style.right=`${t.hVal}px`,e.style.left="auto"):(e.style.left=`${t.hVal}px`,e.style.right="auto"),t.vSide==="bottom"?(e.style.bottom=`${t.vVal}px`,e.style.top="auto"):(e.style.top=`${t.vVal}px`,e.style.bottom="auto"),e.classList.toggle("dock-top",t.vSide==="top"),e.classList.toggle("dock-bottom",t.vSide==="bottom"),e.classList.toggle("dock-left",t.hSide==="left"),e.classList.toggle("dock-right",t.hSide==="right")}function Dn(e){try{let t=window.localStorage.getItem(e);if(!t)return null;let n=JSON.parse(t);if((n.hSide==="left"||n.hSide==="right")&&(n.vSide==="top"||n.vSide==="bottom")&&typeof n.hVal=="number"&&typeof n.vVal=="number")return n}catch{}return null}function Pr(e,t){try{window.localStorage.setItem(e,JSON.stringify(t))}catch{}}function Vn(e,t){let n=t.offsetWidth||0,o=t.offsetHeight||0,r=window.innerWidth,i=window.innerHeight;return{...e,hVal:Math.min(Math.max(8,e.hVal),Math.max(8,r-n-8)),vVal:Math.min(Math.max(8,e.vVal),Math.max(8,i-o-8))}}function zn(e){let{root:t,surface:n,storageKey:o}=e,r=()=>n.querySelector(".tray")??n,i=Dn(o);i&&ut(t,Vn(i,r()));let s=0,a=0,l=0,u=0,d=!1,p=null,b=y=>{if(p!==null&&y.pointerId!==p)return;let T=y.clientX-s,x=y.clientY-a;if(!d&&Math.hypot(T,x)<6)return;if(!d)try{p!=null&&n.setPointerCapture(p)}catch{}d=!0,t.classList.add("dragging","dragged"),t.style.transform="none";let L=t.offsetWidth,f=t.offsetHeight,{x:c,y:g}=Hr(l+T,u+x,L,f,window.innerWidth,window.innerHeight);t.style.left=`${c}px`,t.style.top=`${g}px`,t.style.right="auto",t.style.bottom="auto",t.classList.remove("dock-top","dock-bottom","dock-left","dock-right"),y.preventDefault()},S=y=>{if(window.removeEventListener("pointermove",b),window.removeEventListener("pointerup",S),p=null,!d)return;d=!1,t.classList.remove("dragging");let T=f=>{f.stopPropagation(),f.preventDefault()};n.addEventListener("click",T,{capture:!0,once:!0}),window.setTimeout(()=>n.removeEventListener("click",T,{capture:!0}),350);let x=r().getBoundingClientRect(),L=Rr({top:x.top,left:x.left,right:x.right,bottom:x.bottom},window.innerWidth,window.innerHeight);ut(t,L),Pr(o,L),y.preventDefault()},_=y=>{if(y.button!=null&&y.button!==0)return;let T=r().getBoundingClientRect();s=y.clientX,a=y.clientY,l=T.left,u=T.top,d=!1,p=y.pointerId??null,window.addEventListener("pointermove",b),window.addEventListener("pointerup",S)},R=()=>{let y=Dn(o);y&&ut(t,Vn(y,r()))};return n.addEventListener("pointerdown",_),window.addEventListener("resize",R),()=>{n.removeEventListener("pointerdown",_),window.removeEventListener("pointermove",b),window.removeEventListener("pointerup",S),window.removeEventListener("resize",R)}}function $r(e){return e.voiceState==="connecting"?"connecting":e.voiceState!=="idle"?"connected":e.voiceError?"error":e.invited?"incoming":"resting"}function Nr(e,t){return[t,e.mode,e.callable?"1":"0",e.voiceState,e.connection,e.invited?"1":"0",e.personaName,e.personaInitial,e.personaAvatarUrl,e.launcherLabel??"",e.launcherCaption??""].join("|")}function Or(e,t){let n=e.voiceState==="muted",o=e.voiceState==="speaking",r=e.connection==="disconnected",i=(S,_)=>`
    <button class="tray-call" data-action="call" aria-label="${_}">
      ${En}<span class="tray-call-label">${S}</span>
    </button>`,s=`
    <button class="tray-btn ghost" data-action="chat" aria-label="${h.openAria}">${lt}</button>`,a=`
    <button class="tray-btn tray-chat" data-action="chat" aria-label="${h.chatAria}" title="${h.chatAria}">${lt}</button>`,l=S=>`
    <button class="tray-btn ${n?"muted":""}" data-action="mic" ${S?"disabled":""}
      aria-pressed="${n}" aria-label="${n?h.micUnmute:h.micMute}">${n?Ln:Mn}</button>`,u=`
    <button class="tray-btn end" data-action="end" aria-label="${h.endCallAria}">${An}</button>`,d='<span class="tray-spinner" aria-hidden="true"></span>',p=`
    <div class="tray-waveform active ${o?"speaking":""}" aria-hidden="true">
      ${Array.from({length:14}).map(()=>'<span class="bar"></span>').join("")}
    </div>`,b=r?"offline":"online";switch(t){case"incoming":return{caption:h.captionIncoming,captionClass:"incoming",presenceClass:b,nameText:e.personaName,controls:`${i(h.acceptCta,h.acceptAria)}${a}`};case"connecting":return{caption:h.captionThinking,captionClass:"thinking",presenceClass:"online",nameText:e.personaName,controls:`${d}${l(!0)}${u}`};case"connected":return{caption:h.captionConnected,captionClass:"connected",presenceClass:"online",nameText:e.personaName,controls:`${p}${l(!1)}${u}`};case"error":return{caption:h.captionRetry,captionClass:"retry",presenceClass:"offline",nameText:e.personaName,controls:`${i(h.callCta,h.retryAria)}${u}`};default:{let S=e.launcherLabel?.trim(),_=e.launcherCaption?.trim();return{caption:r?h.captionOffline:_||h.captionResting,captionClass:r?"retry":"resting",presenceClass:b,nameText:S||`${h.talkToPrefix} ${e.personaName}`,controls:e.callable?`${i(h.callCta,h.callAria)}${a}`:s}}}}function Un(e,t){let n=$r(t),o=Nr(t,n);if(e.dataset.trayKey===o)return;let r=Or(t,n),i=t.mode==="chat"||t.mode==="call"||t.mode==="expanded";e.innerHTML=`
    <div class="tray phase-${n}" role="region" aria-label="shoppingmate">
      <button class="tray-avatar" data-action="toggle" aria-expanded="${i}" aria-label="${h.openAria}">
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
  `,e.querySelector('[data-action="toggle"]')?.addEventListener("click",()=>{i?t.onClose():t.onChat()}),e.querySelector('[data-action="call"]')?.addEventListener("click",t.onCall),e.querySelector('[data-action="chat"]')?.addEventListener("click",t.onChat),e.querySelector('[data-action="mic"]')?.addEventListener("click",()=>{t.onMute(t.voiceState!=="muted")}),e.querySelector('[data-action="end"]')?.addEventListener("click",t.onEnd),e.dataset.trayKey=o}var jn="shoppingmate-widget",Wn="SM-XPK2EN",Fn="SM-2SCCLZ",Bn=new Set(["bottom-right","bottom-left","bottom-center","center","center-left","center-right","top-right","top-left"]),qn=new Set(["small","medium","large"]),Dr=6e3,Vr=12e3,zr=["cart-sidebar-show","cart-open","cart--open","cart-drawer-open","cart-drawer--active","cart-drawer-is-open","js-drawer-open","drawer-open","drawer--open","js-drawer-open-right","cart-active","is-cart-open","cart-is-open","cart-visible","show-cart","cart-show","mini-cart-active","minicart-active","mini-cart--active","ajaxcart-open","header-cart-open"],Ur=["menu-open","menu--open","menu-is-open","is-menu-open","menu-drawer-open","menu-drawer--active","mobile-menu-open","mobile-menu--open","mobile-nav-open","nav-open","nav--open","nav-is-open","is-nav-open","js-nav-open","js-menu-open","navigation-open","header-menu-open","offcanvas-open","off-canvas-open","offcanvas-nav-open","offcanvas-menu-open"];function jr(e,t){if(t==="/cart"||t.startsWith("/cart/")||t.startsWith("/cart?"))return!0;let n=e.toLowerCase();return zr.some(o=>n.includes(o))||Ur.some(o=>n.includes(o))}function Wr(){try{let e=window.location.pathname||"",t=`${document.documentElement.className} ${document.body?document.body.className:""}`;return jr(t,e)}catch{return!1}}function Fr(){return"live-kit"==="web-speech"?"web-speech":"live-kit"}var dt=class extends HTMLElement{constructor(){super(...arguments);k(this,"rootEl",null);k(this,"pillHost",null);k(this,"panelHost",null);k(this,"store",ct({sessionId:"pending"}));k(this,"socket",null);k(this,"voiceMode",oe(null,ke()));k(this,"voice",null);k(this,"persona",vn());k(this,"launcherLabel",null);k(this,"launcherCaption",null);k(this,"apiBase","");k(this,"merchantId","");k(this,"domain",window.location.host);k(this,"stopActivityTracker",null);k(this,"inviteTimer",null);k(this,"inviteDismissTimer",null);k(this,"collapseTimer",null);k(this,"stopCollapse",null);k(this,"cartObserver",null);k(this,"scrollResizeRaf",!1);k(this,"overlayRecheck",null);k(this,"stopDrag",null);k(this,"ambience",je(!1));k(this,"onHostGesture",()=>{this.onCartVisibilityChange(),window.setTimeout(this.onCartVisibilityChange,200),window.setTimeout(this.onCartVisibilityChange,550)});k(this,"onScrollResize",()=>{this.scrollResizeRaf||(this.scrollResizeRaf=!0,requestAnimationFrame(()=>{this.scrollResizeRaf=!1,this.onCartVisibilityChange()}))});k(this,"onCartVisibilityChange",()=>{if(!this.rootEl)return;let n=this.store.get(),o=n.mode==="call"||n.voiceState!=="idle",r=n.mode==="chat"||n.mode==="expanded",i=(Wr()||!r&&this.launcherCovered())&&!o;this.rootEl.classList.toggle("host-overlay-hidden",i)})}connectedCallback(){if(this.shadowRoot)return;let n=this.getAttribute("data-id"),o=this.getAttribute("data-api")??this.apiBase;if(!n){console.warn("[shoppingmate] data-id missing on widget element");return}this.merchantId=n,this.apiBase=o,this.ambience=je(this.getAttribute("data-ambience")!=="off");let r=this.attachShadow({mode:"open"}),i=document.createElement("style");i.textContent=kn,r.appendChild(i);let s=document.createElement("div"),a=this.merchantId===Fn?"center-left":"bottom-right",l=(this.getAttribute("data-position")??a).toLowerCase(),u=Bn.has(l)?`pos-${l}`:"pos-bottom-right",d=(this.getAttribute("data-size")??"medium").toLowerCase(),p=qn.has(d)&&d!=="medium"?` size-${d}`:"";s.className=`root ${u}${p}`,r.appendChild(s),this.rootEl=s,this.panelHost=document.createElement("div"),this.pillHost=document.createElement("div"),s.appendChild(this.panelHost),s.appendChild(this.pillHost),this.store.subscribe(()=>this.render()),this.render(),this.stopDrag=zn({root:s,surface:this.pillHost,storageKey:`sm-widget-pos:${this.merchantId}`}),this.stopCollapse=this.setupAutoCollapse(s,this.pillHost),this.setupCartVisibility(s),this.start()}applyServerPosition(n){let o=this.rootEl;if(!o||o.classList.contains("dragged"))return;let r=n.toLowerCase();if(Bn.has(r)){for(let i of Array.from(o.classList))i.startsWith("pos-")&&o.classList.remove(i);o.classList.add(`pos-${r}`)}}applyAccent(n){let o=this.rootEl;if(!o)return;let r=n.trim();!/^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(r)&&!/^rgba?\([\d.,\s%]+\)$/i.test(r)||o.style.setProperty("--sm-accent",r)}applyServerSize(n){let o=this.rootEl;if(!o)return;let r=n.toLowerCase();qn.has(r)&&(o.classList.remove("size-small","size-large"),r!=="medium"&&o.classList.add(`size-${r}`))}disconnectedCallback(){this.socket?.close(),this.voiceMode.stop(),this.ambience.stop(),this.stopActivityTracker?.(),this.inviteTimer&&clearTimeout(this.inviteTimer),this.inviteDismissTimer&&clearTimeout(this.inviteDismissTimer),this.collapseTimer&&clearTimeout(this.collapseTimer),this.stopCollapse?.(),this.cartObserver?.disconnect(),window.removeEventListener("popstate",this.onCartVisibilityChange),document.removeEventListener("click",this.onHostGesture,!0),document.removeEventListener("keyup",this.onHostGesture,!0),window.removeEventListener("scroll",this.onScrollResize),window.removeEventListener("resize",this.onScrollResize),this.overlayRecheck&&window.clearInterval(this.overlayRecheck),this.stopDrag?.()}setupCartVisibility(n){this.onCartVisibilityChange(),this.cartObserver=new MutationObserver(this.onCartVisibilityChange),this.cartObserver.observe(document.documentElement,{attributes:!0,attributeFilter:["class"]}),document.body&&this.cartObserver.observe(document.body,{attributes:!0,attributeFilter:["class"]}),window.addEventListener("popstate",this.onCartVisibilityChange),document.addEventListener("click",this.onHostGesture,!0),document.addEventListener("keyup",this.onHostGesture,!0),window.addEventListener("scroll",this.onScrollResize,{passive:!0}),window.addEventListener("resize",this.onScrollResize),this.overlayRecheck=window.setInterval(()=>{this.rootEl?.classList.contains("host-overlay-hidden")&&this.onCartVisibilityChange()},1500)}launcherCovered(){let n=this.rootEl;if(!n||typeof document.elementsFromPoint!="function")return!1;let o=n.getBoundingClientRect();if(!o.width||!o.height)return!1;let r=o.left+o.width/2,i=o.top+o.height/2;for(let s of document.elementsFromPoint(r,i)){if(s===this||this.contains(s)||s.contains(this)||s.tagName==="SHOPPINGMATE-WIDGET")continue;let a=s;for(;a&&a!==document.body&&a!==document.documentElement;){let l=getComputedStyle(a);if(l.position==="fixed"&&l.pointerEvents!=="none"){let u=a.getBoundingClientRect(),d=u.left<=r&&u.right>=r&&u.top<=i&&u.bottom>=i,p=u.width>=window.innerWidth*.4||u.height>=window.innerHeight*.4,b=l.visibility!=="hidden"&&l.display!=="none"&&Number(l.opacity)>.01;if(d&&p&&b)return!0}a=a.parentElement}}return!1}setupAutoCollapse(n,o){let r=()=>{this.collapseTimer&&clearTimeout(this.collapseTimer),this.collapseTimer=setTimeout(()=>n.classList.add("collapsed"),Dr)},i=()=>{n.classList.remove("collapsed"),r()};return o.addEventListener("pointerenter",i),o.addEventListener("pointerdown",i),o.addEventListener("focusin",i),o.addEventListener("pointerleave",r),r(),()=>{o.removeEventListener("pointerenter",i),o.removeEventListener("pointerdown",i),o.removeEventListener("focusin",i),o.removeEventListener("pointerleave",r)}}async start(){let n=await on({apiBase:this.apiBase,merchantId:this.merchantId,domain:this.domain});if(n.kind==="err"){console.warn("[shoppingmate] bootstrap failed:",n.reason);return}this.store=ct({sessionId:n.sessionId}),this.store.subscribe(()=>this.render()),Gt({apiBase:this.apiBase,merchantId:this.merchantId,sessionId:n.sessionId}),n.insights?.enabled&&hn({apiBase:this.apiBase,merchantId:this.merchantId,sessionId:n.sessionId,visitorId:n.visitorId,config:n.insights}),this.voice=n.voice,this.persona=wn(n.personaId??n.voice?.personaId??null),n.widgetPosition&&this.applyServerPosition(n.widgetPosition),n.widgetSize&&this.applyServerSize(n.widgetSize),n.widgetAccent&&this.applyAccent(n.widgetAccent),this.launcherLabel=n.widgetLabel?.trim()||null,this.launcherCaption=n.widgetGreeting?.trim()||null,this.render();let o=Fr(),r=ae();if(o==="live-kit"&&this.voice?.transport==="ws"&&this.voice.voiceWsUrl)this.voiceMode=an({sessionId:n.sessionId,url:this.voice.voiceWsUrl,onAgentEvent:i=>this.handleLiveKitData(i)}),this.armVoiceWarm();else if(o==="live-kit"&&this.voice){kt();let i=Se({stack:"live-kit",livekit:{sessionId:n.sessionId,wsUrl:this.voice.wsUrl,token:this.voice.token,roomName:this.voice.roomName,onTranscriptEvent:s=>this.handleLiveKitData(s)}});i&&(this.voiceMode=i,this.armVoiceWarm())}else{let i=Se({stack:"web-speech"});i&&(this.voiceMode=i),r?.onFinal(s=>{this.store.dispatch({type:"user_input",text:s,mode:"voice"}),this.socket?.send(O({type:"user_text",sessionId:n.sessionId,text:s,mode:"voice",visitorId:pe()}))})}this.voiceMode.onStateChange(i=>this.store.dispatch({type:"set_voice_state",state:i})),this.voiceMode.onError?.(i=>{console.warn("[shoppingmate] voice error",i),this.store.dispatch({type:"set_voice_error",error:i})}),this.socket=Sn(n.wsUrl,{sessionId:n.sessionId,onEvent:i=>{let s=We(i);s&&this.handleAgentEvent(s)},onStatus:i=>this.store.dispatch({type:"set_connection",status:i})}),(this.merchantId===Wn||this.merchantId===Fn)&&(this.inviteTimer=setTimeout(()=>{this.store.get().voiceState==="idle"&&this.store.get().mode==="pill"&&(this.store.dispatch({type:"set_invited",invited:!0}),this.inviteDismissTimer=setTimeout(()=>{let i=this.store.get();i.invited&&i.voiceState==="idle"&&i.mode==="pill"&&this.store.dispatch({type:"set_invited",invited:!1})},Vr))},5e3)),this.stopActivityTracker=sn({sessionId:n.sessionId,hints:new Map,send:i=>this.publishWidgetMessage(i)})}armVoiceWarm(){let n=this.pillHost;if(!n)return;let o=()=>this.voiceMode.warm?.();for(let i of["pointerenter","touchstart","focusin"])n.addEventListener(i,o,{passive:!0});let r=!1;this.store.subscribe(()=>{let i=this.store.get(),s=i.invited||i.mode==="chat"||i.mode==="expanded";s&&!r&&o(),r=s})}async handleAgentEvent(n,o="ws"){if(n.type==="host_action_request"){let r=await Qt(n.action),i=dn(n.action,r);i&&this.store.dispatch({type:"receipt",text:i.text,ok:i.ok}),this.publishWidgetMessage({type:"host_action_result",callId:n.callId,result:r},o);return}if(n.type!=="persona_swap"&&n.type!=="agent_warmed"){if(n.type==="agent_ready"){this.voiceMode.signalAgentReady?.();return}this.store.dispatch({type:"agent_event",event:n}),n.type==="say"&&this.voiceMode.speak(n.text)}}publishWidgetMessage(n,o="ws"){let r=O(n);if(o==="livekit"&&this.voiceMode.publishData){let i=new TextEncoder().encode(r);this.voiceMode.publishData(i);return}this.socket?.send(r)}render(){if(!this.pillHost||!this.panelHost)return;let n=this.store.get();this.onCartVisibilityChange();let o=ae()!==null;n.mode==="call"?Nn(this.panelHost,{voiceState:n.voiceState,muted:n.voiceState==="muted",transcript:n.transcript,checkoutUrl:n.checkoutUrl,personaName:this.persona.name,voiceError:n.voiceError,onClose:()=>this.store.dispatch({type:"set_mode",mode:"pill"}),onCardTap:r=>this.cardTap(r),onCheckout:()=>{}}):n.mode==="chat"||n.mode==="expanded"?On(this.panelHost,{transcript:n.transcript,checkoutUrl:n.checkoutUrl,personaName:this.persona.name,personaInitial:this.persona.initial,personaAvatarUrl:this.persona.avatarUrl,onSend:r=>this.userText(r,"text"),onCall:()=>this.openCall(),onClose:()=>this.store.dispatch({type:"set_mode",mode:"pill"}),onCardTap:r=>this.cardTap(r),closed:n.closed}):this.panelHost.innerHTML="",Un(this.pillHost,{mode:n.mode,callable:o,voiceState:n.voiceState,connection:n.connection,voiceError:n.voiceError,invited:n.invited,personaName:this.persona.name,personaInitial:this.persona.initial,personaAvatarUrl:this.persona.avatarUrl,launcherLabel:this.launcherLabel,launcherCaption:this.launcherCaption,onCall:()=>this.openCall(),onMute:r=>this.voiceMode.setMuted(r),onEnd:()=>{this.voiceMode.stop(),this.ambience.stop(),this.store.dispatch({type:"set_mode",mode:"pill"})},onChat:()=>{n.invited&&this.store.dispatch({type:"set_invited",invited:!1}),this.store.dispatch({type:"set_mode",mode:"chat"})},onClose:()=>this.store.dispatch({type:"set_mode",mode:"pill"})})}openCall(){this.store.get().invited&&(this.merchantId===Wn&&this.publishWidgetMessage({type:"tour_request"}),this.store.dispatch({type:"set_invited",invited:!1})),this.inviteTimer&&(clearTimeout(this.inviteTimer),this.inviteTimer=null),this.store.dispatch({type:"set_mode",mode:"call"}),this.voiceMode.start(),this.ambience.start()}userText(n,o){gn(),this.store.dispatch({type:"user_input",text:n,mode:o});let r=this.store.get().sessionId;this.socket?.send(O({type:"user_text",sessionId:r,text:n,mode:o,visitorId:pe()}))}handleLiveKitData(n){let o;try{o=new TextDecoder().decode(n)}catch{return}let r=We(o);r&&this.handleAgentEvent(r,"livekit")}cardTap(n){let o=this.store.get().sessionId;this.socket?.send(O({type:"card_tap",sessionId:o,action:"cartAdd",sku:n.sku,variantId:n.variantId,qty:1}))}};function Gn(){customElements.get(jn)||customElements.define(jn,dt)}window.__shoppingmateNav__={snapshot:()=>ne().text,keys:()=>be(ne().text)};function Br(){let e=document.currentScript instanceof HTMLScriptElement?document.currentScript:null,t=e?.dataset.id;if(!t){console.warn("[shoppingmate] data-id missing on script tag");return}let o=(e?.dataset.api??"https://api-production-1ea1.up.railway.app").trim(),r=document.querySelector("shoppingmate-widget");r&&(r.getAttribute("data-api")||r.setAttribute("data-api",o),r.getAttribute("data-id")||r.setAttribute("data-id",t)),Gn();let i=()=>{let s=document.querySelector("shoppingmate-widget");if(s){s.getAttribute("data-api")||s.setAttribute("data-api",o),s.getAttribute("data-id")||s.setAttribute("data-id",t);return}let a=document.createElement("shoppingmate-widget");a.setAttribute("data-id",t),a.setAttribute("data-api",o),document.body.appendChild(a)};document.readyState==="loading"?document.addEventListener("DOMContentLoaded",i,{once:!0}):i()}Br();})();
