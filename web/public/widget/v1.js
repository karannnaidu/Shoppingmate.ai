"use strict";(()=>{var Bn=Object.defineProperty;var qn=(e,t,n)=>t in e?Bn(e,t,{enumerable:!0,configurable:!0,writable:!0,value:n}):e[t]=n;var _=(e,t,n)=>qn(e,typeof t!="symbol"?t+"":t,n);function oe(e,t){let n=t.toLowerCase().replace(/[₹$£€]|rs\.?|inr|usd/g," ").replace(/\d+([.,]\d+)?/g," ").replace(/[^a-z\s]/g," ").replace(/\s+/g," ").trim().slice(0,40);return n.length<2||e==="text"?null:`${e}|${n}`}function he(e){let t=new Set;for(let n of e.split(`
`)){let o=/^\[e\d+\] ([a-z]+) "([^"]*)"/.exec(n);if(!o)continue;let r=oe(o[1],o[2]);r&&t.add(r)}return[...t]}function Gn(e,t){if(e.length===0)return 0;let n=0;for(let o of e)t.has(o)&&(n+=1);return n/e.length}function Kn(e,t){try{return new RegExp(e).test(t)}catch{return!1}}function ut(e,t,n){let o=new Set(e),r=null,i=null;for(let s of n){if(s.skeleton.length<4)continue;let a=Gn(s.skeleton,o),l=Kn(s.urlPattern,t),u=a+(l?.05:0);a>=.7&&(!r||u>r.c)&&(r={t:s,c:u}),l&&a<.7&&(!i||a<i.coverage)&&(i={template:s,coverage:a})}return r?{template:r.t,coverage:Math.min(1,r.c),drift:null}:{template:null,coverage:0,drift:i}}var Yn=new Set(["the","a","an","to","of","on","in","and","or","section","button","link","card","tile","now"]),Jn=[{keyword:"button",matchTag:/^(button)$/i,matchRole:"button"},{keyword:"link",matchTag:/^(a)$/i,matchRole:"link"},{keyword:"card",matchTag:/^(article|div|section)$/i},{keyword:"section",matchTag:/^(section|main|article)$/i}],Xn=.4;function G(e,t){if(t){let i=t.get(e.toLowerCase().trim());if(i)try{let s=document.querySelector(i);if(s instanceof HTMLElement&&q(s))return s}catch{}}let n=re(e);if(n.size===0)return null;let o=Qn(document.body),r=null;for(let i of o){if(!i.visible)continue;let s=Zn(i,e,n);s<Xn||(!r||s>r.score)&&(r={c:i,score:s})}return r?.c.element??null}function re(e){return new Set(e.toLowerCase().replace(/[^a-z0-9 ]/g," ").split(/\s+/).filter(t=>t.length>0&&!Yn.has(t)))}function Qn(e){let t=[],n=document.createTreeWalker(e,NodeFilter.SHOW_ELEMENT),o=n.nextNode();for(;o;){if(o instanceof HTMLElement){let r=Z(o);r&&t.push({element:o,role:o.getAttribute("role")??o.tagName.toLowerCase(),name:r,visible:q(o)})}o=n.nextNode()}return t}function Z(e){let t=e.getAttribute("aria-labelledby");if(t){let i=t.split(/\s+/).map(s=>document.getElementById(s)?.textContent?.trim()??"").filter(Boolean);if(i.length>0)return i.join(" ")}let n=e.getAttribute("aria-label");if(n)return n.trim();if(e.id){let i=document.querySelector(`label[for="${pt(e.id)}"]`);if(i?.textContent)return i.textContent.trim()}let o=e.getAttribute("alt")??e.getAttribute("title");if(o)return o.trim();let r=(e.textContent??"").trim();return r&&r.length<200?r:""}function q(e){if(!e.isConnected)return!1;let t=e.ownerDocument.defaultView?.getComputedStyle(e);return t?!(t.display==="none"||t.visibility==="hidden"||t.opacity==="0"):!0}function Zn(e,t,n){let o=re(e.name);if(o.size===0)return 0;let r=0;for(let m of n)o.has(m)&&r++;let i=new Set([...n,...o]).size,s=i===0?0:r/i,a=0,l=t.toLowerCase();for(let m of Jn)if(l.includes(m.keyword)&&(m.matchTag.test(e.element.tagName)||e.role===m.matchRole)){a=.15;break}let u=e.element.getAttribute("data-tour-stop"),p=0;if(u){let m=re(u.replace(/-/g," ")),v=0;for(let C of n)m.has(C)&&v++;v>0&&(p=.5*(v/n.size))}return Math.min(1,s+a+p)}function pt(e){return e.replace(/(["\\])/g,"\\$1")}function Ne(e,t){if(t){let i=t.get(e.toLowerCase().trim());if(i)try{let s=document.querySelector(i);if(s instanceof HTMLElement&&q(s))return s}catch{}}let n=re(e);if(n.size===0)return null;let o=Array.from(document.querySelectorAll("input, textarea, select")).filter(i=>q(i)&&!eo(i)),r=null;for(let i of o){let s=oo(i,n);s<=0||(!r||s>r.score)&&(r={el:i,score:s})}return r?.el??null}function eo(e){let t=(e.getAttribute("type")??"").toLowerCase();return t==="hidden"||t==="submit"||t==="button"||e.disabled}function to(e){let t=[],n=e.id;if(n){t.push(n);let l=document.querySelector(`label[for="${pt(n)}"]`);l?.textContent&&t.push(l.textContent)}let o=e.getAttribute("name");o&&t.push(o);let r=e.getAttribute("data-field")??e.getAttribute("data-testid");r&&t.push(r);let i=e.getAttribute("aria-label");i&&t.push(i);let s=e.getAttribute("placeholder");s&&t.push(s);let a=e.closest("label");return a?.textContent&&t.push(a.textContent),t}var no=[["phone","mobile","cell","contact","phonenumber","tel","whatsapp"],["pincode","pin","postal","postcode","zip","zipcode"],["name","fullname"],["email","mail","emailaddress"],["address","street","addr","address1"],["city","town"],["state","province","region"],["landmark","apartment","flat","floor"]],mt=new Map;for(let e of no)for(let t of e)mt.set(t,e[0]);function dt(e){return mt.get(e)??e}function oo(e,t){let n=new Set([...t].map(dt)),o=0;for(let r of to(e)){let i=new Set([...re(r)].map(dt));if(i.size===0)continue;let s=0;for(let l of n)i.has(l)&&s++;if(s===0)continue;let a=s/n.size;a>o&&(o=a)}return o}var be="data-sm-ref",ro=6e3,ye=["a[href]","button","input","select","textarea","summary",'[role="button"]','[role="link"]','[role="tab"]','[role="radio"]','[role="checkbox"]','[role="switch"]','[role="option"]','[role="menuitem"]','[role="combobox"]'].join(","),ft='h1,h2,h3,[role="heading"],[role="alert"],[role="status"]',io='dialog[open],[role="dialog"],[role="alertdialog"],[aria-modal="true"]',ao=/(₹|\$|£|€|Rs\.?\s?|INR\s?|USD\s?|AED\s?)\s?\d[\d,]*(\.\d+)?|\d[\d,]*(\.\d+)?\s?(₹|\$|£|€)/,Oe=new Map;function N(e){let t=e;for(;t;){if(t instanceof Element){if(t.tagName==="SHOPPINGMATE-WIDGET")return!0;for(let n of Array.from(t.attributes))if(n.name.startsWith("data-shoppingmate"))return!0}t=t.parentNode}return!1}function so(e){return e.closest('[aria-hidden="true"],[inert]')!==null}function co(){return(document.body?.getBoundingClientRect().width??0)>0}function lo(e,t){if(!t)return!0;let n=e.getBoundingClientRect();return n.width>0||n.height>0}function uo(e){let t=e.getAttribute("role");if(t)return t;let n=e.tagName.toLowerCase();if(n==="a")return"link";if(/^h[1-6]$/.test(n))return"heading";if(n==="select")return"select";if(n==="textarea")return"textbox";if(n==="input"){let o=(e.getAttribute("type")??"text").toLowerCase();return o==="radio"||o==="checkbox"?o:o==="submit"||o==="button"||o==="reset"?"button":o==="number"?"spinbutton":"textbox"}return n}function po(e){let t=Z(e);if(t)return t;if(e instanceof HTMLInputElement||e instanceof HTMLTextAreaElement||e instanceof HTMLSelectElement){let n=e.closest("label")?.textContent?.trim();if(n)return n}return e instanceof HTMLInputElement||e instanceof HTMLTextAreaElement?e.placeholder||e.name||"":e instanceof HTMLSelectElement&&e.name||""}function K(e,t=80){let n=e.replace(/\s+/g," ").trim();return n.length>t?`${n.slice(0,t-1)}\u2026`:n}function mo(e,t){let n=[];e instanceof HTMLInputElement&&(t==="radio"||t==="checkbox")?e.checked&&n.push("checked"):e.getAttribute("aria-checked")==="true"&&n.push("checked"),e.getAttribute("aria-selected")==="true"&&n.push("selected"),e.getAttribute("aria-pressed")==="true"&&n.push("pressed");let o=e.getAttribute("aria-expanded");if(o==="true"&&n.push("expanded"),o==="false"&&n.push("collapsed"),(e.disabled||e.getAttribute("aria-disabled")==="true")&&n.push("disabled"),e instanceof HTMLInputElement&&t!=="radio"&&t!=="checkbox"&&((e.getAttribute("type")??"text").toLowerCase()==="password"?e.value&&n.push("filled"):e.value&&n.push(`value="${K(e.value,40)}"`)),e instanceof HTMLTextAreaElement&&e.value&&n.push(`value="${K(e.value,40)}"`),e instanceof HTMLSelectElement){let r=e.selectedOptions[0];r&&n.push(`value="${K(r.textContent??"",40)}"`)}return n}function fo(e){let t=e.getBoundingClientRect();if(t.width===0&&t.height===0&&t.top===0)return!0;let n=window.innerHeight||800;return t.bottom>-n&&t.top<n*2}function go(e){return e.closest('footer,[role="contentinfo"]')!==null}function ho(){return Array.from(document.querySelectorAll(io)).filter(t=>q(t)&&!N(t))}function yo(e){if(e.children.length>0)return!1;let t=(e.textContent??"").trim();return!t||t.length>40?!1:ao.test(t)}function ee(e={}){let t=e.maxChars??ro,n=[];for(let f of Array.from(document.querySelectorAll(`[${be}]`)))f.removeAttribute(be);Oe=new Map;let o=ho(),r=[],i=new Set,s=0,a=co(),l=(f,c,g)=>{if(i.has(f)||N(f)||!q(f)||so(f)||!lo(f,a)||f instanceof HTMLInputElement&&f.type==="hidden")return;i.add(f);let T=c==="price"?"text":uo(f),w=c==="price"?K(f.textContent??"",40):K(po(f)),A=c==="price"?[]:mo(f,T);if(!w&&A.length===0&&c!=="interactive"||!w&&c==="interactive"&&(T==="link"||T==="button"))return;let R=!g&&go(f),D=!g&&f.closest('nav,header,[role="navigation"],[role="banner"]')!==null;if(e.collapse&&T==="link"&&(R||D)){let B=oe(T,w);if(B&&e.collapse.has(B)){n.length<12&&w.length<=24&&!/\d{3}|@/.test(w)&&!n.includes(w)&&n.push(w);return}}let P=g?0:c==="interactive"?2:c==="context"?1:2;!g&&!fo(f)&&(P+=3),R&&(P+=4),D&&(P+=2);let fe=A.length>0?` (${A.join(", ")})`:"",V=`${T} "${w}"${fe}`;r.push({el:f,line:V,priority:P,order:s++})};for(let f of o){let c=K(Z(f)||"dialog",60);r.push({el:f,line:`dialog "${c}" (open)`,priority:0,order:s++}),i.add(f);for(let g of Array.from(f.querySelectorAll(`${ye},${ft}`)))l(g,g.matches(ye)?"interactive":"context",!0)}let u=document.querySelector('main,[role="main"]')??document.body,p=u===document.body?[document.body]:[u,document.body];for(let f of p)for(let c of Array.from(f.querySelectorAll(`${ye},${ft}`)))l(c,c.matches(ye)?"interactive":"context",!1);let m=0;for(let f of Array.from(u.querySelectorAll("span,div,p,strong,b,s,del,ins,bdi"))){if(m>=15)break;if(!yo(f))continue;let c=r.length;l(f,"price",!1),r.length>c&&(m+=1)}let v=[`[page] ${K(document.title||"",70)} \xB7 ${location.pathname}`,...e.preface??[]];n.length>0&&v.push(`[site links] ${n.join(", ")} (standard site navigation \u2014 use site.navigate)`);let C=[...r].sort((f,c)=>f.priority-c.priority||f.order-c.order),S=[],H=v.join(`
`).length+1;for(let f of C){let c=f.line.length+8;H+c>t||(S.push(f),H+=c)}S.sort((f,c)=>f.order-c.order);let b=[...v],E=0;for(let f of S){E+=1;let c=`e${E}`;f.el.setAttribute(be,c),Oe.set(c,f.el),b.push(`[${c}] ${f.line}`)}let k=r.length-S.length;k>0&&b.push(`\u2026 ${k} more elements not shown (lower on the page or in the footer)`);let M=b.join(`
`);return{text:M,refs:E,chars:M.length,truncated:k}}function ve(e){let t=e.replace(/^\[|\]$/g,"").trim(),n=Oe.get(t);if(n?.isConnected)return n;try{let o=document.querySelector(`[${be}="${CSS.escape(t)}"]`);return o?.isConnected?o:null}catch{return null}}var gt={start:()=>{},stop:()=>{}};function De(e){if(!e||typeof window>"u")return gt;let t=window.AudioContext??window.webkitAudioContext;if(!t)return gt;let n=null,o=null;return{start(){if(!n)try{n=new t;let r=Math.floor(n.sampleRate*2),i=n.createBuffer(1,r,n.sampleRate),s=i.getChannelData(0),a=0;for(let p=0;p<r;p++){let m=Math.random()*2-1;a=(a+.02*m)/1.02,s[p]=a*3.5}o=n.createBufferSource(),o.buffer=i,o.loop=!0;let l=n.createBiquadFilter();l.type="lowpass",l.frequency.value=900;let u=n.createGain();u.gain.value=.02,o.connect(l).connect(u).connect(n.destination),o.start(),n.resume?.().catch(()=>{})}catch{this.stop()}},stop(){try{o?.stop()}catch{}o=null;try{n?.close()}catch{}n=null}}}function ie(){let e=globalThis,t=e.SpeechRecognition??e.webkitSpeechRecognition;if(!t)return null;let n=new t;n.continuous=!0,n.interimResults=!1,n.lang="en-US";let o=!1,r=[],i=[];return n.onresult=s=>{for(let a=0;a<s.results.length;a+=1){let l=s.results[a];if(l?.isFinal){let u=l[0]?.transcript?.trim();if(u)for(let p of r)p(u)}}},n.onerror=s=>{for(let a of i)a(String(s?.error??"unknown"))},n.onend=()=>{o=!1},{start:()=>{if(!o){o=!0;try{n.start()}catch{}}},stop:()=>{if(o){o=!1;try{n.stop()}catch{}}},onFinal:s=>{r.push(s)},onError:s=>{i.push(s)},isActive:()=>o}}function we(){let e=globalThis.speechSynthesis;if(!e)return{speak:async()=>{},cancel:()=>{},available:()=>!1};function t(){if(!e)return null;let n=e.getVoices();return n.find(o=>o.lang.startsWith("en-")&&o.default)??n.find(o=>o.lang.startsWith("en-"))??n[0]??null}return{speak:n=>new Promise(o=>{let r=new SpeechSynthesisUtterance(n),i=t();i&&(r.voice=i),r.rate=1,r.onend=()=>o(),r.onerror=()=>o(),e.speak(r)}),cancel:()=>e.cancel(),available:()=>!0}}function te(e,t){let n="idle",o=!1,r=[],i=s=>{if(n!==s){n=s;for(let a of r)a(s)}};return{start:()=>{if(n==="idle"){if(o){i("muted");return}e?.start(),i("listening")}},stop:()=>{e?.stop(),t.cancel(),i("idle")},speak:async s=>{n!=="idle"&&(e?.stop(),i("speaking"),await t.speak(s),o?i("muted"):(e?.start(),i("listening")))},setMuted:s=>{o=s,s?(e?.stop(),n==="listening"&&i("muted")):n==="muted"&&(e?.start(),i("listening"))},getState:()=>n,onStateChange:s=>{r.push(s)}}}function bo(e){if(!e||typeof e.type!="string")return!1;switch(e.type){case"navigate":return typeof e.path=="string";case"click":return typeof e.intent=="string"&&(e.ref===void 0||typeof e.ref=="string");case"scroll_to":case"highlight":case"point_at":case"demo_click":return typeof e.intent=="string";case"cart_add":case"cart_set_qty":return typeof e.sku=="string"&&typeof e.qty=="number";case"open_cart":case"cart_clear":case"cart_get":case"checkout_place":case"checkout_state":case"page_snapshot":return!0;case"apply_coupon":return typeof e.code=="string";case"product_lookup":return typeof e.handle=="string";case"checkout_fill":return!!e.details&&typeof e.details.name=="string"&&typeof e.details.phone=="string"&&typeof e.details.email=="string"&&typeof e.details.address=="string"&&typeof e.details.city=="string"&&typeof e.details.state=="string"&&typeof e.details.pincode=="string"&&(e.details.payment==="cod"||e.details.payment==="prepaid");case"form_fill":return Array.isArray(e.fields)&&e.fields.every(t=>t&&typeof t.field=="string"&&typeof t.value=="string"&&(t.ref===void 0||typeof t.ref=="string"));case"form_read":return e.fields===void 0||Array.isArray(e.fields);default:return!1}}function $(e){return JSON.stringify(e)}function Ve(e){let t;try{t=JSON.parse(e)}catch{return null}if(!t||typeof t!="object")return null;let n=t;switch(n.type){case"thinking":return{type:"thinking"};case"say":return typeof n.text=="string"?{type:"say",text:n.text}:null;case"say_partial":return typeof n.text=="string"?{type:"say_partial",text:n.text}:null;case"user_text":return typeof n.text=="string"?{type:"user_text",text:n.text}:null;case"cards":return Array.isArray(n.items)?{type:"cards",items:n.items}:null;case"tool_result":return typeof n.toolName!="string"||typeof n.ok!="boolean"?null:{type:"tool_result",toolName:n.toolName,ok:n.ok,summary:typeof n.summary=="string"?n.summary:void 0};case"checkout_redirect":return typeof n.url=="string"?{type:"checkout_redirect",url:n.url}:null;case"cap_warning":return n.reason!=="turns"&&n.reason!=="voice_ms"&&n.reason!=="duration_ms"||typeof n.remaining!="number"?null:{type:"cap_warning",reason:n.reason,remaining:n.remaining};case"end_of_turn":return{type:"end_of_turn"};case"session_closed":return n.reason!=="user"&&n.reason!=="cap"&&n.reason!=="error"?null:{type:"session_closed",reason:n.reason};case"host_action_request":{if(typeof n.callId!="string"||!n.action)return null;let o=n.action;return bo(o)?{type:"host_action_request",callId:n.callId,action:o}:null}case"persona_swap":return typeof n.personaId=="string"?{type:"persona_swap",personaId:n.personaId}:null;case"agent_warmed":return{type:"agent_warmed"};case"agent_ready":return{type:"agent_ready"};default:return null}}var ht="https://cdn.jsdelivr.net/npm",vo="2.7.0",wo="0.3.0",xe=null;function xo(){return xe||(xe=import(`${ht}/@livekit/krisp-noise-filter@${wo}/dist/index.mjs`).catch(()=>null),xe)}async function ko(e){let t=await xo();if(!t?.KrispNoiseFilter||t.isKrispNoiseFilterSupported&&!t.isKrispNoiseFilterSupported())return;let n=e.localParticipant.getTrackPublication?.("microphone"),o=n?.audioTrack??n?.track;o?.setProcessor&&await o.setProcessor(t.KrispNoiseFilter())}var Y=null;function yt(){return Y||(typeof globalThis.__SHOPPINGMATE_LIVEKIT_LOADER__=="function"?(Y=globalThis.__SHOPPINGMATE_LIVEKIT_LOADER__(),Y):(Y=import(`${ht}/livekit-client@${vo}/dist/livekit-client.esm.mjs`),Y))}function bt(){yt().catch(()=>{Y=null})}function _o(){try{if(typeof window<"u"){let t=window;if(typeof t.__SM_AUDIO_FULL__=="boolean")return t.__SM_AUDIO_FULL__}let e=new URLSearchParams(location.search).get("smAudioFull");return!(e==="0"||e==="false")}catch{return!0}}async function vt(e){let t=await yt(),n=_o(),o=new t.Room({audioCaptureDefaults:{echoCancellation:!0,noiseSuppression:!0,autoGainControl:n,channelCount:1}}),r=new Map,i=!1;o.on("trackSubscribed",a=>{let l=a;if(l.kind!=="audio")return;let u=l.attach();u.style.display="none",u.muted=i,document.body.appendChild(u),r.set(a,u)}),o.on("trackUnsubscribed",a=>{let l=r.get(a);l&&(l.remove(),r.delete(a)),a.detach?.()});let s=[];return o.on("activeSpeakersChanged",a=>{let u=(a??[]).some(p=>!p.isLocal);for(let p of s)p(u)}),await o.connect(e.wsUrl,e.token),{setMicEnabled:async a=>{await o.localParticipant.setMicrophoneEnabled(a),a&&n&&ko(o).catch(()=>{})},onData:a=>{o.on("dataReceived",l=>{l instanceof Uint8Array&&a(l)})},onAgentSpeaking:a=>{s.push(a)},setAgentAudioMuted:a=>{i=a;for(let l of r.values())l.muted=a},onReconnected:a=>{o.on("reconnected",()=>a())},publishData:a=>o.localParticipant.publishData(a,{reliable:!0}),disconnect:async()=>{for(let a of r.values())a.remove();r.clear(),await o.disconnect()}}}function wt(e){let t="idle",n=null,o=null,r=!1,i=!1,s=!1,a=6e4,l=null,u=()=>{l&&clearTimeout(l),l=null},p=0,m=null,v=c=>{m&&!(c in m)&&(m[c]=Math.round(performance.now()-p))},C=()=>{if(!m||!n)return;let c=$({type:"voice_timing",sessionId:e.sessionId,timings:m});m=null,n.publishData(new TextEncoder().encode(c)).catch(()=>{})},S=[],H=[],b=c=>{if(t!==c){t=c;for(let g of S)g(c)}},E=c=>{let g=c instanceof Error?c.message:String(c),T=c instanceof Error?c.name:"",w;/permissions? policy|feature policy/i.test(g)?w="mic_policy_blocked":T==="NotAllowedError"||/denied|permission/i.test(g)?w="mic_denied":T==="NotFoundError"||/no.*microphone|not.*found/i.test(g)?w="mic_unavailable":/connect|network|websocket|timeout|token/i.test(g)?w="connect_failed":w="unknown";for(let A of H)A({code:w,message:g})},k=async c=>{await c.setMicEnabled(!r);let g=new TextEncoder().encode($({type:"start_voice",sessionId:e.sessionId}));await c.publishData(g)},M=()=>{u(),!s&&(l=setTimeout(()=>{s||!n||(n.disconnect().catch(()=>{}),n=null,o=null)},a))},f=()=>n?(M(),Promise.resolve(n)):o||(o=(async()=>{let c=await vt({wsUrl:e.wsUrl,token:e.token,roomName:e.roomName});return c.onData(g=>e.onTranscriptEvent(g)),c.onAgentSpeaking(g=>{g&&m&&(v("first_audio"),C()),!r&&(g&&(i=!0),i&&b(g?"speaking":"listening"))}),c.onReconnected(()=>{s&&(b("connecting"),i=!1,k(c).catch(g=>console.warn("[voiceModeLiveKit] re-start after reconnect failed",g)))}),n=c,M(),c})(),o.catch(()=>{o=null}),o);return{warm:()=>{f().catch(c=>console.warn("[voiceModeLiveKit] warm failed",c))},start:()=>{t==="idle"&&(b("connecting"),i=!1,u(),p=performance.now(),m={was_warm:n?1:0},(async()=>{try{let c=await f();u(),v("room_connected"),await k(c),v("mic_on"),s=!0,r&&b("muted")}catch(c){throw b("idle"),E(c),c}})().catch(c=>{console.warn("[voiceModeLiveKit] start failed",c)}))},stop:()=>{u(),m&&(v("hung_up"),C()),n?.disconnect().catch(()=>{}),n=null,o=null,s=!1,b("idle")},speak:async()=>{},setMuted:c=>{r=c,n?.setMicEnabled(!c).catch(()=>{}),n?.setAgentAudioMuted(c),c?b("muted"):t==="muted"&&b("listening")},getState:()=>t,onStateChange:c=>{S.push(c)},onError:c=>{H.push(c)},signalAgentReady:()=>{i=!0,v("agent_ready"),t==="connecting"&&b(r?"muted":"listening")},publishData:async c=>{n&&await n.publishData(c)}}}function ke(e){return e.stack==="web-speech"?te(ie(),we()):e.stack==="live-kit"?e.livekit?wt(e.livekit):(console.warn("[voiceModeFactory] live-kit stack requires livekit opts; returning null \u2192 caller falls back to chat"),null):null}async function xt(e){if(e.platform!=="shopify")return;let t=e.fetchFn??fetch;try{await t("/cart/update.js",{method:"POST",credentials:"same-origin",headers:{"Content-Type":"application/json"},body:JSON.stringify({attributes:{sm_visitor_id:e.visitorId}})})}catch{}}var ze={"Content-Type":"application/json"};function kt(e){let t=Number(String(e).trim());return Number.isFinite(t)&&t>0?t:null}function Ue(e){try{let t={cart:e},n=["cart:refresh","cart:updated","cart:change","cart:build","cart:rerender","ajaxCart:afterCartLoad","cart.requestComplete","added.ajaxProduct"];for(let i of n)document.dispatchEvent(new CustomEvent(i,{bubbles:!0,detail:t})),window.dispatchEvent(new CustomEvent(i,{bubbles:!0,detail:t}));let o=window;typeof o.getCartUpdate=="function"&&o.getCartUpdate(),typeof o.after_add_to_cart=="function"&&o.after_add_to_cart(e);let r=o.jQuery;if(r)try{r(document.body).trigger("cart:updated",[e]),r(document.body).trigger("added.ajaxProduct")}catch{}}catch{}Co()}var So=["cart-icon-bubble","cart-live-region-text","cart-notification-button","cart-drawer"];async function Co(e=fetch){try{let t=So.filter(i=>document.getElementById(`shopify-section-${i}`)||document.getElementById(i));if(t.length===0)return 0;let n=await e(`${location.pathname}?sections=${t.join(",")}`,{credentials:"same-origin"});if(!n.ok)return 0;let o=await n.json(),r=0;for(let[i,s]of Object.entries(o)){if(!s)continue;let a=document.getElementById(`shopify-section-${i}`)??document.getElementById(i);if(!a)continue;let l=new DOMParser().parseFromString(s,"text/html"),u=l.getElementById(`shopify-section-${i}`)??l.querySelector(".shopify-section")??l.body;a.innerHTML=u.innerHTML,r+=1}return r}catch{return 0}}async function _t(e,t=fetch){let n=String(e??"").trim().replace(/^\/?products\//,"").replace(/[?#].*$/,"").replace(/\/$/,"");if(!n)return{ok:!1,reason:"not_found"};try{let o=await t(`/products/${encodeURIComponent(n)}.js`,{credentials:"same-origin"});if(!o.ok)return{ok:!1,reason:"not_found"};let r=await o.json(),i=(r.variants??[]).slice(0,30).map(s=>`${s.title??"Default"} (variantId ${s.id}, ${s.available?"in stock":"SOLD OUT"}${s.price!=null?`, ${(s.price/100).toFixed(2)}`:""})`).join("; ");return{ok:!0,channel:"shopify-ajax",values:{title:r.title??n,available:String(r.available??!1),variants:i}}}catch{return{ok:!1,reason:"not_found"}}}async function je(e){try{let t=await e("/cart.js",{credentials:"same-origin"});return t.ok?await t.json():null}catch{return null}}function We(e){let t=(e.items??[]).map(n=>`${n.product_title??"item"}${n.variant_title?` ${n.variant_title}`:""} x${n.quantity}`).join(", ");return{count:String(e.item_count??0),items:t,subtotal:e.total_price!=null?(e.total_price/100).toFixed(2):""}}async function St(e,t,n=fetch){let o=kt(e);if(o==null)return{ok:!1,reason:"not_found"};try{if(!(await n("/cart/add.js",{method:"POST",credentials:"same-origin",headers:ze,body:JSON.stringify({id:o,quantity:t>0?t:1})})).ok)return{ok:!1,reason:"not_found"};let i=await je(n);return i&&i.items.some(s=>s.id===o)?(Ue(i),{ok:!0,values:We(i)}):{ok:!1,reason:"not_found"}}catch{return{ok:!1,reason:"not_found"}}}async function Ct(e=fetch){let t=await je(e);return t?{ok:!0,values:We(t)}:{ok:!1,reason:"not_found"}}async function Tt(e,t,n=fetch){let o=kt(e);if(o==null)return{ok:!1,reason:"not_found"};try{let r=await n("/cart/change.js",{method:"POST",credentials:"same-origin",headers:ze,body:JSON.stringify({id:o,quantity:Math.max(0,t)})});if(!r.ok)return{ok:!1,reason:"not_found"};let i=await r.json().catch(()=>null);return Ue(i),i?{ok:!0,values:We(i)}:{ok:!0}}catch{return{ok:!1,reason:"not_found"}}}async function Et(e=fetch){try{return(await e("/cart/clear.js",{method:"POST",credentials:"same-origin",headers:ze})).ok?(Ue(await je(e)),{ok:!0}):{ok:!1,reason:"not_found"}}catch{return{ok:!1,reason:"not_found"}}}async function At(e,t=fetch){let n=String(e??"").trim();if(!n)return{ok:!1,reason:"not_found"};try{return await t(`/discount/${encodeURIComponent(n)}`,{method:"GET",credentials:"same-origin",redirect:"manual"})?{ok:!0}:{ok:!1,reason:"not_found"}}catch{return{ok:!1,reason:"not_found"}}}var Mt="/wp-json/wc/store/v1",ae=null;function To(){let e={"Content-Type":"application/json"};return ae&&(e.Nonce=ae,e["X-WC-Store-API-Nonce"]=ae),e}function Lt(e){let t=e.headers.get("Nonce")??e.headers.get("X-WC-Store-API-Nonce");t&&(ae=t)}async function U(e){try{let t=await e(`${Mt}/cart`,{credentials:"same-origin"});return Lt(t),t.ok?await t.json():null}catch{return null}}function Se(e){let t=e.totals?.currency_minor_unit??2,n=e.totals?.total_price;return{count:String(e.items_count??0),items:(e.items??[]).map(o=>`${o.name??"item"} x${o.quantity}`).join(", "),subtotal:n!=null?(Number(n)/10**t).toFixed(t):""}}function Fe(){try{document.body.dispatchEvent(new CustomEvent("wc-blocks_added_to_cart",{bubbles:!0}));let e=window.jQuery;e?.(document.body).trigger("wc_fragment_refresh")}catch{}}function It(e){let t=Number(String(e).trim());return Number.isFinite(t)&&t>0?t:null}async function _e(e,t,n){ae||await U(n);let o=await n(`${Mt}${e}`,{method:"POST",credentials:"same-origin",headers:To(),body:JSON.stringify(t)});return Lt(o),o}async function Ht(e,t,n=fetch){let o=It(e);if(o==null)return{ok:!1,reason:"not_found"};try{let r=(await U(n))?.items.find(l=>l.id===o)?.quantity??0;if(!(await _e("/cart/add-item",{id:o,quantity:t>0?t:1},n)).ok)return{ok:!1,reason:"not_found"};let s=await U(n),a=s?.items.find(l=>l.id===o)?.quantity??0;return!s||a<=r?{ok:!1,reason:"not_found"}:(Fe(),{ok:!0,channel:"woo-store-api",verified:!0,values:Se(s)})}catch{return{ok:!1,reason:"not_found"}}}async function Rt(e=fetch){let t=await U(e);return t?{ok:!0,channel:"woo-store-api",values:Se(t)}:{ok:!1,reason:"not_found"}}async function Pt(e,t,n=fetch){let o=It(e);if(o==null)return{ok:!1,reason:"not_found"};try{let r=(await U(n))?.items.find(l=>l.id===o);if(!r)return{ok:!1,reason:"not_found"};if(!(t<=0?await _e("/cart/remove-item",{key:r.key},n):await _e("/cart/update-item",{key:r.key,quantity:t},n)).ok)return{ok:!1,reason:"not_found"};let s=await U(n),a=s?.items.find(l=>l.id===o)?.quantity??0;return!s||a!==Math.max(0,t)?{ok:!1,reason:"not_found"}:(Fe(),{ok:!0,channel:"woo-store-api",verified:!0,values:Se(s)})}catch{return{ok:!1,reason:"not_found"}}}async function $t(e=fetch){try{let t=await U(e);for(let o of t?.items??[])await _e("/cart/remove-item",{key:o.key},e);let n=await U(e);return!n||n.items.length>0?{ok:!1,reason:"not_found"}:(Fe(),{ok:!0,channel:"woo-store-api",verified:!0,values:Se(n)})}catch{return{ok:!1,reason:"not_found"}}}var Eo="data-shoppingmate-bot-cursor",Nt="data-shoppingmate-cursor-keyframes",se=null,Be=window.innerWidth-80,qe=window.innerHeight-80;function Ot(){if(se&&se.isConnected)return se;Ao();let e=document.createElement("div");return e.setAttribute(Eo,""),e.innerHTML=`
    <svg width="22" height="22" viewBox="0 0 22 22" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path d="M3 2 L3 17 L7 13 L9.5 19 L12 18 L9.5 12 L15 12 Z"
            fill="#111827" stroke="#fff" stroke-width="1.2" stroke-linejoin="round"/>
    </svg>
  `,Object.assign(e.style,{position:"fixed",left:"0",top:"0",transform:`translate(${Be}px, ${qe}px)`,transition:"transform 480ms cubic-bezier(0.22, 1, 0.36, 1), opacity 200ms",pointerEvents:"none",zIndex:"2147483647",opacity:"0",willChange:"transform, opacity",filter:"drop-shadow(0 2px 6px rgba(0,0,0,0.25))"}),document.body.appendChild(e),se=e,e}function Ao(){if(document.head.querySelector(`style[${Nt}]`))return;let e=document.createElement("style");e.setAttribute(Nt,""),e.textContent=`
    @keyframes shoppingmate-cursor-click {
      0%   { transform: var(--sm-cursor-pos) scale(1); }
      40%  { transform: var(--sm-cursor-pos) scale(0.72); }
      100% { transform: var(--sm-cursor-pos) scale(1); }
    }
  `,document.head.appendChild(e)}function Mo(e){let t=e.getBoundingClientRect();return{x:t.left+t.width/2-6,y:t.top+t.height/2-6}}function J(e,t=480){let n=Ot(),{x:o,y:r}=Mo(e);return n.style.transitionDuration=`${t}ms, 200ms`,n.style.opacity="1",n.style.transform=`translate(${o}px, ${r}px)`,Be=o,qe=r,new Promise(i=>setTimeout(i,t))}function ce(){let e=Ot();return e.style.setProperty("--sm-cursor-pos",`translate(${Be}px, ${qe}px)`),e.style.animation="shoppingmate-cursor-click 280ms ease-out",new Promise(t=>{let n=()=>{e.style.animation="",e.removeEventListener("animationend",n),t()};e.addEventListener("animationend",n),setTimeout(n,360)})}function j(e=600){let t=se;t&&setTimeout(()=>{t.style.opacity="0"},e)}function Lo(e,t){let n=e instanceof HTMLTextAreaElement?HTMLTextAreaElement.prototype:e instanceof HTMLSelectElement?HTMLSelectElement.prototype:HTMLInputElement.prototype,o=Object.getOwnPropertyDescriptor(n,"value");o?.set?o.set.call(e,t):e.value=t,e.dispatchEvent(new Event("input",{bubbles:!0})),e.dispatchEvent(new Event("change",{bubbles:!0}))}function Ge(e){return e.value??""}var Dt="sm_selector_cache_v1";function Io(){try{return JSON.parse(localStorage.getItem(Dt)??"{}")}catch{return{}}}function Ho(e){try{localStorage.setItem(Dt,JSON.stringify(e))}catch{}}function Ro(e){return`${location.pathname}::${e}`}function Po(e){let t=e.getAttribute("data-sm-field");if(t)return`[data-sm-field="${CSS.escape(t)}"]`;if(e.id)return`#${CSS.escape(e.id)}`;let n=e.getAttribute("name");return n?`[name="${CSS.escape(n)}"]`:null}function $o(e,t){let n=Io(),o=Ro(e),r=n[o];if(r)try{let s=document.querySelector(r);if(s?.isConnected)return s}catch{}let i=null;try{i=document.querySelector(`[data-sm-field="${CSS.escape(e)}"]`)}catch{i=null}if(i||(i=Ne(e,t)),i){let s=Po(i);s&&(n[o]=s,Ho(n))}return i}function Vt(e,t){let n={},o=[],r=!1;for(let{field:i,value:s,ref:a}of e){let l=a?ve(a):null,u=l&&/^(INPUT|TEXTAREA|SELECT)$/.test(l.tagName)?l:$o(i,t);if(!u){o.push({field:i,ok:!1,value:""});continue}r=!0,Lo(u,s);let p=Ge(u);n[i]=p,o.push({field:i,ok:p===s,value:p})}return r?{ok:!0,values:n,filled:o}:{ok:!1,reason:"not_found"}}function zt(e,t){let n={};if(e&&e.length>0){for(let r of e){let i=Ne(r,t);i&&(n[r]=Ge(i))}return{ok:!0,values:n}}let o=document.querySelectorAll("input, textarea, select");for(let r of o){let i=(r.getAttribute("type")??"").toLowerCase();if(i==="password"||i==="hidden")continue;let s=r.getAttribute("name")??r.id;s&&(n[s]=Ge(r))}return{ok:!0,values:n}}var No="data-shoppingmate-pulse-ring";function jt(e,t){let n=e.getBoundingClientRect(),o=document.createElement("div");o.setAttribute(No,""),Object.assign(o.style,{position:"fixed",left:`${n.left-6}px`,top:`${n.top-6}px`,width:`${n.width+12}px`,height:`${n.height+12}px`,borderRadius:"14px",boxShadow:"0 0 0 3px rgba(139,92,246,0.85), 0 0 24px rgba(139,92,246,0.55)",pointerEvents:"none",zIndex:"2147483646",animation:"shoppingmate-pulse 1.2s ease-in-out infinite"}),Oo(),document.body.appendChild(o);let r=!1,i=()=>{r||(r=!0,o.remove())};return setTimeout(i,t),i}var Ut=!1;function Oo(){if(Ut)return;Ut=!0;let e=document.createElement("style");e.textContent=`@keyframes shoppingmate-pulse {
    0%, 100% { transform: scale(1); opacity: 1; }
    50% { transform: scale(1.04); opacity: 0.85; }
  }`,document.head.appendChild(e)}var le=null,Ce=null,Ke=new Set;function Wt(e){le=e,Ce=null,Ke.clear()}function Te(e=fetch){if(!le)return Promise.resolve([]);if(!Ce){let{apiBase:t,merchantId:n}=le;Ce=e(`${t}/v1/site-templates/${encodeURIComponent(n)}`).then(o=>o.ok?o.json():{templates:[]}).then(o=>Array.isArray(o.templates)?o.templates:[]).catch(()=>[])}return Ce}function Ye(e,t,n,o=fetch){if(!le)return;let r=`${e}:${t}`;if(Ke.has(r))return;Ke.add(r);let{apiBase:i,merchantId:s,sessionId:a}=le;o(`${i}/v1/site-templates/${encodeURIComponent(s)}/signal`,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({kind:e,templateId:t,coverage:n,sessionId:a,path:location.pathname}),keepalive:!0}).catch(()=>{})}var Do=["[data-cart-count]","#cart-icon-bubble",".cart-count",".cart-count-bubble",'[class*="cart-count"]','[class*="CartCount"]'].join(",");function Ft(){return(document.querySelector(Do)?.textContent??"").replace(/\s+/g," ").trim()}function Bt(){return Array.from(document.querySelectorAll('dialog[open],[role="dialog"],[aria-modal="true"]')).filter(e=>!N(e)&&e.getAttribute("aria-hidden")!=="true").length}function qt(e){let t=e;return[e.getAttribute("aria-expanded"),e.getAttribute("aria-checked"),e.getAttribute("aria-selected"),e.getAttribute("aria-pressed"),typeof t.checked=="boolean"?String(t.checked):"",e.className].join("|")}async function Je(e,t,n=1500){let o=location.href,r=Ft(),i=Bt(),s=e?qt(e):"",a=0,l=new MutationObserver(p=>{for(let m of p)N(m.target)||m.type==="attributes"&&m.attributeName==="data-sm-ref"||(a+=1)});l.observe(document.body,{subtree:!0,childList:!0,attributes:!0,characterData:!0});let u=()=>{if(location.href!==o)return{verified:!0,observed:`navigated to ${location.pathname}`};let p=Ft();if(p!==r)return{verified:!0,observed:`cart count ${r||"0"} \u2192 ${p||"0"}`};let m=Bt();return m>i?{verified:!0,observed:"a dialog/drawer opened"}:m<i?{verified:!0,observed:"a dialog/drawer closed"}:e?.isConnected&&qt(e)!==s?{verified:!0,observed:"the control changed state"}:a>0?{verified:!0,observed:"the page updated"}:null};try{await t();let p=Date.now()+n;await new Promise(v=>setTimeout(v,50));let m=u();for(;!m&&Date.now()<p;)await new Promise(v=>setTimeout(v,100)),m=u();return m??{verified:!1,observed:"nothing changed on the page"}}finally{l.disconnect()}}var Ae=null;function Gt(e){Ae=e??null}function Ee(){if(Ae==="shopify")return!0;if(Ae)return!1;try{return typeof window.Shopify<"u"}catch{return!1}}function ue(){return Ee()?"shopify-ajax":Ae==="woocommerce"?"woo-store-api":"storefront-hooks"}async function W(e,t){let n=await t;return n.ok?{channel:e,...n}:n}async function Kt(e){switch(e.type){case"navigate":return Xe(e.path);case"scroll_to":return Qo(e.intent);case"highlight":return Zo(e.intent,e.durationMs??2e3);case"click":return e.ref?zo(e.ref,e.intent):er(e.intent);case"point_at":return tr(e.intent);case"demo_click":return nr(e.intent);case"cart_add":{let t=ue();return t==="shopify-ajax"?W(t,St(e.sku,e.qty)):t==="woo-store-api"?Ht(e.sku,e.qty):W(t,Fo(e.sku,e.qty))}case"open_cart":return ue()==="woo-store-api"||Ee()?Xe("/cart"):Bo();case"cart_set_qty":{let t=ue();return t==="shopify-ajax"?W(t,Tt(e.sku,e.qty)):t==="woo-store-api"?Pt(e.sku,e.qty):W(t,Ko(e.sku,e.qty))}case"cart_clear":{let t=ue();return t==="shopify-ajax"?W(t,Et()):t==="woo-store-api"?$t():W(t,Go())}case"cart_get":{let t=ue();return t==="shopify-ajax"?W(t,Ct()):t==="woo-store-api"?Rt():W(t,qo())}case"product_lookup":return Ee()?_t(e.handle):{ok:!1,reason:"not_found"};case"apply_coupon":return Ee()?At(e.code):Yo(e.code);case"checkout_fill":return jo(e.details);case"checkout_place":return Wo();case"checkout_state":return Uo();case"form_fill":return Vt(e.fields);case"form_read":return zt(e.fields);case"page_snapshot":return Vo()}}var Me=null;async function Vo(){let e=performance.now(),t=ee(),n={};Me=null;let o=await Te();if(o.length>0){let r=ut(he(t.text),location.pathname,o);if(r.template){Me=r.template.id;let i=r.template.recipes.slice(0,6).map(s=>`${s.action.replace(/_/g," ")} = ${s.role} "${s.name}"`).join("; ");t=ee({collapse:new Set(r.template.skeleton),preface:[`[template] ${r.template.pageType} page (known layout, ${Math.round(r.coverage*100)}% match)${i?` \xB7 how this page works: ${i}`:""}`]}),n.template=r.template.pageType,n.coverage=r.coverage.toFixed(2)}else r.drift&&(Ye("drift",r.drift.template.id,r.drift.coverage),n.drift=`${r.drift.template.pageType}:${r.drift.coverage.toFixed(2)}`)}return{ok:!0,values:{snapshot:t.text,refs:String(t.refs),chars:String(t.chars),buildMs:String(Math.round(performance.now()-e)),...n}}}function Yt(e){!e&&Me&&Ye("verify",Me,0)}function Jt(e){let t=e.closest("a[href]");if(!t||t.target==="_blank")return null;try{let n=new URL(t.href,window.location.href);return n.origin!==window.location.origin||n.pathname===window.location.pathname&&n.search===window.location.search?null:n.pathname}catch{return null}}async function zo(e,t){let n=ve(e)??(t?G(t):null);if(!n)return{ok:!1,reason:"stale_target"};if(await Qe(n),await J(n,420),await ce(),!n.isConnected)return{ok:!1,reason:"stale_target"};let o=Jt(n);if(o)return n.click(),j(800),{ok:!0,verified:!0,observed:`navigating to ${o}`};let r=await Je(n,()=>n.click());return j(800),Yt(r.verified),{ok:!0,verified:r.verified,observed:r.observed}}async function Uo(){let e=window.__shoppingmateCheckoutState__;if(typeof e!="function")return{ok:!1,reason:"not_found"};try{return await e()?{ok:!0}:{ok:!1,reason:"not_found"}}catch{return{ok:!1,reason:"not_found"}}}async function jo(e){let t=window.__shoppingmateCheckoutFill__;if(typeof t!="function")return{ok:!1,reason:"not_found"};try{return await t(e)?{ok:!0}:{ok:!1,reason:"not_found"}}catch{return{ok:!1,reason:"not_found"}}}async function Wo(){let e=window.__shoppingmatePlaceOrder__;if(typeof e!="function")return{ok:!1,reason:"not_found"};try{return await e()?{ok:!0}:{ok:!1,reason:"not_found"}}catch{return{ok:!1,reason:"not_found"}}}function Fo(e,t){let n=window.__shoppingmateCartAdd__;if(typeof n!="function")return{ok:!1,reason:"not_found"};try{return n(e,t)?{ok:!0}:{ok:!1,reason:"not_found"}}catch{return{ok:!1,reason:"not_found"}}}function Bo(){let e=window.__shoppingmateOpenCart__;if(typeof e!="function")return{ok:!1,reason:"not_found"};try{return e(),{ok:!0}}catch{return{ok:!1,reason:"not_found"}}}function qo(){let e=window.__shoppingmateGetCart__;if(typeof e!="function")return{ok:!1,reason:"not_found"};try{let t=e(),n=(t?.items??[]).map(o=>`${o.sku??o.name??"item"} x${o.quantity??1}`).join(", ");return{ok:!0,values:{count:String(t?.count??0),items:n,subtotal:t?.subtotal!=null?String(t.subtotal):""}}}catch{return{ok:!1,reason:"not_found"}}}function Go(){let e=window.__shoppingmateClearCart__;if(typeof e!="function")return{ok:!1,reason:"not_found"};try{return e()?{ok:!0}:{ok:!1,reason:"not_found"}}catch{return{ok:!1,reason:"not_found"}}}function Ko(e,t){let n=window.__shoppingmateCartSetQty__;if(typeof n!="function")return{ok:!1,reason:"not_found"};try{return n(e,t)?{ok:!0}:{ok:!1,reason:"not_found"}}catch{return{ok:!1,reason:"not_found"}}}async function Yo(e){let t=window.__shoppingmateApplyCoupon__;if(typeof t!="function")return{ok:!1,reason:"not_found"};try{return await t(e)?{ok:!0}:{ok:!1,reason:"not_found"}}catch{return{ok:!1,reason:"not_found"}}}function Jo(e){let t=window.__shoppingmateNavigate__;if(typeof t=="function")try{return t(e),!0}catch{return!1}return!1}async function Xe(e){try{let t=new URL(e,window.location.href);if(t.origin!==window.location.origin)return{ok:!1,reason:"cross_origin"};let n=Xo(t.pathname);n&&(await J(n,520),await ce());let o=t.pathname+t.search+t.hash;return Jo(o)||window.location.assign(o),j(800),{ok:!0}}catch{return{ok:!1,reason:"route_not_found"}}}function Xo(e){let t=document.querySelectorAll("a[href]");for(let n of t)try{if(new URL(n.href,window.location.href).pathname===e)return n}catch{}return null}async function Qo(e){let t=G(e);return t?(await J(t,480),t.scrollIntoView({behavior:"smooth",block:"center"}),j(800),{ok:!0}):{ok:!1,reason:"not_found"}}function Zo(e,t){let n=G(e);return n?(jt(n,t),{ok:!0}):{ok:!1,reason:"not_found"}}async function er(e){let t=G(e);if(!t)return{ok:!1,reason:"not_found"};if(!t.isConnected)return{ok:!1,reason:"stale_target"};if(await J(t,420),await ce(),!t.isConnected)return{ok:!1,reason:"stale_target"};let n=Jt(t);if(n)return t.click(),j(800),{ok:!0,verified:!0,observed:`navigating to ${n}`};let o=await Je(t,()=>t.click());return j(800),Yt(o.verified),{ok:!0,verified:o.verified,observed:o.observed}}async function Qe(e){let t=e.getBoundingClientRect(),n=window.innerHeight;(t.bottom<80||t.top>n-80)&&(e.scrollIntoView({behavior:"smooth",block:"center"}),await new Promise(r=>setTimeout(r,350)))}async function tr(e){let t=G(e);return t?t.isConnected?(await Qe(t),await J(t,480),{ok:!0}):{ok:!1,reason:"stale_target"}:{ok:!1,reason:"not_found"}}async function nr(e){let t=G(e);return t?t.isConnected?(await Qe(t),await J(t,420),await ce(),await new Promise(n=>setTimeout(n,120)),t.isConnected?(t.click(),j(800),{ok:!0}):{ok:!1,reason:"stale_target"}):{ok:!1,reason:"stale_target"}:{ok:!1,reason:"not_found"}}var Le="sm_visitor_id";function or(){let e=new Uint8Array(8);return(globalThis.crypto??window.crypto).getRandomValues(e),`v_${Array.from(e,n=>n.toString(16).padStart(2,"0")).join("")}`}function rr(){try{let t=localStorage.getItem(Le);if(t){let n=JSON.parse(t);if(n?.id&&typeof n.expiresAt=="number")return n}}catch{}let e=document.cookie.match(new RegExp(`(?:^|; )${Le}=([^;]+)`));return e?{id:decodeURIComponent(e[1]??""),expiresAt:Date.now()+1}:null}function Xt(e){try{localStorage.setItem(Le,JSON.stringify(e));let t=Math.floor(6048e5/1e3);document.cookie=`${Le}=${e.id}; max-age=${t}; path=/; SameSite=Lax; Secure`}catch{}}function de(){let e=Date.now(),t=rr();if(t&&t.expiresAt>e)return Xt({id:t.id,expiresAt:e+6048e5}),t.id;let n=or();return Xt({id:n,expiresAt:e+6048e5}),n}var pe=[200,500],Qt=e=>new Promise(t=>setTimeout(t,e));async function Ze(e,t){let n;for(let o=0;o<=pe.length;o++)try{let r=await fetch(e,t);if(r.status>=500&&o<pe.length){await Qt(pe[o]??0);continue}return r}catch(r){if(n=r,o<pe.length){await Qt(pe[o]??0);continue}throw r}throw n}async function Zt(e){try{let t=de(),n=await Ze(`${e.apiBase}/v1/install`,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({merchantId:e.merchantId,domain:e.domain,userAgent:navigator.userAgent,referrer:document.referrer||null})});if(!n.ok)return{kind:"err",reason:`install_${n.status}`};let o=await n.json();Gt(o.platform??null),xt({visitorId:t,platform:o.platform??"custom"});let r=await Ze(`${e.apiBase}/v1/session`,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({merchantId:e.merchantId,domain:e.domain})});if(!r.ok)return{kind:"err",reason:`session_${r.status}`};let i=await r.json(),s=null;try{let a=await Ze(`${e.apiBase}/v1/voice/token`,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({sessionId:i.sessionId,merchantId:e.merchantId,visitorId:t})});a.ok?s=await a.json():console.warn("[shoppingmate] voice unavailable \u2014 status",a.status)}catch(a){console.warn("[shoppingmate] voice unavailable \u2014",a)}return{kind:"ok",sessionId:i.sessionId,wsUrl:i.wsUrl,merchantStatus:o.status,personaId:o.personaId??s?.personaId??null,widgetPosition:o.widgetPosition??null,widgetSize:o.widgetSize??null,widgetAccent:o.widgetAccent??null,widgetLabel:o.widgetLabel??null,widgetGreeting:o.widgetGreeting??null,voice:s,visitorId:t,insights:o.insights??null}}catch(t){return{kind:"err",reason:t instanceof Error?t.message:"network"}}}var en=16e3,ir=24e3,Ie=640,ar=6e4,sr=`class SmCap extends AudioWorkletProcessor {
  constructor(){super();this.r=sampleRate/${en};this.acc=0;this.n=0;this.pos=0;}
  process(inputs){const ch=inputs[0]&&inputs[0][0];if(!ch)return true;const out=[];
    for(let i=0;i<ch.length;i++){this.acc+=ch[i];this.n++;this.pos+=1;
      if(this.pos>=this.r){out.push(this.acc/this.n);this.acc=0;this.n=0;this.pos-=this.r;}}
    if(out.length)this.port.postMessage(new Float32Array(out));return true;}}
registerProcessor('sm-cap',SmCap);`;function tn(e){let t="idle",n=!1,o=!1,r=null,i=null,s=null,a=null,l=null,u=null,p=null,m=null,v=[],C=0,S=new Set,H=[],b=[],E=0,k=null,M=d=>{k&&!(d in k)&&(k[d]=Math.round(performance.now()-E))},f=()=>{k&&(T($({type:"voice_timing",sessionId:e.sessionId,timings:{...k,transport_ws:1}})),k=null)},c=d=>{if(t!==d){t=d;for(let h of H)h(d)}},g=(d,h)=>{for(let x of b)x({code:d,message:h})},T=d=>{r?.readyState===WebSocket.OPEN&&r.send(d)},w=()=>{s&&clearTimeout(s),s=null},A=()=>{w(),!o&&(s=setTimeout(()=>{o||R()},ar))},R=()=>{w();let d=r;r=null,i=null;try{d?.close(1e3)}catch{}},D=()=>{if(a)return a;let d=window.AudioContext??window.webkitAudioContext;a=new d,l=a.createGain();try{let h=a.createMediaStreamDestination();l.connect(h),u=new Audio,u.autoplay=!0,u.srcObject=h.stream}catch{l.connect(a.destination)}return a},P=()=>{for(let d of S)try{d.stop()}catch{}S.clear(),C=0,t==="speaking"&&c(n?"muted":"listening")},fe=d=>{if(!a||!l)return;let h=new Int16Array(d);if(h.length===0)return;let x=new Float32Array(h.length);for(let z=0;z<h.length;z++)x[z]=h[z]/32768;let L=a.createBuffer(1,x.length,ir);L.copyToChannel(x,0);let I=a.createBufferSource();I.buffer=L,I.connect(l);let Q=Math.max(a.currentTime+.04,C);I.start(Q),C=Q+L.duration,S.add(I),n||c("speaking"),k&&!("first_audio"in k)&&(M("first_audio"),f()),I.onended=()=>{S.delete(I),S.size===0&&t==="speaking"&&c("listening")}},V=()=>r&&r.readyState===WebSocket.OPEN?(A(),Promise.resolve(r)):i||(i=new Promise((d,h)=>{let x=new WebSocket(e.url);x.binaryType="arraybuffer",x.onopen=()=>{r=x,A(),d(x)},x.onerror=()=>h(new Error("voice websocket connect failed")),x.onmessage=L=>{if(L.data instanceof ArrayBuffer){fe(L.data);return}let I=String(L.data);if(I.includes('"audio_clear"')){P();return}e.onAgentEvent(new TextEncoder().encode(I))},x.onclose=()=>{r===x&&(r=null),i=null,o&&(o=!1,ne(),P(),c("idle"),g("connect_failed","voice connection closed"))}}),i.catch(()=>{i=null}),i),B=d=>{if(!(n||!r||r.readyState!==WebSocket.OPEN)){for(let h=0;h<d.length;h++)v.push(d[h]);for(;v.length>=Ie;){let h=v.splice(0,Ie),x=new Int16Array(Ie);for(let L=0;L<Ie;L++){let I=Math.max(-1,Math.min(1,h[L]));x[L]=I<0?I*32768:I*32767}r.send(x.buffer)}}},X=async d=>{p=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:!0,noiseSuppression:!0,autoGainControl:!0,channelCount:1}});let h=d.createMediaStreamSource(p);try{let x=URL.createObjectURL(new Blob([sr],{type:"application/javascript"}));await d.audioWorklet.addModule(x),URL.revokeObjectURL(x);let L=new AudioWorkletNode(d,"sm-cap");L.port.onmessage=I=>B(I.data),h.connect(L),m=L}catch{let x=d.createScriptProcessor(2048,1,1),L=d.sampleRate/en,I=0,Q=0,z=0;x.onaudioprocess=Fn=>{let ct=Fn.inputBuffer.getChannelData(0),lt=[];for(let $e=0;$e<ct.length;$e++)I+=ct[$e],Q++,z+=1,z>=L&&(lt.push(I/Q),I=0,Q=0,z-=L);B(new Float32Array(lt))},h.connect(x);let Pe=d.createGain();Pe.gain.value=0,x.connect(Pe),Pe.connect(d.destination),m=x}},ne=()=>{try{m?.disconnect()}catch{}m=null;for(let d of p?.getTracks()??[])d.stop();p=null,v=[]},ge=d=>{let h=d instanceof Error?d.message:String(d),x=d instanceof Error?d.name:"";return/permissions? policy|feature policy/i.test(h)?"mic_policy_blocked":x==="NotAllowedError"||/denied|permission/i.test(h)?"mic_denied":x==="NotFoundError"||/no.*microphone|not.*found/i.test(h)?"mic_unavailable":/connect|network|websocket|timeout/i.test(h)?"connect_failed":"unknown"};return{warm:()=>{V().catch(d=>console.warn("[voiceModeWs] warm failed",d))},start:()=>{if(t!=="idle")return;c("connecting"),w(),E=performance.now(),k={was_warm:r?.readyState===WebSocket.OPEN?1:0};let d=D();d.resume(),u?.play().catch(()=>{}),(async()=>{try{await V(),M("room_connected"),await X(d),M("mic_on"),o=!0,T($({type:"start_voice",sessionId:e.sessionId})),n&&c("muted")}catch(h){ne(),c("idle"),g(ge(h),h instanceof Error?h.message:String(h))}})()},stop:()=>{k&&(M("hung_up"),f()),o=!1,ne(),P(),R(),c("idle")},speak:async()=>{},setMuted:d=>{n=d,l&&(l.gain.value=d?0:1),d?c("muted"):t==="muted"&&c(S.size?"speaking":"listening")},getState:()=>t,onStateChange:d=>{H.push(d)},onError:d=>{b.push(d)},signalAgentReady:()=>{M("agent_ready"),t==="connecting"&&c(n?"muted":S.size?"speaking":"listening")},publishData:async d=>{T(new TextDecoder().decode(d))}}}function nn(e){let t=0,n=s=>{let a=Date.now();a-t<200||(t=a,e.send(s))},o=s=>{let a=s.target;if(!a)return;let l=cr(a),u=l?lr(l,e.hints):null;n({type:"visitor_action",sessionId:e.sessionId,action:"click",intentKey:u,url:window.location.href,elementLabel:l,timestamp:Date.now()})},r=()=>{n({type:"visitor_action",sessionId:e.sessionId,action:"route_change",intentKey:null,url:window.location.href,elementLabel:null,timestamp:Date.now()})},i=s=>{let a=s.target;if(!a)return;let l=a.tagName?.toLowerCase();l!=="input"&&l!=="textarea"&&l!=="select"||a.type==="password"||n({type:"visitor_action",sessionId:e.sessionId,action:"form_focus",intentKey:null,url:window.location.href,elementLabel:a.name||a.id||null,timestamp:Date.now()})};return document.addEventListener("click",o,{passive:!0,capture:!0}),window.addEventListener("popstate",r),document.addEventListener("focusin",i,{passive:!0}),()=>{document.removeEventListener("click",o,!0),window.removeEventListener("popstate",r),document.removeEventListener("focusin",i)}}function cr(e){return e.getAttribute("aria-label")??e.getAttribute("title")??(e.textContent??"").trim().slice(0,80)??null}function lr(e,t){let n=e.toLowerCase();if(t.has(n))return n;for(let o of t.keys())if(n.includes(o)||o.includes(n))return o;return null}function an(e){return e.replace(/[-_]+/g," ").trim().replace(/\b\w/g,t=>t.toUpperCase())}function on(e){let t=String(e??"").trim();return!t||/^\d+$/.test(t)?null:an(t)}function rn(e){let t=(e||"/").split(/[?#]/)[0]??"/";if(t==="/"||t==="")return"the home page";if(/^\/checkout/.test(t))return"checkout";if(/^\/cart\/?$/.test(t))return"your cart";let n=t.replace(/\/+$/,"").split("/").pop()??"";return n?`the ${an(n)} page`:"that page"}function sn(e,t){switch(e.type){case"cart_add":{let n=on(e.sku),o=n?`${e.qty>1?`${e.qty} \xD7 `:""}${n}`:"that";return t.ok?{text:`Added ${o} to your cart`,ok:!0}:{text:`Couldn't add ${n??"that"} to your cart`,ok:!1}}case"cart_set_qty":{let n=on(e.sku)??"that item";return t.ok?e.qty<=0?{text:`Removed ${n} from your cart`,ok:!0}:{text:`Set ${n} to ${e.qty}`,ok:!0}:{text:`Couldn't update ${n}`,ok:!1}}case"cart_clear":return t.ok?{text:"Emptied your cart",ok:!0}:{text:"Couldn't empty your cart",ok:!1};case"apply_coupon":return t.ok?{text:`Applied code ${e.code.toUpperCase()}`,ok:!0}:{text:`Code ${e.code.toUpperCase()} didn't apply`,ok:!1};case"navigate":return t.ok?{text:`Opened ${rn(e.path)}`,ok:!0}:{text:`Couldn't open ${rn(e.path)}`,ok:!1};case"form_fill":case"checkout_fill":return t.ok?(t.filled??[]).filter(r=>!r.ok).length>0?{text:"Filled in some of your details \u2014 please check the page",ok:!1}:{text:"Filled in your details \u2014 please check them on the page",ok:!0}:{text:"Couldn't fill in your details \u2014 please type them on the page",ok:!1};case"checkout_place":return t.ok?{text:"Sent your order to the payment page",ok:!0}:{text:"Couldn't place the order",ok:!1};case"click":return t.ok?t.verified===!1?{text:"That tap didn't change anything \u2014 trying another way",ok:!1}:null:{text:"Couldn't find that on the page",ok:!1};default:return null}}var et=10,cn='[data-cart-count],#cart-icon-bubble,.cart-count,.cart-count-bubble,[class*="cart-count"],[class*="CartCount"]';function ur(e=window){try{if(navigator.globalPrivacyControl)return!1;let t=e.Shopify?.customerPrivacy?.analyticsProcessingAllowed;if(typeof t=="function")return!!t();if(typeof e.OnetrustActiveGroups=="string")return e.OnetrustActiveGroups.includes("C0002");if(e.Cookiebot?.hasResponse)return!!e.Cookiebot.consent?.statistics}catch{}return null}function dr(e,t){return e!==null?e:!/^Europe\//.test(t)}function pr(e){return e<768?"mobile":e<1024?"tablet":"desktop"}function ln(e,t,n){let o=new URLSearchParams(e).get("utm_source");if(o)return o.toLowerCase().slice(0,40);if(!t)return"direct";try{let r=new URL(t).hostname.replace(/^www\./,"");return r===n.replace(/^www\./,"")?"internal":/google\./.test(r)?"google":/facebook|fb\.|instagram/.test(r)?"meta":r.slice(0,40)}catch{return"direct"}}function mr(e,t){if(/\/(thank|order-confirm|order-success|checkouts\/.*\/thank_you)/i.test(e))return"purchase";if(/\/checkout/i.test(e))return"checkout";if(/^\/cart\/?$/i.test(e))return"cart";for(let n of t)try{if(new RegExp(n.urlPattern).test(e))return n.pageType}catch{}return e==="/"||e===""?"home":"other"}function tt(){return Math.max(document.documentElement.scrollHeight,document.body?.scrollHeight??0,window.innerHeight,1)}function un(){try{let t=window.__shoppingmateGetCart__;if(typeof t=="function"){let n=t()?.count;if(typeof n=="number")return n}}catch{}let e=Number((document.querySelector(cn)?.textContent??"").replace(/\D/g,""));return Number.isFinite(e)&&document.querySelector(cn)!==null?e:null}function fr(e){let t=e?.closest?.('a,button,input,select,textarea,summary,[role="button"],[role="link"],[role="tab"]');if(!t)return null;let n=t.tagName==="A"?"link":t.tagName==="BUTTON"?"button":t.getAttribute("role")??t.tagName.toLowerCase();return oe(n,Z(t)||t.getAttribute("name")||"")}var He="sm_ins_visit",gr=30*60*1e3;function hr(e=Date.now(),t=()=>Math.random().toString(36).slice(2)){let n=null;try{n=JSON.parse(sessionStorage.getItem(He)??"null")}catch{n=null}if(!n||e-n.last>gr){let o=!1;try{o=!localStorage.getItem("sm_seen"),localStorage.setItem("sm_seen","1")}catch{}n={id:`v_${t()}${e.toString(36)}`,last:e,isNew:o,bot:!1,qa:!1}}n.last=e;try{sessionStorage.setItem(He,JSON.stringify(n))}catch{}return n}function nt(e){try{let t=JSON.parse(sessionStorage.getItem(He)??"null");t&&sessionStorage.setItem(He,JSON.stringify({...t,...e}))}catch{}}var ot=!1;function dn(){ot=!0,nt({bot:!0})}function yr(e,t){if(e>=1)return!0;if(e<=0)return!1;let n=0;for(let o of t)n=n*31+o.charCodeAt(0)>>>0;return n%1e3/1e3<e}function pn(e){if(!e.config?.enabled)return null;let t=hr();if(!yr(e.config.sampleRate,t.id))return null;let n=(()=>{try{return Intl.DateTimeFormat().resolvedOptions().timeZone??""}catch{return""}})();if(!dr(ur(),n))return null;let o=[];Te().then(c=>{o=c});let r=t.qa||/ShoppingmateBot|HeadlessChrome/.test(navigator.userAgent)||new URLSearchParams(location.search).has("sm_qa");r&&!t.qa&&nt({qa:!0});let i=t.isNew;t.bot&&(ot=!0);let s=(()=>{try{let c=sessionStorage.getItem("sm_src")??ln(location.search,document.referrer,location.hostname);return sessionStorage.setItem("sm_src",c),c}catch{return ln(location.search,document.referrer,location.hostname)}})(),a=l();function l(){return{path:location.pathname,start:Date.now(),maxScroll:0,attention:new Array(et).fill(0),cells:{},elements:{},rage:0,dead:0,errorClicks:0,deadTargets:[],rageTargets:[],focused:new Set,submitted:!1,lcp:null,cls:0,inp:null,jsErrors:0,cartStart:un(),recent:[],lastClickAt:0,sent:!1}}let u=()=>{let c=Math.min(100,Math.round((window.scrollY+window.innerHeight)/tt()*100));c>a.maxScroll&&(a.maxScroll=c)},p=window.setInterval(()=>{if(document.visibilityState!=="visible")return;let c=Math.min(et-1,Math.floor((window.scrollY+window.innerHeight/2)/tt()*et));a.attention[c]=(a.attention[c]??0)+1},1e3),m=c=>{if(N(c.target))return;let g=Date.now(),T=Math.min(9,Math.floor((c.clientX+window.scrollX)/Math.max(document.documentElement.scrollWidth,1)*10)),w=Math.min(9,Math.floor((c.clientY+window.scrollY)/tt()*10)),A=`${T},${w}`;a.cells[A]=(a.cells[A]??0)+1;let R=fr(c.target);R&&(a.elements[R]=(a.elements[R]??0)+1),a.recent=a.recent.filter(d=>g-d.t<700&&Math.abs(d.x-c.clientX)<30&&Math.abs(d.y-c.clientY)<30),a.recent.push({t:g,x:c.clientX,y:c.clientY}),a.recent.length===3&&(a.rage+=1,R&&a.rageTargets.length<5&&a.rageTargets.push(R)),a.lastClickAt=g;let D=location.href,P=c.target instanceof Element?c.target:null,V=P?.closest('a,button,label,summary,[role="button"],[role="tab"],[role="option"]')??P?.parentElement??P,B=document.activeElement,X=!1,ne=d=>d instanceof HTMLElement&&(d.matches('dialog,[role="dialog"],[aria-modal="true"],[role="alert"],[role="status"]')||/fixed|sticky/.test(getComputedStyle(d).position)),ge=new MutationObserver(d=>{for(let h of d)if(!N(h.target)){if(V?.contains(h.target)){X=!0;return}if(h.type==="attributes"&&V&&h.target.contains?.(V)&&/^(aria-|open$|hidden$)/.test(h.attributeName??"")){X=!0;return}if(h.type==="childList"&&[...h.addedNodes].some(ne)){X=!0;return}}});ge.observe(document.body,{subtree:!0,childList:!0,attributes:!0,characterData:!0}),window.setTimeout(()=>{ge.disconnect();let d=document.activeElement!==B&&document.activeElement!==document.body;if(!X&&!d&&location.href===D&&a.path===location.pathname){a.dead+=1;let h=R??(()=>{let x=(P?.textContent??P?.getAttribute("alt")??"").replace(/\s+/g," ").trim().toLowerCase();return x?`text|${x.slice(0,30)}`:null})();h&&a.deadTargets.length<5&&!a.deadTargets.includes(h)&&a.deadTargets.push(h)}},800)},v=c=>{/shoppingmate|widget\/v1/.test(`${c.filename??""}`)||(a.jsErrors+=1,Date.now()-a.lastClickAt<1e3&&(a.errorClicks+=1))},C=c=>{let g=c.target;if(!g||N(g)||!/^(INPUT|TEXTAREA|SELECT)$/.test(g.tagName))return;let T=(g.getAttribute("type")??"").toLowerCase();if(T==="hidden"||T==="password")return;let w=(g.getAttribute("name")||g.id||g.getAttribute("placeholder")||g.tagName).slice(0,40);a.focused.add(w)},S=()=>{a.submitted=!0},H=[];try{let c=new PerformanceObserver(w=>{let A=w.getEntries().at(-1);A&&(a.lcp=Math.round(A.startTime))});c.observe({type:"largest-contentful-paint",buffered:!0});let g=new PerformanceObserver(w=>{for(let A of w.getEntries())A.hadRecentInput||(a.cls+=A.value??0)});g.observe({type:"layout-shift",buffered:!0});let T=new PerformanceObserver(w=>{for(let A of w.getEntries())a.inp=Math.max(a.inp??0,Math.round(A.duration))});T.observe({type:"event",buffered:!0,durationThreshold:40}),H=[c,g,T]}catch{}let b=()=>{if(a.sent)return;a.sent=!0,nt({last:Date.now()});let c=Object.fromEntries(Object.entries(a.elements).sort((R,D)=>D[1]-R[1]).slice(0,20)),g=un(),T={v:1,merchantId:e.merchantId,sessionId:t.id,visitorId:e.visitorId,path:a.path,pageType:mr(a.path,o),device:pr(window.innerWidth),source:s,newVisitor:i,dwellMs:Date.now()-a.start,maxScroll:a.maxScroll,attention:a.attention,cells:a.cells,elements:c,rage:a.rage,dead:a.dead,errorClicks:a.errorClicks,deadTargets:a.deadTargets,rageTargets:a.rageTargets,abandonedFields:a.submitted?[]:[...a.focused].slice(0,10),lcp:a.lcp,cls:Math.round(a.cls*1e3)/1e3,inp:a.inp,jsErrors:a.jsErrors,botEngaged:ot,cartIncreased:a.cartStart!==null&&g!==null&&g>a.cartStart,qa:r},w=JSON.stringify(T),A=`${e.apiBase}/v1/insights/pageview`;try{navigator.sendBeacon?.(A,new Blob([w],{type:"text/plain"}))||fetch(A,{method:"POST",body:w,keepalive:!0,headers:{"content-type":"text/plain"}}).catch(()=>{})}catch{}},E=()=>{location.pathname!==a.path&&(b(),a=l(),u())},k=history.pushState,M=history.replaceState;history.pushState=function(...c){let g=k.apply(this,c);return window.setTimeout(E,0),g},history.replaceState=function(...c){let g=M.apply(this,c);return window.setTimeout(E,0),g};let f=()=>b();return window.addEventListener("scroll",u,{passive:!0}),window.addEventListener("popstate",E),window.addEventListener("pagehide",f),document.addEventListener("visibilitychange",()=>{document.visibilityState==="hidden"&&b()}),document.addEventListener("click",m,!0),document.addEventListener("focusin",C,!0),document.addEventListener("submit",S,!0),window.addEventListener("error",v),u(),()=>{b(),window.clearInterval(p);for(let c of H)c.disconnect();history.pushState=k,history.replaceState=M,window.removeEventListener("scroll",u),window.removeEventListener("popstate",E),window.removeEventListener("pagehide",f),document.removeEventListener("click",m,!0),document.removeEventListener("focusin",C,!0),document.removeEventListener("submit",S,!0),window.removeEventListener("error",v)}}var mn={"calm-clinician":"Sage","calmosis-clinician":"Calmio",stylist:"Lumi",coach:"Kai",concierge:"Olivia",curator:"Theo",guide:"Maya",expert:"Arjun",host:"Ana"},br={"calmosis-clinician":"calm-clinician"};function vr(){let e="https://shoppingmate-web.vercel.app/widget/personas";return e&&typeof e=="string"?e.replace(/\/$/,""):"https://cdn.shoppingmate.ai/v1/personas"}var fn={id:"pending",name:"Assistant",initial:"A",avatarUrl:""};function gn(){return fn}function hn(e){if(!e||!mn[e])return fn;let t=mn[e],n=br[e]??e;return{id:e,name:t,initial:t.charAt(0).toUpperCase(),avatarUrl:`${vr()}/${n}.png`}}var yn=0,O=()=>(yn+=1,`t${yn}`);function wr(e,t){switch(t.type){case"set_mode":return{...e,mode:t.mode};case"set_voice_state":return t.state!=="idle"?{...e,voiceState:t.state,voiceError:null,invited:!1}:{...e,voiceState:t.state};case"set_connection":return{...e,connection:t.status,thinking:t.status==="connected"?e.thinking:!1};case"set_voice_error":return{...e,voiceError:t.error};case"set_invited":return{...e,invited:t.invited};case"receipt":{let n=e.transcript[e.transcript.length-1];return n&&n.kind==="receipt"&&n.text===t.text&&n.ok===t.ok?e:{...e,transcript:[...e.transcript,{id:O(),role:"system",kind:"receipt",text:t.text,ok:t.ok,ts:Date.now()}]}}case"reset":return{...e,transcript:[],thinking:!1,closed:!1,closedReason:null,checkoutUrl:null,capWarning:null};case"user_input":return{...e,transcript:[...e.transcript,{id:O(),role:"user",kind:"text",text:t.text,ts:Date.now()}]};case"agent_event":{let n=t.event;switch(n.type){case"thinking":return{...e,thinking:!0};case"end_of_turn":return{...e,thinking:!1};case"say":{let o=e.transcript[e.transcript.length-1];return o&&o.role==="agent"&&o.kind==="text"&&o.partial?{...e,thinking:!1,transcript:[...e.transcript.slice(0,-1),{...o,text:n.text,partial:!1,ts:Date.now()}]}:{...e,thinking:!1,transcript:[...e.transcript,{id:O(),role:"agent",kind:"text",text:n.text,ts:Date.now()}]}}case"say_partial":{let o=e.transcript[e.transcript.length-1];return o&&o.role==="agent"&&o.kind==="text"&&o.partial?{...e,thinking:!1,transcript:[...e.transcript.slice(0,-1),{...o,text:n.text,ts:Date.now()}]}:{...e,thinking:!1,transcript:[...e.transcript,{id:O(),role:"agent",kind:"text",text:n.text,ts:Date.now(),partial:!0}]}}case"user_text":return{...e,transcript:[...e.transcript,{id:O(),role:"user",kind:"text",text:n.text,ts:Date.now()}]};case"cards":return{...e,transcript:[...e.transcript,{id:O(),role:"agent",kind:"cards",items:n.items,ts:Date.now()}]};case"tool_result":return n.toolName==="case.open"&&n.ok?{...e,transcript:[...e.transcript,{id:O(),role:"system",kind:"receipt",text:"Your request is with the team \u2014 they\u2019ll contact you",ok:!0,ts:Date.now()}]}:e;case"checkout_redirect":return{...e,checkoutUrl:n.url};case"cap_warning":return{...e,capWarning:{reason:n.reason,remaining:n.remaining},transcript:[...e.transcript,{id:O(),role:"system",kind:"cap_warning",remaining:n.remaining,ts:Date.now()}]};case"session_closed":return{...e,closed:!0,closedReason:n.reason,transcript:[...e.transcript,{id:O(),role:"system",kind:"closed",reason:n.reason,ts:Date.now()}]};default:return e}}default:return e}}function rt(e){let t={sessionId:e.sessionId,mode:"pill",voiceState:"idle",transcript:[],thinking:!1,closed:!1,closedReason:null,checkoutUrl:null,capWarning:null,connection:"connecting",voiceError:null,invited:!1},n=[];return{get:()=>t,dispatch:o=>{t=wr(t,o);for(let r of n)r(t)},subscribe:o=>(n.push(o),()=>{let r=n.indexOf(o);r>=0&&n.splice(r,1)})}}var bn=`
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
`;var vn=[1e3,2e3,4e3,8e3,16e3],xr=5;function wn(e,t){let n=null,o=0,r=!1,i=[];function s(){r||(t.onStatus(o>0?"reconnecting":"connecting"),n=new WebSocket(e),n.onopen=()=>{t.onStatus("connected"),o>0&&n?.send(JSON.stringify({type:"session_resume",sessionId:t.sessionId})),o=0;for(let a of i)n?.send(a);i=[]},n.onmessage=a=>t.onEvent(typeof a.data=="string"?a.data:""),n.onerror=()=>{},n.onclose=()=>{if(r)return;if(o+=1,o>=xr){t.onStatus("disconnected");return}let a=Math.min(o-1,vn.length-1),l=vn[a]??3e4;t.onStatus("reconnecting"),setTimeout(s,l)})}return s(),{send:a=>{n&&n.readyState===1?n.send(a):i.push(a)},close:()=>{r=!0,n?.close()}}}var y={captionResting:"AI ASSISTANT",captionIncoming:"INCOMING CALL",captionThinking:"THINKING",captionConnected:"CONNECTED",captionRetry:"TAP TO RETRY",captionOffline:"OFFLINE",talkToPrefix:"Talk to",callCta:"Call",acceptCta:"Accept",callAria:"Start voice call",acceptAria:"Accept call",micMute:"Mute mic",micUnmute:"Unmute mic",retryAria:"Retry call",endCallAria:"End call",closeAria:"Close",openAria:"Open shoppingmate",chatAria:"Chat instead",callFailedTitle:"Could not start the call. Please try again.",callHelpHeading:"How can I help you?",callBullets:["Find the right product","Compare options out loud","Check out on this page"],panelHelpHeading:"Hi, I'm",panelHelpSubtitle:"I'm here to help you:",panelBullets:["Find the right product fast","Compare options out loud","Check out without leaving the page"],panelPrompts:["Help me find the right product","Can you compare your products for me?","I'd like to check out"],poweredBy:"Powered by shoppingmate",chatPlaceholder:"Type a quick question\u2026",reconnecting:"Reconnecting\u2026",disconnected:"Connection lost \u2014 reload to retry",closed:{user:"Conversation ended",cap:"Time to wrap up \u2014 reload for a new chat",error:"Something went wrong"},payNow:"Pay now \u2192",capWarning:"A couple minutes left",thinking:"thinking\u2026",micDenied:"Mic blocked \u2014 switching to text"};var F=e=>`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${e}</svg>`,it=F('<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>'),xn=F('<path d="M18 6 6 18"/><path d="m6 6 12 12"/>'),kn=F('<path d="M5 12h14"/>'),_n=F('<path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>'),Sn=F('<path d="M10.68 13.31a16 16 0 0 0 3.41 2.6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7 2 2 0 0 1 1.72 2v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.42 19.42 0 0 1-3.33-2.67"/><path d="M5 5a2 2 0 0 1 2-2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L10.9 11.1"/><line x1="22" y1="2" x2="2" y2="22"/>'),Cn=F('<path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="22"/>'),Tn=F('<line x1="2" y1="2" x2="22" y2="22"/><path d="M18.89 13.23A7.12 7.12 0 0 0 19 12v-2"/><path d="M5 10v2a7 7 0 0 0 12 5"/><path d="M15 9.34V5a3 3 0 0 0-5.68-1.33"/><path d="M9 9v3a3 3 0 0 0 5.12 2.12"/><line x1="12" y1="19" x2="12" y2="22"/>'),En=F('<path d="M22 2 11 13"/><path d="M22 2l-7 20-4-9-9-4 20-7z"/>');function me(e){return e.replace(/[&<>"']/g,t=>t==="&"?"&amp;":t==="<"?"&lt;":t===">"?"&gt;":t==='"'?"&quot;":"&#39;")}function kr(e){return me(e.trim()).replace(/\*\*([^*\n]+)\*\*/g,"<strong>$1</strong>").replace(/__([^_\n]+)__/g,"<strong>$1</strong>").replace(/(^|\s)\*([^*\n]+)\*(?=\s|$|[.,!?])/g,"$1$2").replace(/^#{1,6}\s+/gm,"").replace(/^\s*[-•]\s+/gm,"\u2022 ").replace(/\n{2,}/g,`
`).replace(/\n/g,"<br>")}function Mn(e,t,n){t==="user"?e.textContent=n:e.innerHTML=kr(n)}function _r(e,t){let n=document.createElement("button");return n.className="card",n.type="button",n.dataset.sku=e.sku,n.innerHTML=`
    ${e.image?`<img src="${me(e.image)}" alt="${me(e.title)}" />`:'<div class="card-img-fallback"></div>'}
    <div class="title">${me(e.title)}</div>
    <div class="price">${me(e.priceFormatted)}</div>
  `,n.addEventListener("click",()=>t({sku:e.sku,variantId:e.variantId})),n}function Sr(e,t){if(e.kind==="text"){let o=document.createElement("div");return o.className=`bubble ${e.role}`,Mn(o,e.role,e.text),o}if(e.kind==="cards"){let o=document.createElement("div");o.className="cards-row";for(let r of e.items)o.appendChild(_r(r,t));return o}if(e.kind==="receipt"){let o=document.createElement("div");o.className=`receipt ${e.ok?"ok":"warn"}`,o.setAttribute("role","status");let r=document.createElement("span");r.className="receipt-icon",r.setAttribute("aria-hidden","true"),r.textContent=e.ok?"\u2713":"!";let i=document.createElement("span");return i.textContent=e.text,o.append(r,i),o}if(e.kind==="cap_warning"){let o=document.createElement("div");return o.className="bubble system",o.textContent=y.capWarning,o}let n=document.createElement("div");return n.className="bubble system",n.textContent=y.closed[e.reason],n}var An=new WeakMap;function Re(e,t,n){let o=An.get(e)??[],r=new Map(o.map(l=>[l.id,l])),i=new Set(t.map(l=>l.id));for(let l of o)i.has(l.id)||l.el.remove();let s=[],a=!1;for(let l=0;l<t.length;l++){let u=t[l];if(!u)continue;let p=r.get(u.id);if(p)u.kind==="text"&&p.text!==u.text&&(Mn(p.el,u.role,u.text),p.text=u.text,a=!0),s.push(p);else{let m=Sr(u,n);e.appendChild(m),s.push({id:u.id,el:m,text:u.kind==="text"?u.text:void 0}),a=!0}}An.set(e,s),a&&(e.scrollTop=e.scrollHeight)}function Cr(e){switch(e){case"mic_policy_blocked":return"Voice is disabled on this page \u2014 text chat still works.";case"mic_denied":return"Microphone blocked. Allow mic access in your browser, then tap Call.";case"mic_unavailable":return"No microphone found \u2014 check your audio device, then tap Call.";case"connect_failed":return"Couldn't reach voice. Tap Call to retry.";default:return"Tap Call to try again."}}function Ln(e){return e.muted?"you're muted":e.voiceState==="connecting"?`connecting to ${e.personaName}\u2026`:e.voiceState==="speaking"?`${e.personaName} is speaking\u2026`:e.voiceState==="listening"?`${e.personaName} is listening\u2026`:`${e.personaName} is ready`}function In(e){return e.voiceState==="idle"&&e.voiceError?"error":e.transcript.length===0?"prompt":"transcript"}function Tr(e){return`${In(e)}|${e.checkoutUrl??""}|${e.personaName}|${e.voiceError?.code??""}`}function Hn(e,t){let n=Tr(t),o=In(t);if(e.dataset.chromeKey!==n){let s=o==="error"?`
          <div class="call-error">
            <p class="call-error-title">${y.callFailedTitle}</p>
            <p class="call-error-hint">${Cr(t.voiceError?.code??"unknown")}</p>
          </div>`:"",a=o==="prompt"?`
          <div class="call-prompt">
            <h2 class="call-prompt-heading">${y.callHelpHeading}</h2>
            <ul class="call-prompt-bullets">
              ${y.callBullets.map(u=>`<li>${u}</li>`).join("")}
            </ul>
          </div>`:"",l=o!=="transcript";e.innerHTML=`
      <div class="panel call-panel">
        <button class="panel-close" data-action="close" aria-label="${y.closeAria}">${kn}</button>
        ${s}
        ${a}
        <div class="status-line ${o==="error"?"hidden":""}" data-region="status">${Ln(t)}</div>
        <div class="transcript ${l?"hidden":""}" data-region="transcript" aria-live="polite"></div>
        ${t.checkoutUrl?`<a class="checkout-cta" data-action="checkout" href="${t.checkoutUrl}" target="_blank" rel="noopener">${y.payNow}</a>`:""}
        <div class="panel-footer">${y.poweredBy}</div>
      </div>
    `,e.querySelector('[data-action="close"]')?.addEventListener("click",t.onClose),e.querySelector('[data-action="checkout"]')?.addEventListener("click",t.onCheckout),e.dataset.chromeKey=n}let r=e.querySelector('[data-region="status"]');if(r instanceof HTMLElement){let s=Ln(t);r.textContent!==s&&(r.textContent=s)}let i=e.querySelector('[data-region="transcript"]');i instanceof HTMLElement&&o==="transcript"&&Re(i,t.transcript,t.onCardTap)}function Er(e){return`${e.transcript.length===0?"1":"0"}|${e.checkoutUrl??""}|${e.closed?"1":"0"}|${e.personaName}|${e.personaInitial}|${e.personaAvatarUrl}`}function Rn(e,t){let n=Er(t);if(e.dataset.chromeKey!==n){let r=t.transcript.length===0,i=y.panelBullets.map((u,p)=>`<button type="button" class="welcome-bullet" data-prompt="${p}" ${t.closed?"disabled":""}>${u}<span class="welcome-bullet-arrow" aria-hidden="true">\u2192</span></button>`).join(""),s=r?`
        <div class="welcome">
          <div class="welcome-avatar">
            <img src="${t.personaAvatarUrl}" alt="" onerror="this.style.display='none'; this.nextElementSibling.style.display='grid';" />
            <span class="welcome-avatar-fallback" aria-hidden="true">${t.personaInitial}</span>
          </div>
          <h2 class="welcome-heading">${y.panelHelpHeading} ${t.personaName}.</h2>
          <p class="welcome-sub">${y.panelHelpSubtitle}</p>
          <div class="welcome-bullets">${i}</div>
        </div>
      `:"";e.innerHTML=`
      <div class="panel">
        <button class="panel-close" data-action="close" aria-label="${y.closeAria}">${xn}</button>
        ${s}
        <div class="transcript ${r?"transcript-empty":""}" data-region="transcript" aria-live="polite"></div>
        ${t.checkoutUrl?`<a class="checkout-cta" href="${t.checkoutUrl}" target="_blank" rel="noopener">${y.payNow}</a>`:""}
        <form class="input-row">
          <input type="text" placeholder="${y.chatPlaceholder}" ${t.closed?"disabled":""} />
          <button class="send" type="submit" aria-label="Send" ${t.closed?"disabled":""}>${En}</button>
        </form>
        <div class="panel-footer">${y.poweredBy}</div>
      </div>
    `,e.querySelector('[data-action="close"]')?.addEventListener("click",t.onClose),e.querySelectorAll(".welcome-bullet").forEach(u=>{u.addEventListener("click",()=>{if(t.closed)return;let p=Number(u.dataset.prompt),m=y.panelPrompts[p]??y.panelBullets[p];m&&t.onSend(m)})});let a=e.querySelector("form"),l=e.querySelector("input");a instanceof HTMLFormElement&&l instanceof HTMLInputElement&&a.addEventListener("submit",u=>{u.preventDefault();let p=l.value.trim();p&&(l.value="",t.onSend(p))}),e.dataset.chromeKey=n}let o=e.querySelector('[data-region="transcript"]');o instanceof HTMLElement&&Re(o,t.transcript,t.onCardTap)}function Ar(e,t,n,o,r,i,s=8){let a=Math.max(s,r-n-s),l=Math.max(s,i-o-s);return{x:Math.min(Math.max(s,e),a),y:Math.min(Math.max(s,t),l)}}function Mr(e,t,n,o=8){let r=(e.left+e.right)/2,i=(e.top+e.bottom)/2,s=r>t/2?"right":"left",a=i>n/2?"bottom":"top",l=Math.max(o,s==="right"?t-e.right:e.left),u=Math.max(o,a==="bottom"?n-e.bottom:e.top);return{hSide:s,hVal:l,vSide:a,vVal:u}}function at(e,t){e.classList.add("dragged"),e.style.transform="none",t.hSide==="right"?(e.style.right=`${t.hVal}px`,e.style.left="auto"):(e.style.left=`${t.hVal}px`,e.style.right="auto"),t.vSide==="bottom"?(e.style.bottom=`${t.vVal}px`,e.style.top="auto"):(e.style.top=`${t.vVal}px`,e.style.bottom="auto"),e.classList.toggle("dock-top",t.vSide==="top"),e.classList.toggle("dock-bottom",t.vSide==="bottom"),e.classList.toggle("dock-left",t.hSide==="left"),e.classList.toggle("dock-right",t.hSide==="right")}function Pn(e){try{let t=window.localStorage.getItem(e);if(!t)return null;let n=JSON.parse(t);if((n.hSide==="left"||n.hSide==="right")&&(n.vSide==="top"||n.vSide==="bottom")&&typeof n.hVal=="number"&&typeof n.vVal=="number")return n}catch{}return null}function Lr(e,t){try{window.localStorage.setItem(e,JSON.stringify(t))}catch{}}function $n(e,t){let n=t.offsetWidth||0,o=t.offsetHeight||0,r=window.innerWidth,i=window.innerHeight;return{...e,hVal:Math.min(Math.max(8,e.hVal),Math.max(8,r-n-8)),vVal:Math.min(Math.max(8,e.vVal),Math.max(8,i-o-8))}}function Nn(e){let{root:t,surface:n,storageKey:o}=e,r=()=>n.querySelector(".tray")??n,i=Pn(o);i&&at(t,$n(i,r()));let s=0,a=0,l=0,u=0,p=!1,m=null,v=b=>{if(m!==null&&b.pointerId!==m)return;let E=b.clientX-s,k=b.clientY-a;if(!p&&Math.hypot(E,k)<6)return;if(!p)try{m!=null&&n.setPointerCapture(m)}catch{}p=!0,t.classList.add("dragging","dragged"),t.style.transform="none";let M=t.offsetWidth,f=t.offsetHeight,{x:c,y:g}=Ar(l+E,u+k,M,f,window.innerWidth,window.innerHeight);t.style.left=`${c}px`,t.style.top=`${g}px`,t.style.right="auto",t.style.bottom="auto",t.classList.remove("dock-top","dock-bottom","dock-left","dock-right"),b.preventDefault()},C=b=>{if(window.removeEventListener("pointermove",v),window.removeEventListener("pointerup",C),m=null,!p)return;p=!1,t.classList.remove("dragging");let E=f=>{f.stopPropagation(),f.preventDefault()};n.addEventListener("click",E,{capture:!0,once:!0}),window.setTimeout(()=>n.removeEventListener("click",E,{capture:!0}),350);let k=r().getBoundingClientRect(),M=Mr({top:k.top,left:k.left,right:k.right,bottom:k.bottom},window.innerWidth,window.innerHeight);at(t,M),Lr(o,M),b.preventDefault()},S=b=>{if(b.button!=null&&b.button!==0)return;let E=r().getBoundingClientRect();s=b.clientX,a=b.clientY,l=E.left,u=E.top,p=!1,m=b.pointerId??null,window.addEventListener("pointermove",v),window.addEventListener("pointerup",C)},H=()=>{let b=Pn(o);b&&at(t,$n(b,r()))};return n.addEventListener("pointerdown",S),window.addEventListener("resize",H),()=>{n.removeEventListener("pointerdown",S),window.removeEventListener("pointermove",v),window.removeEventListener("pointerup",C),window.removeEventListener("resize",H)}}function Ir(e){return e.voiceState==="connecting"?"connecting":e.voiceState!=="idle"?"connected":e.voiceError?"error":e.invited?"incoming":"resting"}function Hr(e,t){return[t,e.mode,e.callable?"1":"0",e.voiceState,e.connection,e.invited?"1":"0",e.personaName,e.personaInitial,e.personaAvatarUrl,e.launcherLabel??"",e.launcherCaption??""].join("|")}function Rr(e,t){let n=e.voiceState==="muted",o=e.voiceState==="speaking",r=e.connection==="disconnected",i=(C,S)=>`
    <button class="tray-call" data-action="call" aria-label="${S}">
      ${_n}<span class="tray-call-label">${C}</span>
    </button>`,s=`
    <button class="tray-btn ghost" data-action="chat" aria-label="${y.openAria}">${it}</button>`,a=`
    <button class="tray-btn tray-chat" data-action="chat" aria-label="${y.chatAria}" title="${y.chatAria}">${it}</button>`,l=C=>`
    <button class="tray-btn ${n?"muted":""}" data-action="mic" ${C?"disabled":""}
      aria-pressed="${n}" aria-label="${n?y.micUnmute:y.micMute}">${n?Tn:Cn}</button>`,u=`
    <button class="tray-btn end" data-action="end" aria-label="${y.endCallAria}">${Sn}</button>`,p='<span class="tray-spinner" aria-hidden="true"></span>',m=`
    <div class="tray-waveform active ${o?"speaking":""}" aria-hidden="true">
      ${Array.from({length:14}).map(()=>'<span class="bar"></span>').join("")}
    </div>`,v=r?"offline":"online";switch(t){case"incoming":return{caption:y.captionIncoming,captionClass:"incoming",presenceClass:v,nameText:e.personaName,controls:`${i(y.acceptCta,y.acceptAria)}${a}`};case"connecting":return{caption:y.captionThinking,captionClass:"thinking",presenceClass:"online",nameText:e.personaName,controls:`${p}${l(!0)}${u}`};case"connected":return{caption:y.captionConnected,captionClass:"connected",presenceClass:"online",nameText:e.personaName,controls:`${m}${l(!1)}${u}`};case"error":return{caption:y.captionRetry,captionClass:"retry",presenceClass:"offline",nameText:e.personaName,controls:`${i(y.callCta,y.retryAria)}${u}`};default:{let C=e.launcherLabel?.trim(),S=e.launcherCaption?.trim();return{caption:r?y.captionOffline:S||y.captionResting,captionClass:r?"retry":"resting",presenceClass:v,nameText:C||`${y.talkToPrefix} ${e.personaName}`,controls:e.callable?`${i(y.callCta,y.callAria)}${a}`:s}}}}function On(e,t){let n=Ir(t),o=Hr(t,n);if(e.dataset.trayKey===o)return;let r=Rr(t,n),i=t.mode==="chat"||t.mode==="call"||t.mode==="expanded";e.innerHTML=`
    <div class="tray phase-${n}" role="region" aria-label="shoppingmate">
      <button class="tray-avatar" data-action="toggle" aria-expanded="${i}" aria-label="${y.openAria}">
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
  `,e.querySelector('[data-action="toggle"]')?.addEventListener("click",()=>{i?t.onClose():t.onChat()}),e.querySelector('[data-action="call"]')?.addEventListener("click",t.onCall),e.querySelector('[data-action="chat"]')?.addEventListener("click",t.onChat),e.querySelector('[data-action="mic"]')?.addEventListener("click",()=>{t.onMute(t.voiceState!=="muted")}),e.querySelector('[data-action="end"]')?.addEventListener("click",t.onEnd),e.dataset.trayKey=o}var Dn="shoppingmate-widget",Vn="SM-XPK2EN",zn="SM-2SCCLZ",Un=new Set(["bottom-right","bottom-left","bottom-center","center","center-left","center-right","top-right","top-left"]),jn=new Set(["small","medium","large"]),Pr=6e3,$r=12e3,Nr=["cart-sidebar-show","cart-open","cart--open","cart-drawer-open","cart-drawer--active","cart-drawer-is-open","js-drawer-open","drawer-open","drawer--open","js-drawer-open-right","cart-active","is-cart-open","cart-is-open","cart-visible","show-cart","cart-show","mini-cart-active","minicart-active","mini-cart--active","ajaxcart-open","header-cart-open"],Or=["menu-open","menu--open","menu-is-open","is-menu-open","menu-drawer-open","menu-drawer--active","mobile-menu-open","mobile-menu--open","mobile-nav-open","nav-open","nav--open","nav-is-open","is-nav-open","js-nav-open","js-menu-open","navigation-open","header-menu-open","offcanvas-open","off-canvas-open","offcanvas-nav-open","offcanvas-menu-open"];function Dr(e,t){if(t==="/cart"||t.startsWith("/cart/")||t.startsWith("/cart?"))return!0;let n=e.toLowerCase();return Nr.some(o=>n.includes(o))||Or.some(o=>n.includes(o))}function Vr(){try{let e=window.location.pathname||"",t=`${document.documentElement.className} ${document.body?document.body.className:""}`;return Dr(t,e)}catch{return!1}}function zr(){return"live-kit"==="web-speech"?"web-speech":"live-kit"}var st=class extends HTMLElement{constructor(){super(...arguments);_(this,"rootEl",null);_(this,"pillHost",null);_(this,"panelHost",null);_(this,"store",rt({sessionId:"pending"}));_(this,"socket",null);_(this,"voiceMode",te(null,we()));_(this,"voice",null);_(this,"persona",gn());_(this,"launcherLabel",null);_(this,"launcherCaption",null);_(this,"apiBase","");_(this,"merchantId","");_(this,"domain",window.location.host);_(this,"stopActivityTracker",null);_(this,"inviteTimer",null);_(this,"inviteDismissTimer",null);_(this,"collapseTimer",null);_(this,"stopCollapse",null);_(this,"cartObserver",null);_(this,"scrollResizeRaf",!1);_(this,"overlayRecheck",null);_(this,"stopDrag",null);_(this,"ambience",De(!1));_(this,"onHostGesture",()=>{this.onCartVisibilityChange(),window.setTimeout(this.onCartVisibilityChange,200),window.setTimeout(this.onCartVisibilityChange,550)});_(this,"onScrollResize",()=>{this.scrollResizeRaf||(this.scrollResizeRaf=!0,requestAnimationFrame(()=>{this.scrollResizeRaf=!1,this.onCartVisibilityChange()}))});_(this,"onCartVisibilityChange",()=>{if(!this.rootEl)return;let n=this.store.get(),o=n.mode==="call"||n.voiceState!=="idle",r=n.mode==="chat"||n.mode==="expanded",i=(Vr()||!r&&this.launcherCovered())&&!o;this.rootEl.classList.toggle("host-overlay-hidden",i)})}connectedCallback(){if(this.shadowRoot)return;let n=this.getAttribute("data-id"),o=this.getAttribute("data-api")??this.apiBase;if(!n){console.warn("[shoppingmate] data-id missing on widget element");return}this.merchantId=n,this.apiBase=o,this.ambience=De(this.getAttribute("data-ambience")!=="off");let r=this.attachShadow({mode:"open"}),i=document.createElement("style");i.textContent=bn,r.appendChild(i);let s=document.createElement("div"),a=this.merchantId===zn?"center-left":"bottom-right",l=(this.getAttribute("data-position")??a).toLowerCase(),u=Un.has(l)?`pos-${l}`:"pos-bottom-right",p=(this.getAttribute("data-size")??"medium").toLowerCase(),m=jn.has(p)&&p!=="medium"?` size-${p}`:"";s.className=`root ${u}${m}`,r.appendChild(s),this.rootEl=s,this.panelHost=document.createElement("div"),this.pillHost=document.createElement("div"),s.appendChild(this.panelHost),s.appendChild(this.pillHost),this.store.subscribe(()=>this.render()),this.render(),this.stopDrag=Nn({root:s,surface:this.pillHost,storageKey:`sm-widget-pos:${this.merchantId}`}),this.stopCollapse=this.setupAutoCollapse(s,this.pillHost),this.setupCartVisibility(s),this.start()}applyServerPosition(n){let o=this.rootEl;if(!o||o.classList.contains("dragged"))return;let r=n.toLowerCase();if(Un.has(r)){for(let i of Array.from(o.classList))i.startsWith("pos-")&&o.classList.remove(i);o.classList.add(`pos-${r}`)}}applyAccent(n){let o=this.rootEl;if(!o)return;let r=n.trim();!/^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(r)&&!/^rgba?\([\d.,\s%]+\)$/i.test(r)||o.style.setProperty("--sm-accent",r)}applyServerSize(n){let o=this.rootEl;if(!o)return;let r=n.toLowerCase();jn.has(r)&&(o.classList.remove("size-small","size-large"),r!=="medium"&&o.classList.add(`size-${r}`))}disconnectedCallback(){this.socket?.close(),this.voiceMode.stop(),this.ambience.stop(),this.stopActivityTracker?.(),this.inviteTimer&&clearTimeout(this.inviteTimer),this.inviteDismissTimer&&clearTimeout(this.inviteDismissTimer),this.collapseTimer&&clearTimeout(this.collapseTimer),this.stopCollapse?.(),this.cartObserver?.disconnect(),window.removeEventListener("popstate",this.onCartVisibilityChange),document.removeEventListener("click",this.onHostGesture,!0),document.removeEventListener("keyup",this.onHostGesture,!0),window.removeEventListener("scroll",this.onScrollResize),window.removeEventListener("resize",this.onScrollResize),this.overlayRecheck&&window.clearInterval(this.overlayRecheck),this.stopDrag?.()}setupCartVisibility(n){this.onCartVisibilityChange(),this.cartObserver=new MutationObserver(this.onCartVisibilityChange),this.cartObserver.observe(document.documentElement,{attributes:!0,attributeFilter:["class"]}),document.body&&this.cartObserver.observe(document.body,{attributes:!0,attributeFilter:["class"]}),window.addEventListener("popstate",this.onCartVisibilityChange),document.addEventListener("click",this.onHostGesture,!0),document.addEventListener("keyup",this.onHostGesture,!0),window.addEventListener("scroll",this.onScrollResize,{passive:!0}),window.addEventListener("resize",this.onScrollResize),this.overlayRecheck=window.setInterval(()=>{this.rootEl?.classList.contains("host-overlay-hidden")&&this.onCartVisibilityChange()},1500)}launcherCovered(){let n=this.rootEl;if(!n||typeof document.elementsFromPoint!="function")return!1;let o=n.getBoundingClientRect();if(!o.width||!o.height)return!1;let r=o.left+o.width/2,i=o.top+o.height/2;for(let s of document.elementsFromPoint(r,i)){if(s===this||this.contains(s)||s.contains(this)||s.tagName==="SHOPPINGMATE-WIDGET")continue;let a=s;for(;a&&a!==document.body&&a!==document.documentElement;){let l=getComputedStyle(a);if(l.position==="fixed"&&l.pointerEvents!=="none"){let u=a.getBoundingClientRect(),p=u.left<=r&&u.right>=r&&u.top<=i&&u.bottom>=i,m=u.width>=window.innerWidth*.4||u.height>=window.innerHeight*.4,v=l.visibility!=="hidden"&&l.display!=="none"&&Number(l.opacity)>.01;if(p&&m&&v)return!0}a=a.parentElement}}return!1}setupAutoCollapse(n,o){let r=()=>{this.collapseTimer&&clearTimeout(this.collapseTimer),this.collapseTimer=setTimeout(()=>n.classList.add("collapsed"),Pr)},i=()=>{n.classList.remove("collapsed"),r()};return o.addEventListener("pointerenter",i),o.addEventListener("pointerdown",i),o.addEventListener("focusin",i),o.addEventListener("pointerleave",r),r(),()=>{o.removeEventListener("pointerenter",i),o.removeEventListener("pointerdown",i),o.removeEventListener("focusin",i),o.removeEventListener("pointerleave",r)}}async start(){let n=await Zt({apiBase:this.apiBase,merchantId:this.merchantId,domain:this.domain});if(n.kind==="err"){console.warn("[shoppingmate] bootstrap failed:",n.reason);return}this.store=rt({sessionId:n.sessionId}),this.store.subscribe(()=>this.render()),Wt({apiBase:this.apiBase,merchantId:this.merchantId,sessionId:n.sessionId}),n.insights?.enabled&&pn({apiBase:this.apiBase,merchantId:this.merchantId,sessionId:n.sessionId,visitorId:n.visitorId,config:n.insights}),this.voice=n.voice,this.persona=hn(n.personaId??n.voice?.personaId??null),n.widgetPosition&&this.applyServerPosition(n.widgetPosition),n.widgetSize&&this.applyServerSize(n.widgetSize),n.widgetAccent&&this.applyAccent(n.widgetAccent),this.launcherLabel=n.widgetLabel?.trim()||null,this.launcherCaption=n.widgetGreeting?.trim()||null,this.render();let o=zr(),r=ie();if(o==="live-kit"&&this.voice?.transport==="ws"&&this.voice.voiceWsUrl)this.voiceMode=tn({sessionId:n.sessionId,url:this.voice.voiceWsUrl,onAgentEvent:i=>this.handleLiveKitData(i)}),this.armVoiceWarm();else if(o==="live-kit"&&this.voice){bt();let i=ke({stack:"live-kit",livekit:{sessionId:n.sessionId,wsUrl:this.voice.wsUrl,token:this.voice.token,roomName:this.voice.roomName,onTranscriptEvent:s=>this.handleLiveKitData(s)}});i&&(this.voiceMode=i,this.armVoiceWarm())}else{let i=ke({stack:"web-speech"});i&&(this.voiceMode=i),r?.onFinal(s=>{this.store.dispatch({type:"user_input",text:s,mode:"voice"}),this.socket?.send($({type:"user_text",sessionId:n.sessionId,text:s,mode:"voice",visitorId:de()}))})}this.voiceMode.onStateChange(i=>this.store.dispatch({type:"set_voice_state",state:i})),this.voiceMode.onError?.(i=>{console.warn("[shoppingmate] voice error",i),this.store.dispatch({type:"set_voice_error",error:i})}),this.socket=wn(n.wsUrl,{sessionId:n.sessionId,onEvent:i=>{let s=Ve(i);s&&this.handleAgentEvent(s)},onStatus:i=>this.store.dispatch({type:"set_connection",status:i})}),(this.merchantId===Vn||this.merchantId===zn)&&(this.inviteTimer=setTimeout(()=>{this.store.get().voiceState==="idle"&&this.store.get().mode==="pill"&&(this.store.dispatch({type:"set_invited",invited:!0}),this.inviteDismissTimer=setTimeout(()=>{let i=this.store.get();i.invited&&i.voiceState==="idle"&&i.mode==="pill"&&this.store.dispatch({type:"set_invited",invited:!1})},$r))},5e3)),this.stopActivityTracker=nn({sessionId:n.sessionId,hints:new Map,send:i=>this.publishWidgetMessage(i)})}armVoiceWarm(){let n=this.pillHost;if(!n)return;let o=()=>this.voiceMode.warm?.();for(let i of["pointerenter","touchstart","focusin"])n.addEventListener(i,o,{passive:!0});let r=!1;this.store.subscribe(()=>{let i=this.store.get(),s=i.invited||i.mode==="chat"||i.mode==="expanded";s&&!r&&o(),r=s})}async handleAgentEvent(n,o="ws"){if(n.type==="host_action_request"){let r=await Kt(n.action),i=sn(n.action,r);i&&this.store.dispatch({type:"receipt",text:i.text,ok:i.ok}),this.publishWidgetMessage({type:"host_action_result",callId:n.callId,result:r},o);return}if(n.type!=="persona_swap"&&n.type!=="agent_warmed"){if(n.type==="agent_ready"){this.voiceMode.signalAgentReady?.();return}this.store.dispatch({type:"agent_event",event:n}),n.type==="say"&&this.voiceMode.speak(n.text)}}publishWidgetMessage(n,o="ws"){let r=$(n);if(o==="livekit"&&this.voiceMode.publishData){let i=new TextEncoder().encode(r);this.voiceMode.publishData(i);return}this.socket?.send(r)}render(){if(!this.pillHost||!this.panelHost)return;let n=this.store.get();this.onCartVisibilityChange();let o=ie()!==null;n.mode==="call"?Hn(this.panelHost,{voiceState:n.voiceState,muted:n.voiceState==="muted",transcript:n.transcript,checkoutUrl:n.checkoutUrl,personaName:this.persona.name,voiceError:n.voiceError,onClose:()=>this.store.dispatch({type:"set_mode",mode:"pill"}),onCardTap:r=>this.cardTap(r),onCheckout:()=>{}}):n.mode==="chat"||n.mode==="expanded"?Rn(this.panelHost,{transcript:n.transcript,checkoutUrl:n.checkoutUrl,personaName:this.persona.name,personaInitial:this.persona.initial,personaAvatarUrl:this.persona.avatarUrl,onSend:r=>this.userText(r,"text"),onCall:()=>this.openCall(),onClose:()=>this.store.dispatch({type:"set_mode",mode:"pill"}),onCardTap:r=>this.cardTap(r),closed:n.closed}):this.panelHost.innerHTML="",On(this.pillHost,{mode:n.mode,callable:o,voiceState:n.voiceState,connection:n.connection,voiceError:n.voiceError,invited:n.invited,personaName:this.persona.name,personaInitial:this.persona.initial,personaAvatarUrl:this.persona.avatarUrl,launcherLabel:this.launcherLabel,launcherCaption:this.launcherCaption,onCall:()=>this.openCall(),onMute:r=>this.voiceMode.setMuted(r),onEnd:()=>{this.voiceMode.stop(),this.ambience.stop(),this.store.dispatch({type:"set_mode",mode:"pill"})},onChat:()=>{n.invited&&this.store.dispatch({type:"set_invited",invited:!1}),this.store.dispatch({type:"set_mode",mode:"chat"})},onClose:()=>this.store.dispatch({type:"set_mode",mode:"pill"})})}openCall(){this.store.get().invited&&(this.merchantId===Vn&&this.publishWidgetMessage({type:"tour_request"}),this.store.dispatch({type:"set_invited",invited:!1})),this.inviteTimer&&(clearTimeout(this.inviteTimer),this.inviteTimer=null),this.store.dispatch({type:"set_mode",mode:"call"}),this.voiceMode.start(),this.ambience.start()}userText(n,o){dn(),this.store.dispatch({type:"user_input",text:n,mode:o});let r=this.store.get().sessionId;this.socket?.send($({type:"user_text",sessionId:r,text:n,mode:o,visitorId:de()}))}handleLiveKitData(n){let o;try{o=new TextDecoder().decode(n)}catch{return}let r=Ve(o);r&&this.handleAgentEvent(r,"livekit")}cardTap(n){let o=this.store.get().sessionId;this.socket?.send($({type:"card_tap",sessionId:o,action:"cartAdd",sku:n.sku,variantId:n.variantId,qty:1}))}};function Wn(){customElements.get(Dn)||customElements.define(Dn,st)}window.__shoppingmateNav__={snapshot:()=>ee().text,keys:()=>he(ee().text)};function Ur(){let e=document.currentScript instanceof HTMLScriptElement?document.currentScript:null,t=e?.dataset.id;if(!t){console.warn("[shoppingmate] data-id missing on script tag");return}let o=(e?.dataset.api??"https://api-production-1ea1.up.railway.app").trim(),r=document.querySelector("shoppingmate-widget");r&&(r.getAttribute("data-api")||r.setAttribute("data-api",o),r.getAttribute("data-id")||r.setAttribute("data-id",t)),Wn();let i=()=>{let s=document.querySelector("shoppingmate-widget");if(s){s.getAttribute("data-api")||s.setAttribute("data-api",o),s.getAttribute("data-id")||s.setAttribute("data-id",t);return}let a=document.createElement("shoppingmate-widget");a.setAttribute("data-id",t),a.setAttribute("data-api",o),document.body.appendChild(a)};document.readyState==="loading"?document.addEventListener("DOMContentLoaded",i,{once:!0}):i()}Ur();})();
