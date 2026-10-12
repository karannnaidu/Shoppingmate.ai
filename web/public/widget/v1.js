"use strict";(()=>{var $n=Object.defineProperty;var Pn=(t,e,n)=>e in t?$n(t,e,{enumerable:!0,configurable:!0,writable:!0,value:n}):t[e]=n;var v=(t,e,n)=>Pn(t,typeof e!="symbol"?e+"":e,n);function Y(t,e){let n=e.toLowerCase().replace(/[₹$£€]|rs\.?|inr|usd/g," ").replace(/\d+([.,]\d+)?/g," ").replace(/[^a-z\s]/g," ").replace(/\s+/g," ").trim().slice(0,40);return n.length<2||t==="text"?null:`${t}|${n}`}function ct(t){let e=new Set;for(let n of t.split(`
`)){let o=/^\[e\d+\] ([a-z]+) "([^"]*)"/.exec(n);if(!o)continue;let r=Y(o[1],o[2]);r&&e.add(r)}return[...e]}function Nn(t,e){if(t.length===0)return 0;let n=0;for(let o of t)e.has(o)&&(n+=1);return n/t.length}function On(t,e){try{return new RegExp(t).test(e)}catch{return!1}}function te(t,e,n){let o=new Set(t),r=null,i=null;for(let s of n){if(s.skeleton.length<4)continue;let a=Nn(s.skeleton,o),l=On(s.urlPattern,e),u=a+(l?.05:0);a>=.7&&(!r||u>r.c)&&(r={t:s,c:u}),l&&a<.7&&(!i||a<i.coverage)&&(i={template:s,coverage:a})}return r?{template:r.t,coverage:Math.min(1,r.c),drift:null}:{template:null,coverage:0,drift:i}}var Dn=new Set(["the","a","an","to","of","on","in","and","or","section","button","link","card","tile","now"]),Vn=[{keyword:"button",matchTag:/^(button)$/i,matchRole:"button"},{keyword:"link",matchTag:/^(a)$/i,matchRole:"link"},{keyword:"card",matchTag:/^(article|div|section)$/i},{keyword:"section",matchTag:/^(section|main|article)$/i}],zn=.4;function z(t,e){if(e){let i=e.get(t.toLowerCase().trim());if(i)try{let s=document.querySelector(i);if(s instanceof HTMLElement&&V(s))return s}catch{}}let n=J(t);if(n.size===0)return null;let o=jn(document.body),r=null;for(let i of o){if(!i.visible)continue;let s=Un(i,t,n);s<zn||(!r||s>r.score)&&(r={c:i,score:s})}return r?.c.element??null}function J(t){return new Set(t.toLowerCase().replace(/[^a-z0-9 ]/g," ").split(/\s+/).filter(e=>e.length>0&&!Dn.has(e)))}function jn(t){let e=[],n=document.createTreeWalker(t,NodeFilter.SHOW_ELEMENT),o=n.nextNode();for(;o;){if(o instanceof HTMLElement){let r=B(o);r&&e.push({element:o,role:o.getAttribute("role")??o.tagName.toLowerCase(),name:r,visible:V(o)})}o=n.nextNode()}return e}function B(t){let e=t.getAttribute("aria-labelledby");if(e){let i=e.split(/\s+/).map(s=>document.getElementById(s)?.textContent?.trim()??"").filter(Boolean);if(i.length>0)return i.join(" ")}let n=t.getAttribute("aria-label");if(n)return n.trim();if(t.id){let i=document.querySelector(`label[for="${ne(t.id)}"]`);if(i?.textContent)return i.textContent.trim()}let o=t.getAttribute("alt")??t.getAttribute("title");if(o)return o.trim();let r=(t.textContent??"").trim();return r&&r.length<200?r:""}function V(t){if(!t.isConnected)return!1;let e=t.ownerDocument.defaultView?.getComputedStyle(t);return e?!(e.display==="none"||e.visibility==="hidden"||e.opacity==="0"):!0}function Un(t,e,n){let o=J(t.name);if(o.size===0)return 0;let r=0;for(let p of n)o.has(p)&&r++;let i=new Set([...n,...o]).size,s=i===0?0:r/i,a=0,l=e.toLowerCase();for(let p of Vn)if(l.includes(p.keyword)&&(p.matchTag.test(t.element.tagName)||t.role===p.matchRole)){a=.15;break}let u=t.element.getAttribute("data-tour-stop"),d=0;if(u){let p=J(u.replace(/-/g," ")),y=0;for(let w of n)p.has(w)&&y++;y>0&&(d=.5*(y/n.size))}return Math.min(1,s+a+d)}function ne(t){return t.replace(/(["\\])/g,"\\$1")}function Ct(t,e){if(e){let i=e.get(t.toLowerCase().trim());if(i)try{let s=document.querySelector(i);if(s instanceof HTMLElement&&V(s))return s}catch{}}let n=J(t);if(n.size===0)return null;let o=Array.from(document.querySelectorAll("input, textarea, select")).filter(i=>V(i)&&!qn(i)),r=null;for(let i of o){let s=Wn(i,n);s<=0||(!r||s>r.score)&&(r={el:i,score:s})}return r?.el??null}function qn(t){let e=(t.getAttribute("type")??"").toLowerCase();return e==="hidden"||e==="submit"||e==="button"||t.disabled}function Fn(t){let e=[],n=t.id;if(n){e.push(n);let l=document.querySelector(`label[for="${ne(n)}"]`);l?.textContent&&e.push(l.textContent)}let o=t.getAttribute("name");o&&e.push(o);let r=t.getAttribute("data-field")??t.getAttribute("data-testid");r&&e.push(r);let i=t.getAttribute("aria-label");i&&e.push(i);let s=t.getAttribute("placeholder");s&&e.push(s);let a=t.closest("label");return a?.textContent&&e.push(a.textContent),e}var Bn=[["phone","mobile","cell","contact","phonenumber","tel","whatsapp"],["pincode","pin","postal","postcode","zip","zipcode"],["name","fullname"],["email","mail","emailaddress"],["address","street","addr","address1"],["city","town"],["state","province","region"],["landmark","apartment","flat","floor"]],oe=new Map;for(let t of Bn)for(let e of t)oe.set(e,t[0]);function ee(t){return oe.get(t)??t}function Wn(t,e){let n=new Set([...e].map(ee)),o=0;for(let r of Fn(t)){let i=new Set([...J(r)].map(ee));if(i.size===0)continue;let s=0;for(let l of n)i.has(l)&&s++;if(s===0)continue;let a=s/n.size;a>o&&(o=a)}return o}var ut="data-sm-ref",Kn=6e3,lt=["a[href]","button","input","select","textarea","summary",'[role="button"]','[role="link"]','[role="tab"]','[role="radio"]','[role="checkbox"]','[role="switch"]','[role="option"]','[role="menuitem"]','[role="combobox"]'].join(","),re='h1,h2,h3,[role="heading"],[role="alert"],[role="status"]',Gn='dialog[open],[role="dialog"],[role="alertdialog"],[aria-modal="true"]',Yn=/(₹|\$|£|€|Rs\.?\s?|INR\s?|USD\s?|AED\s?)\s?\d[\d,]*(\.\d+)?|\d[\d,]*(\.\d+)?\s?(₹|\$|£|€)/,Tt=new Map;function H(t){let e=t;for(;e;){if(e instanceof Element){if(e.tagName==="SHOPPINGMATE-WIDGET")return!0;for(let n of Array.from(e.attributes))if(n.name.startsWith("data-shoppingmate"))return!0}e=e.parentNode}return!1}function Jn(t){return t.closest('[aria-hidden="true"],[inert]')!==null}function Xn(){return(document.body?.getBoundingClientRect().width??0)>0}function Qn(t,e){if(!e)return!0;let n=t.getBoundingClientRect();return n.width>0||n.height>0}function Zn(t){let e=t.getAttribute("role");if(e)return e;let n=t.tagName.toLowerCase();if(n==="a")return"link";if(/^h[1-6]$/.test(n))return"heading";if(n==="select")return"select";if(n==="textarea")return"textbox";if(n==="input"){let o=(t.getAttribute("type")??"text").toLowerCase();return o==="radio"||o==="checkbox"?o:o==="submit"||o==="button"||o==="reset"?"button":o==="number"?"spinbutton":"textbox"}return n}function to(t){let e=B(t);if(e)return e;if(t instanceof HTMLInputElement||t instanceof HTMLTextAreaElement||t instanceof HTMLSelectElement){let n=t.closest("label")?.textContent?.trim();if(n)return n}return t instanceof HTMLInputElement||t instanceof HTMLTextAreaElement?t.placeholder||t.name||"":t instanceof HTMLSelectElement&&t.name||""}function j(t,e=80){let n=t.replace(/\s+/g," ").trim();return n.length>e?`${n.slice(0,e-1)}\u2026`:n}function eo(t,e){let n=[];t instanceof HTMLInputElement&&(e==="radio"||e==="checkbox")?t.checked&&n.push("checked"):t.getAttribute("aria-checked")==="true"&&n.push("checked"),t.getAttribute("aria-selected")==="true"&&n.push("selected"),t.getAttribute("aria-pressed")==="true"&&n.push("pressed");let o=t.getAttribute("aria-expanded");if(o==="true"&&n.push("expanded"),o==="false"&&n.push("collapsed"),(t.disabled||t.getAttribute("aria-disabled")==="true")&&n.push("disabled"),t instanceof HTMLInputElement&&e!=="radio"&&e!=="checkbox"&&((t.getAttribute("type")??"text").toLowerCase()==="password"?t.value&&n.push("filled"):t.value&&n.push(`value="${j(t.value,40)}"`)),t instanceof HTMLTextAreaElement&&t.value&&n.push(`value="${j(t.value,40)}"`),t instanceof HTMLSelectElement){let r=t.selectedOptions[0];r&&n.push(`value="${j(r.textContent??"",40)}"`)}return n}function no(t){let e=t.getBoundingClientRect();if(e.width===0&&e.height===0&&e.top===0)return!0;let n=window.innerHeight||800;return e.bottom>-n&&e.top<n*2}function oo(t){return t.closest('footer,[role="contentinfo"]')!==null}function ro(){return Array.from(document.querySelectorAll(Gn)).filter(e=>V(e)&&!H(e))}function io(t){if(t.children.length>0)return!1;let e=(t.textContent??"").trim();return!e||e.length>40?!1:Yn.test(e)}function W(t={}){let e=t.maxChars??Kn,n=[];for(let m of Array.from(document.querySelectorAll(`[${ut}]`)))m.removeAttribute(ut);Tt=new Map;let o=ro(),r=[],i=new Set,s=0,a=Xn(),l=(m,c,f)=>{if(i.has(m)||H(m)||!V(m)||Jn(m)||!Qn(m,a)||m instanceof HTMLInputElement&&m.type==="hidden")return;i.add(m);let k=c==="price"?"text":Zn(m),b=c==="price"?j(m.textContent??"",40):j(to(m)),_=c==="price"?[]:eo(m,k);if(!b&&_.length===0&&c!=="interactive"||!b&&c==="interactive"&&(k==="link"||k==="button"))return;let A=!f&&oo(m),F=!f&&m.closest('nav,header,[role="navigation"],[role="banner"]')!==null;if(t.collapse&&k==="link"&&(A||F)){let at=Y(k,b);if(at&&t.collapse.has(at)){n.length<12&&b.length<=24&&!/\d{3}|@/.test(b)&&!n.includes(b)&&n.push(b);return}}let I=f?0:c==="interactive"?2:c==="context"?1:2;!f&&!no(m)&&(I+=3),A&&(I+=4),F&&(I+=2);let Xt=_.length>0?` (${_.join(", ")})`:"",G=`${k} "${b}"${Xt}`;r.push({el:m,line:G,priority:I,order:s++})};for(let m of o){let c=j(B(m)||"dialog",60);r.push({el:m,line:`dialog "${c}" (open)`,priority:0,order:s++}),i.add(m);for(let f of Array.from(m.querySelectorAll(`${lt},${re}`)))l(f,f.matches(lt)?"interactive":"context",!0)}let u=document.querySelector('main,[role="main"]')??document.body,d=u===document.body?[document.body]:[u,document.body];for(let m of d)for(let c of Array.from(m.querySelectorAll(`${lt},${re}`)))l(c,c.matches(lt)?"interactive":"context",!1);let p=0;for(let m of Array.from(u.querySelectorAll("span,div,p,strong,b,s,del,ins,bdi"))){if(p>=15)break;if(!io(m))continue;let c=r.length;l(m,"price",!1),r.length>c&&(p+=1)}let y=[`[page] ${j(document.title||"",70)} \xB7 ${location.pathname}`,...t.preface??[]];n.length>0&&y.push(`[site links] ${n.join(", ")} (standard site navigation \u2014 use site.navigate)`);let w=[...r].sort((m,c)=>m.priority-c.priority||m.order-c.order),S=[],E=y.join(`
`).length+1;for(let m of w){let c=m.line.length+8;E+c>e||(S.push(m),E+=c)}S.sort((m,c)=>m.order-c.order);let h=[...y],x=0;for(let m of S){x+=1;let c=`e${x}`;m.el.setAttribute(ut,c),Tt.set(c,m.el),h.push(`[${c}] ${m.line}`)}let C=r.length-S.length;C>0&&h.push(`\u2026 ${C} more elements not shown (lower on the page or in the footer)`);let T=h.join(`
`);return{text:T,refs:x,chars:T.length,truncated:C}}function dt(t){let e=t.replace(/^\[|\]$/g,"").trim(),n=Tt.get(e);if(n?.isConnected)return n;try{let o=document.querySelector(`[${ut}="${CSS.escape(e)}"]`);return o?.isConnected?o:null}catch{return null}}var ie={start:()=>{},stop:()=>{}};function Et(t){if(!t||typeof window>"u")return ie;let e=window.AudioContext??window.webkitAudioContext;if(!e)return ie;let n=null,o=null;return{start(){if(!n)try{n=new e;let r=Math.floor(n.sampleRate*2),i=n.createBuffer(1,r,n.sampleRate),s=i.getChannelData(0),a=0;for(let d=0;d<r;d++){let p=Math.random()*2-1;a=(a+.02*p)/1.02,s[d]=a*3.5}o=n.createBufferSource(),o.buffer=i,o.loop=!0;let l=n.createBiquadFilter();l.type="lowpass",l.frequency.value=900;let u=n.createGain();u.gain.value=.02,o.connect(l).connect(u).connect(n.destination),o.start(),n.resume?.().catch(()=>{})}catch{this.stop()}},stop(){try{o?.stop()}catch{}o=null;try{n?.close()}catch{}n=null}}}function X(){let t=globalThis,e=t.SpeechRecognition??t.webkitSpeechRecognition;if(!e)return null;let n=new e;n.continuous=!0,n.interimResults=!1,n.lang="en-US";let o=!1,r=[],i=[];return n.onresult=s=>{for(let a=0;a<s.results.length;a+=1){let l=s.results[a];if(l?.isFinal){let u=l[0]?.transcript?.trim();if(u)for(let d of r)d(u)}}},n.onerror=s=>{for(let a of i)a(String(s?.error??"unknown"))},n.onend=()=>{o=!1},{start:()=>{if(!o){o=!0;try{n.start()}catch{}}},stop:()=>{if(o){o=!1;try{n.stop()}catch{}}},onFinal:s=>{r.push(s)},onError:s=>{i.push(s)},isActive:()=>o}}function pt(){let t=globalThis.speechSynthesis;if(!t)return{speak:async()=>{},cancel:()=>{},available:()=>!1};function e(){if(!t)return null;let n=t.getVoices();return n.find(o=>o.lang.startsWith("en-")&&o.default)??n.find(o=>o.lang.startsWith("en-"))??n[0]??null}return{speak:n=>new Promise(o=>{let r=new SpeechSynthesisUtterance(n),i=e();i&&(r.voice=i),r.rate=1,r.onend=()=>o(),r.onerror=()=>o(),t.speak(r)}),cancel:()=>t.cancel(),available:()=>!0}}function K(t,e){let n="idle",o=!1,r=[],i=s=>{if(n!==s){n=s;for(let a of r)a(s)}};return{start:()=>{if(n==="idle"){if(o){i("muted");return}t?.start(),i("listening")}},stop:()=>{t?.stop(),e.cancel(),i("idle")},speak:async s=>{n!=="idle"&&(t?.stop(),i("speaking"),await e.speak(s),o?i("muted"):(t?.start(),i("listening")))},setMuted:s=>{o=s,s?(t?.stop(),n==="listening"&&i("muted")):n==="muted"&&(t?.start(),i("listening"))},getState:()=>n,onStateChange:s=>{r.push(s)}}}function ao(t){if(!t||typeof t.type!="string")return!1;switch(t.type){case"navigate":return typeof t.path=="string";case"click":return typeof t.intent=="string"&&(t.ref===void 0||typeof t.ref=="string");case"scroll_to":case"highlight":case"point_at":case"demo_click":return typeof t.intent=="string";case"cart_add":case"cart_set_qty":return typeof t.sku=="string"&&typeof t.qty=="number";case"open_cart":case"cart_clear":case"cart_get":case"checkout_place":case"checkout_state":case"page_snapshot":return!0;case"apply_coupon":return typeof t.code=="string";case"product_lookup":return typeof t.handle=="string";case"checkout_fill":return!!t.details&&typeof t.details.name=="string"&&typeof t.details.phone=="string"&&typeof t.details.email=="string"&&typeof t.details.address=="string"&&typeof t.details.city=="string"&&typeof t.details.state=="string"&&typeof t.details.pincode=="string"&&(t.details.payment==="cod"||t.details.payment==="prepaid");case"form_fill":return Array.isArray(t.fields)&&t.fields.every(e=>e&&typeof e.field=="string"&&typeof e.value=="string"&&(e.ref===void 0||typeof e.ref=="string"));case"form_read":return t.fields===void 0||Array.isArray(t.fields);default:return!1}}function $(t){return JSON.stringify(t)}function At(t){let e;try{e=JSON.parse(t)}catch{return null}if(!e||typeof e!="object")return null;let n=e;switch(n.type){case"thinking":return{type:"thinking"};case"say":return typeof n.text=="string"?{type:"say",text:n.text}:null;case"say_partial":return typeof n.text=="string"?{type:"say_partial",text:n.text}:null;case"user_text":return typeof n.text=="string"?{type:"user_text",text:n.text}:null;case"cards":return Array.isArray(n.items)?{type:"cards",items:n.items}:null;case"tool_result":return typeof n.toolName!="string"||typeof n.ok!="boolean"?null:{type:"tool_result",toolName:n.toolName,ok:n.ok,summary:typeof n.summary=="string"?n.summary:void 0};case"checkout_redirect":return typeof n.url=="string"?{type:"checkout_redirect",url:n.url}:null;case"cap_warning":return n.reason!=="turns"&&n.reason!=="voice_ms"&&n.reason!=="duration_ms"||typeof n.remaining!="number"?null:{type:"cap_warning",reason:n.reason,remaining:n.remaining};case"end_of_turn":return{type:"end_of_turn"};case"session_closed":return n.reason!=="user"&&n.reason!=="cap"&&n.reason!=="error"?null:{type:"session_closed",reason:n.reason};case"host_action_request":{if(typeof n.callId!="string"||!n.action)return null;let o=n.action;return ao(o)?{type:"host_action_request",callId:n.callId,action:o}:null}case"persona_swap":return typeof n.personaId=="string"?{type:"persona_swap",personaId:n.personaId}:null;case"agent_warmed":return{type:"agent_warmed"};case"agent_ready":return{type:"agent_ready"};default:return null}}var ae="https://cdn.jsdelivr.net/npm",so="2.7.0",co="0.3.0",mt=null;function lo(){return mt||(mt=import(`${ae}/@livekit/krisp-noise-filter@${co}/dist/index.mjs`).catch(()=>null),mt)}async function uo(t){let e=await lo();if(!e?.KrispNoiseFilter||e.isKrispNoiseFilterSupported&&!e.isKrispNoiseFilterSupported())return;let n=t.localParticipant.getTrackPublication?.("microphone"),o=n?.audioTrack??n?.track;o?.setProcessor&&await o.setProcessor(e.KrispNoiseFilter())}var U=null;function se(){return U||(typeof globalThis.__SHOPPINGMATE_LIVEKIT_LOADER__=="function"?(U=globalThis.__SHOPPINGMATE_LIVEKIT_LOADER__(),U):(U=import(`${ae}/livekit-client@${so}/dist/livekit-client.esm.mjs`),U))}function ce(){se().catch(()=>{U=null})}function po(){try{if(typeof window<"u"){let e=window;if(typeof e.__SM_AUDIO_FULL__=="boolean")return e.__SM_AUDIO_FULL__}let t=new URLSearchParams(location.search).get("smAudioFull");return!(t==="0"||t==="false")}catch{return!0}}async function le(t){let e=await se(),n=po(),o=new e.Room({audioCaptureDefaults:{echoCancellation:!0,noiseSuppression:!0,autoGainControl:n,channelCount:1}}),r=new Map,i=!1;o.on("trackSubscribed",a=>{let l=a;if(l.kind!=="audio")return;let u=l.attach();u.style.display="none",u.muted=i,document.body.appendChild(u),r.set(a,u)}),o.on("trackUnsubscribed",a=>{let l=r.get(a);l&&(l.remove(),r.delete(a)),a.detach?.()});let s=[];return o.on("activeSpeakersChanged",a=>{let u=(a??[]).some(d=>!d.isLocal);for(let d of s)d(u)}),await o.connect(t.wsUrl,t.token),{setMicEnabled:async a=>{await o.localParticipant.setMicrophoneEnabled(a),a&&n&&uo(o).catch(()=>{})},onData:a=>{o.on("dataReceived",l=>{l instanceof Uint8Array&&a(l)})},onAgentSpeaking:a=>{s.push(a)},setAgentAudioMuted:a=>{i=a;for(let l of r.values())l.muted=a},onReconnected:a=>{o.on("reconnected",()=>a())},publishData:a=>o.localParticipant.publishData(a,{reliable:!0}),disconnect:async()=>{for(let a of r.values())a.remove();r.clear(),await o.disconnect()}}}function ue(t){let e="idle",n=null,o=null,r=!1,i=!1,s=!1,a=6e4,l=null,u=()=>{l&&clearTimeout(l),l=null},d=0,p=null,y=c=>{p&&!(c in p)&&(p[c]=Math.round(performance.now()-d))},w=()=>{if(!p||!n)return;let c=$({type:"voice_timing",sessionId:t.sessionId,timings:p});p=null,n.publishData(new TextEncoder().encode(c)).catch(()=>{})},S=[],E=[],h=c=>{if(e!==c){e=c;for(let f of S)f(c)}},x=c=>{let f=c instanceof Error?c.message:String(c),k=c instanceof Error?c.name:"",b;/permissions? policy|feature policy/i.test(f)?b="mic_policy_blocked":k==="NotAllowedError"||/denied|permission/i.test(f)?b="mic_denied":k==="NotFoundError"||/no.*microphone|not.*found/i.test(f)?b="mic_unavailable":/connect|network|websocket|timeout|token/i.test(f)?b="connect_failed":b="unknown";for(let _ of E)_({code:b,message:f})},C=async c=>{await c.setMicEnabled(!r);let f=new TextEncoder().encode($({type:"start_voice",sessionId:t.sessionId}));await c.publishData(f)},T=()=>{u(),!s&&(l=setTimeout(()=>{s||!n||(n.disconnect().catch(()=>{}),n=null,o=null)},a))},m=()=>n?(T(),Promise.resolve(n)):o||(o=(async()=>{let c=await le({wsUrl:t.wsUrl,token:t.token,roomName:t.roomName});return c.onData(f=>t.onTranscriptEvent(f)),c.onAgentSpeaking(f=>{f&&p&&(y("first_audio"),w()),!r&&(f&&(i=!0),i&&h(f?"speaking":"listening"))}),c.onReconnected(()=>{s&&(h("connecting"),i=!1,C(c).catch(f=>console.warn("[voiceModeLiveKit] re-start after reconnect failed",f)))}),n=c,T(),c})(),o.catch(()=>{o=null}),o);return{warm:()=>{m().catch(c=>console.warn("[voiceModeLiveKit] warm failed",c))},start:()=>{e==="idle"&&(h("connecting"),i=!1,u(),d=performance.now(),p={was_warm:n?1:0},(async()=>{try{let c=await m();u(),y("room_connected"),await C(c),y("mic_on"),s=!0,r&&h("muted")}catch(c){throw h("idle"),x(c),c}})().catch(c=>{console.warn("[voiceModeLiveKit] start failed",c)}))},stop:()=>{u(),p&&(y("hung_up"),w()),n?.disconnect().catch(()=>{}),n=null,o=null,s=!1,h("idle")},speak:async()=>{},setMuted:c=>{r=c,n?.setMicEnabled(!c).catch(()=>{}),n?.setAgentAudioMuted(c),c?h("muted"):e==="muted"&&h("listening")},getState:()=>e,onStateChange:c=>{S.push(c)},onError:c=>{E.push(c)},signalAgentReady:()=>{i=!0,y("agent_ready"),e==="connecting"&&h(r?"muted":"listening")},publishData:async c=>{n&&await n.publishData(c)}}}function ft(t){return t.stack==="web-speech"?K(X(),pt()):t.stack==="live-kit"?t.livekit?ue(t.livekit):(console.warn("[voiceModeFactory] live-kit stack requires livekit opts; returning null \u2192 caller falls back to chat"),null):null}async function de(t){if(t.platform!=="shopify")return;let e=t.fetchFn??fetch;try{await e("/cart/update.js",{method:"POST",credentials:"same-origin",headers:{"Content-Type":"application/json"},body:JSON.stringify({attributes:{sm_visitor_id:t.visitorId}})})}catch{}}var Mt={"Content-Type":"application/json"};function pe(t){let e=Number(String(t).trim());return Number.isFinite(e)&&e>0?e:null}function Lt(t){try{let e={cart:t},n=["cart:refresh","cart:updated","cart:change","cart:build","cart:rerender","ajaxCart:afterCartLoad","cart.requestComplete","added.ajaxProduct"];for(let i of n)document.dispatchEvent(new CustomEvent(i,{bubbles:!0,detail:e})),window.dispatchEvent(new CustomEvent(i,{bubbles:!0,detail:e}));let o=window;typeof o.getCartUpdate=="function"&&o.getCartUpdate(),typeof o.after_add_to_cart=="function"&&o.after_add_to_cart(t);let r=o.jQuery;if(r)try{r(document.body).trigger("cart:updated",[t]),r(document.body).trigger("added.ajaxProduct")}catch{}}catch{}fo()}var mo=["cart-icon-bubble","cart-live-region-text","cart-notification-button","cart-drawer"];async function fo(t=fetch){try{let e=mo.filter(i=>document.getElementById(`shopify-section-${i}`)||document.getElementById(i));if(e.length===0)return 0;let n=await t(`${location.pathname}?sections=${e.join(",")}`,{credentials:"same-origin"});if(!n.ok)return 0;let o=await n.json(),r=0;for(let[i,s]of Object.entries(o)){if(!s)continue;let a=document.getElementById(`shopify-section-${i}`)??document.getElementById(i);if(!a)continue;let l=new DOMParser().parseFromString(s,"text/html"),u=l.getElementById(`shopify-section-${i}`)??l.querySelector(".shopify-section")??l.body;a.innerHTML=u.innerHTML,r+=1}return r}catch{return 0}}async function me(t,e=fetch){let n=String(t??"").trim().replace(/^\/?products\//,"").replace(/[?#].*$/,"").replace(/\/$/,"");if(!n)return{ok:!1,reason:"not_found"};try{let o=await e(`/products/${encodeURIComponent(n)}.js`,{credentials:"same-origin"});if(!o.ok)return{ok:!1,reason:"not_found"};let r=await o.json(),i=(r.variants??[]).slice(0,30).map(s=>`${s.title??"Default"} (variantId ${s.id}, ${s.available?"in stock":"SOLD OUT"}${s.price!=null?`, ${(s.price/100).toFixed(2)}`:""})`).join("; ");return{ok:!0,channel:"shopify-ajax",values:{title:r.title??n,available:String(r.available??!1),variants:i}}}catch{return{ok:!1,reason:"not_found"}}}async function It(t){try{let e=await t("/cart.js",{credentials:"same-origin"});return e.ok?await e.json():null}catch{return null}}function Ht(t){let e=(t.items??[]).map(n=>`${n.product_title??"item"}${n.variant_title?` ${n.variant_title}`:""} x${n.quantity}`).join(", ");return{count:String(t.item_count??0),items:e,subtotal:t.total_price!=null?(t.total_price/100).toFixed(2):""}}async function fe(t,e,n=fetch){let o=pe(t);if(o==null)return{ok:!1,reason:"not_found"};try{if(!(await n("/cart/add.js",{method:"POST",credentials:"same-origin",headers:Mt,body:JSON.stringify({id:o,quantity:e>0?e:1})})).ok)return{ok:!1,reason:"not_found"};let i=await It(n);return i&&i.items.some(s=>s.id===o)?(Lt(i),{ok:!0,values:Ht(i)}):{ok:!1,reason:"not_found"}}catch{return{ok:!1,reason:"not_found"}}}async function ge(t=fetch){let e=await It(t);return e?{ok:!0,values:Ht(e)}:{ok:!1,reason:"not_found"}}async function he(t,e,n=fetch){let o=pe(t);if(o==null)return{ok:!1,reason:"not_found"};try{let r=await n("/cart/change.js",{method:"POST",credentials:"same-origin",headers:Mt,body:JSON.stringify({id:o,quantity:Math.max(0,e)})});if(!r.ok)return{ok:!1,reason:"not_found"};let i=await r.json().catch(()=>null);return Lt(i),i?{ok:!0,values:Ht(i)}:{ok:!0}}catch{return{ok:!1,reason:"not_found"}}}async function ye(t=fetch){try{return(await t("/cart/clear.js",{method:"POST",credentials:"same-origin",headers:Mt})).ok?(Lt(await It(t)),{ok:!0}):{ok:!1,reason:"not_found"}}catch{return{ok:!1,reason:"not_found"}}}async function be(t,e=fetch){let n=String(t??"").trim();if(!n)return{ok:!1,reason:"not_found"};try{return await e(`/discount/${encodeURIComponent(n)}`,{method:"GET",credentials:"same-origin",redirect:"manual"})?{ok:!0}:{ok:!1,reason:"not_found"}}catch{return{ok:!1,reason:"not_found"}}}var ve="/wp-json/wc/store/v1",Q=null;function go(){let t={"Content-Type":"application/json"};return Q&&(t.Nonce=Q,t["X-WC-Store-API-Nonce"]=Q),t}function we(t){let e=t.headers.get("Nonce")??t.headers.get("X-WC-Store-API-Nonce");e&&(Q=e)}async function P(t){try{let e=await t(`${ve}/cart`,{credentials:"same-origin"});return we(e),e.ok?await e.json():null}catch{return null}}function ht(t){let e=t.totals?.currency_minor_unit??2,n=t.totals?.total_price;return{count:String(t.items_count??0),items:(t.items??[]).map(o=>`${o.name??"item"} x${o.quantity}`).join(", "),subtotal:n!=null?(Number(n)/10**e).toFixed(e):""}}function Rt(){try{document.body.dispatchEvent(new CustomEvent("wc-blocks_added_to_cart",{bubbles:!0}));let t=window.jQuery;t?.(document.body).trigger("wc_fragment_refresh")}catch{}}function xe(t){let e=Number(String(t).trim());return Number.isFinite(e)&&e>0?e:null}async function gt(t,e,n){Q||await P(n);let o=await n(`${ve}${t}`,{method:"POST",credentials:"same-origin",headers:go(),body:JSON.stringify(e)});return we(o),o}async function ke(t,e,n=fetch){let o=xe(t);if(o==null)return{ok:!1,reason:"not_found"};try{let r=(await P(n))?.items.find(l=>l.id===o)?.quantity??0;if(!(await gt("/cart/add-item",{id:o,quantity:e>0?e:1},n)).ok)return{ok:!1,reason:"not_found"};let s=await P(n),a=s?.items.find(l=>l.id===o)?.quantity??0;return!s||a<=r?{ok:!1,reason:"not_found"}:(Rt(),{ok:!0,channel:"woo-store-api",verified:!0,values:ht(s)})}catch{return{ok:!1,reason:"not_found"}}}async function _e(t=fetch){let e=await P(t);return e?{ok:!0,channel:"woo-store-api",values:ht(e)}:{ok:!1,reason:"not_found"}}async function Se(t,e,n=fetch){let o=xe(t);if(o==null)return{ok:!1,reason:"not_found"};try{let r=(await P(n))?.items.find(l=>l.id===o);if(!r)return{ok:!1,reason:"not_found"};if(!(e<=0?await gt("/cart/remove-item",{key:r.key},n):await gt("/cart/update-item",{key:r.key,quantity:e},n)).ok)return{ok:!1,reason:"not_found"};let s=await P(n),a=s?.items.find(l=>l.id===o)?.quantity??0;return!s||a!==Math.max(0,e)?{ok:!1,reason:"not_found"}:(Rt(),{ok:!0,channel:"woo-store-api",verified:!0,values:ht(s)})}catch{return{ok:!1,reason:"not_found"}}}async function Ce(t=fetch){try{let e=await P(t);for(let o of e?.items??[])await gt("/cart/remove-item",{key:o.key},t);let n=await P(t);return!n||n.items.length>0?{ok:!1,reason:"not_found"}:(Rt(),{ok:!0,channel:"woo-store-api",verified:!0,values:ht(n)})}catch{return{ok:!1,reason:"not_found"}}}var ho="data-shoppingmate-bot-cursor",Te="data-shoppingmate-cursor-keyframes",Z=null,$t=window.innerWidth-80,Pt=window.innerHeight-80;function Ee(){if(Z&&Z.isConnected)return Z;yo();let t=document.createElement("div");return t.setAttribute(ho,""),t.innerHTML=`
    <svg width="22" height="22" viewBox="0 0 22 22" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path d="M3 2 L3 17 L7 13 L9.5 19 L12 18 L9.5 12 L15 12 Z"
            fill="#111827" stroke="#fff" stroke-width="1.2" stroke-linejoin="round"/>
    </svg>
  `,Object.assign(t.style,{position:"fixed",left:"0",top:"0",transform:`translate(${$t}px, ${Pt}px)`,transition:"transform 480ms cubic-bezier(0.22, 1, 0.36, 1), opacity 200ms",pointerEvents:"none",zIndex:"2147483647",opacity:"0",willChange:"transform, opacity",filter:"drop-shadow(0 2px 6px rgba(0,0,0,0.25))"}),document.body.appendChild(t),Z=t,t}function yo(){if(document.head.querySelector(`style[${Te}]`))return;let t=document.createElement("style");t.setAttribute(Te,""),t.textContent=`
    @keyframes shoppingmate-cursor-click {
      0%   { transform: var(--sm-cursor-pos) scale(1); }
      40%  { transform: var(--sm-cursor-pos) scale(0.72); }
      100% { transform: var(--sm-cursor-pos) scale(1); }
    }
  `,document.head.appendChild(t)}function bo(t){let e=t.getBoundingClientRect();return{x:e.left+e.width/2-6,y:e.top+e.height/2-6}}function q(t,e=480){let n=Ee(),{x:o,y:r}=bo(t);return n.style.transitionDuration=`${e}ms, 200ms`,n.style.opacity="1",n.style.transform=`translate(${o}px, ${r}px)`,$t=o,Pt=r,new Promise(i=>setTimeout(i,e))}function tt(){let t=Ee();return t.style.setProperty("--sm-cursor-pos",`translate(${$t}px, ${Pt}px)`),t.style.animation="shoppingmate-cursor-click 280ms ease-out",new Promise(e=>{let n=()=>{t.style.animation="",t.removeEventListener("animationend",n),e()};t.addEventListener("animationend",n),setTimeout(n,360)})}function N(t=600){let e=Z;e&&setTimeout(()=>{e.style.opacity="0"},t)}function vo(t,e){let n=t instanceof HTMLTextAreaElement?HTMLTextAreaElement.prototype:t instanceof HTMLSelectElement?HTMLSelectElement.prototype:HTMLInputElement.prototype,o=Object.getOwnPropertyDescriptor(n,"value");o?.set?o.set.call(t,e):t.value=e,t.dispatchEvent(new Event("input",{bubbles:!0})),t.dispatchEvent(new Event("change",{bubbles:!0}))}function Nt(t){return t.value??""}var Ae="sm_selector_cache_v1";function wo(){try{return JSON.parse(localStorage.getItem(Ae)??"{}")}catch{return{}}}function xo(t){try{localStorage.setItem(Ae,JSON.stringify(t))}catch{}}function ko(t){return`${location.pathname}::${t}`}function _o(t){let e=t.getAttribute("data-sm-field");if(e)return`[data-sm-field="${CSS.escape(e)}"]`;if(t.id)return`#${CSS.escape(t.id)}`;let n=t.getAttribute("name");return n?`[name="${CSS.escape(n)}"]`:null}function So(t,e){let n=wo(),o=ko(t),r=n[o];if(r)try{let s=document.querySelector(r);if(s?.isConnected)return s}catch{}let i=null;try{i=document.querySelector(`[data-sm-field="${CSS.escape(t)}"]`)}catch{i=null}if(i||(i=Ct(t,e)),i){let s=_o(i);s&&(n[o]=s,xo(n))}return i}function Me(t,e){let n={},o=[],r=!1;for(let{field:i,value:s,ref:a}of t){let l=a?dt(a):null,u=l&&/^(INPUT|TEXTAREA|SELECT)$/.test(l.tagName)?l:So(i,e);if(!u){o.push({field:i,ok:!1,value:""});continue}r=!0,vo(u,s);let d=Nt(u);n[i]=d,o.push({field:i,ok:d===s,value:d})}return r?{ok:!0,values:n,filled:o}:{ok:!1,reason:"not_found"}}function Le(t,e){let n={};if(t&&t.length>0){for(let r of t){let i=Ct(r,e);i&&(n[r]=Nt(i))}return{ok:!0,values:n}}let o=document.querySelectorAll("input, textarea, select");for(let r of o){let i=(r.getAttribute("type")??"").toLowerCase();if(i==="password"||i==="hidden")continue;let s=r.getAttribute("name")??r.id;s&&(n[s]=Nt(r))}return{ok:!0,values:n}}var Co="data-shoppingmate-pulse-ring";function He(t,e){let n=t.getBoundingClientRect(),o=document.createElement("div");o.setAttribute(Co,""),Object.assign(o.style,{position:"fixed",left:`${n.left-6}px`,top:`${n.top-6}px`,width:`${n.width+12}px`,height:`${n.height+12}px`,borderRadius:"14px",boxShadow:"0 0 0 3px rgba(139,92,246,0.85), 0 0 24px rgba(139,92,246,0.55)",pointerEvents:"none",zIndex:"2147483646",animation:"shoppingmate-pulse 1.2s ease-in-out infinite"}),To(),document.body.appendChild(o);let r=!1,i=()=>{r||(r=!0,o.remove())};return setTimeout(i,e),i}var Ie=!1;function To(){if(Ie)return;Ie=!0;let t=document.createElement("style");t.textContent=`@keyframes shoppingmate-pulse {
    0%, 100% { transform: scale(1); opacity: 1; }
    50% { transform: scale(1.04); opacity: 0.85; }
  }`,document.head.appendChild(t)}var et=null,yt=null,Ot=new Set;function Re(t){et=t,yt=null,Ot.clear()}function bt(t=fetch){if(!et)return Promise.resolve([]);if(!yt){let{apiBase:e,merchantId:n}=et;yt=t(`${e}/v1/site-templates/${encodeURIComponent(n)}`).then(o=>o.ok?o.json():{templates:[]}).then(o=>Array.isArray(o.templates)?o.templates:[]).catch(()=>[])}return yt}function Dt(t,e,n,o=fetch){if(!et)return;let r=`${t}:${e}`;if(Ot.has(r))return;Ot.add(r);let{apiBase:i,merchantId:s,sessionId:a}=et;o(`${i}/v1/site-templates/${encodeURIComponent(s)}/signal`,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({kind:t,templateId:e,coverage:n,sessionId:a,path:location.pathname}),keepalive:!0}).catch(()=>{})}var Eo=["[data-cart-count]","#cart-icon-bubble",".cart-count",".cart-count-bubble",'[class*="cart-count"]','[class*="CartCount"]'].join(",");function $e(){return(document.querySelector(Eo)?.textContent??"").replace(/\s+/g," ").trim()}function Pe(){return Array.from(document.querySelectorAll('dialog[open],[role="dialog"],[aria-modal="true"]')).filter(t=>!H(t)&&t.getAttribute("aria-hidden")!=="true").length}function Ne(t){let e=t;return[t.getAttribute("aria-expanded"),t.getAttribute("aria-checked"),t.getAttribute("aria-selected"),t.getAttribute("aria-pressed"),typeof e.checked=="boolean"?String(e.checked):"",t.className].join("|")}async function Vt(t,e,n=1500){let o=location.href,r=$e(),i=Pe(),s=t?Ne(t):"",a=0,l=new MutationObserver(d=>{for(let p of d)H(p.target)||p.type==="attributes"&&p.attributeName==="data-sm-ref"||(a+=1)});l.observe(document.body,{subtree:!0,childList:!0,attributes:!0,characterData:!0});let u=()=>{if(location.href!==o)return{verified:!0,observed:`navigated to ${location.pathname}`};let d=$e();if(d!==r)return{verified:!0,observed:`cart count ${r||"0"} \u2192 ${d||"0"}`};let p=Pe();return p>i?{verified:!0,observed:"a dialog/drawer opened"}:p<i?{verified:!0,observed:"a dialog/drawer closed"}:t?.isConnected&&Ne(t)!==s?{verified:!0,observed:"the control changed state"}:a>0?{verified:!0,observed:"the page updated"}:null};try{await e();let d=Date.now()+n;await new Promise(y=>setTimeout(y,50));let p=u();for(;!p&&Date.now()<d;)await new Promise(y=>setTimeout(y,100)),p=u();return p??{verified:!1,observed:"nothing changed on the page"}}finally{l.disconnect()}}var wt=null;function Oe(t){wt=t??null}function vt(){if(wt==="shopify")return!0;if(wt)return!1;try{return typeof window.Shopify<"u"}catch{return!1}}function nt(){return vt()?"shopify-ajax":wt==="woocommerce"?"woo-store-api":"storefront-hooks"}async function O(t,e){let n=await e;return n.ok?{channel:t,...n}:n}async function De(t){switch(t.type){case"navigate":return zt(t.path);case"scroll_to":return jo(t.intent);case"highlight":return Uo(t.intent,t.durationMs??2e3);case"click":return t.ref?Mo(t.ref,t.intent):qo(t.intent);case"point_at":return Fo(t.intent);case"demo_click":return Bo(t.intent);case"cart_add":{let e=nt();return e==="shopify-ajax"?O(e,fe(t.sku,t.qty)):e==="woo-store-api"?ke(t.sku,t.qty):O(e,Ro(t.sku,t.qty))}case"open_cart":return nt()==="woo-store-api"||vt()?zt("/cart"):$o();case"cart_set_qty":{let e=nt();return e==="shopify-ajax"?O(e,he(t.sku,t.qty)):e==="woo-store-api"?Se(t.sku,t.qty):O(e,Oo(t.sku,t.qty))}case"cart_clear":{let e=nt();return e==="shopify-ajax"?O(e,ye()):e==="woo-store-api"?Ce():O(e,No())}case"cart_get":{let e=nt();return e==="shopify-ajax"?O(e,ge()):e==="woo-store-api"?_e():O(e,Po())}case"product_lookup":return vt()?me(t.handle):{ok:!1,reason:"not_found"};case"apply_coupon":return vt()?be(t.code):Do(t.code);case"checkout_fill":return Io(t.details);case"checkout_place":return Ho();case"checkout_state":return Lo();case"form_fill":return Me(t.fields);case"form_read":return Le(t.fields);case"page_snapshot":return Ao()}}var xt=null;async function Ao(){let t=performance.now(),e=W(),n={};xt=null;let o=await bt();if(o.length>0){let r=te(ct(e.text),location.pathname,o);if(r.template){xt=r.template.id;let i=r.template.recipes.slice(0,6).map(s=>`${s.action.replace(/_/g," ")} = ${s.role} "${s.name}"`).join("; ");e=W({collapse:new Set(r.template.skeleton),preface:[`[template] ${r.template.pageType} page (known layout, ${Math.round(r.coverage*100)}% match)${i?` \xB7 how this page works: ${i}`:""}`]}),n.template=r.template.pageType,n.coverage=r.coverage.toFixed(2)}else r.drift&&(Dt("drift",r.drift.template.id,r.drift.coverage),n.drift=`${r.drift.template.pageType}:${r.drift.coverage.toFixed(2)}`)}return{ok:!0,values:{snapshot:e.text,refs:String(e.refs),chars:String(e.chars),buildMs:String(Math.round(performance.now()-t)),...n}}}function Ve(t){!t&&xt&&Dt("verify",xt,0)}function ze(t){let e=t.closest("a[href]");if(!e||e.target==="_blank")return null;try{let n=new URL(e.href,window.location.href);return n.origin!==window.location.origin||n.pathname===window.location.pathname&&n.search===window.location.search?null:n.pathname}catch{return null}}async function Mo(t,e){let n=dt(t)??(e?z(e):null);if(!n)return{ok:!1,reason:"stale_target"};if(await jt(n),await q(n,420),await tt(),!n.isConnected)return{ok:!1,reason:"stale_target"};let o=ze(n);if(o)return n.click(),N(800),{ok:!0,verified:!0,observed:`navigating to ${o}`};let r=await Vt(n,()=>n.click());return N(800),Ve(r.verified),{ok:!0,verified:r.verified,observed:r.observed}}async function Lo(){let t=window.__shoppingmateCheckoutState__;if(typeof t!="function")return{ok:!1,reason:"not_found"};try{return await t()?{ok:!0}:{ok:!1,reason:"not_found"}}catch{return{ok:!1,reason:"not_found"}}}async function Io(t){let e=window.__shoppingmateCheckoutFill__;if(typeof e!="function")return{ok:!1,reason:"not_found"};try{return await e(t)?{ok:!0}:{ok:!1,reason:"not_found"}}catch{return{ok:!1,reason:"not_found"}}}async function Ho(){let t=window.__shoppingmatePlaceOrder__;if(typeof t!="function")return{ok:!1,reason:"not_found"};try{return await t()?{ok:!0}:{ok:!1,reason:"not_found"}}catch{return{ok:!1,reason:"not_found"}}}function Ro(t,e){let n=window.__shoppingmateCartAdd__;if(typeof n!="function")return{ok:!1,reason:"not_found"};try{return n(t,e)?{ok:!0}:{ok:!1,reason:"not_found"}}catch{return{ok:!1,reason:"not_found"}}}function $o(){let t=window.__shoppingmateOpenCart__;if(typeof t!="function")return{ok:!1,reason:"not_found"};try{return t(),{ok:!0}}catch{return{ok:!1,reason:"not_found"}}}function Po(){let t=window.__shoppingmateGetCart__;if(typeof t!="function")return{ok:!1,reason:"not_found"};try{let e=t(),n=(e?.items??[]).map(o=>`${o.sku??o.name??"item"} x${o.quantity??1}`).join(", ");return{ok:!0,values:{count:String(e?.count??0),items:n,subtotal:e?.subtotal!=null?String(e.subtotal):""}}}catch{return{ok:!1,reason:"not_found"}}}function No(){let t=window.__shoppingmateClearCart__;if(typeof t!="function")return{ok:!1,reason:"not_found"};try{return t()?{ok:!0}:{ok:!1,reason:"not_found"}}catch{return{ok:!1,reason:"not_found"}}}function Oo(t,e){let n=window.__shoppingmateCartSetQty__;if(typeof n!="function")return{ok:!1,reason:"not_found"};try{return n(t,e)?{ok:!0}:{ok:!1,reason:"not_found"}}catch{return{ok:!1,reason:"not_found"}}}async function Do(t){let e=window.__shoppingmateApplyCoupon__;if(typeof e!="function")return{ok:!1,reason:"not_found"};try{return await e(t)?{ok:!0}:{ok:!1,reason:"not_found"}}catch{return{ok:!1,reason:"not_found"}}}function Vo(t){let e=window.__shoppingmateNavigate__;if(typeof e=="function")try{return e(t),!0}catch{return!1}return!1}async function zt(t){try{let e=new URL(t,window.location.href);if(e.origin!==window.location.origin)return{ok:!1,reason:"cross_origin"};let n=zo(e.pathname);n&&(await q(n,520),await tt());let o=e.pathname+e.search+e.hash;return Vo(o)||window.location.assign(o),N(800),{ok:!0}}catch{return{ok:!1,reason:"route_not_found"}}}function zo(t){let e=document.querySelectorAll("a[href]");for(let n of e)try{if(new URL(n.href,window.location.href).pathname===t)return n}catch{}return null}async function jo(t){let e=z(t);return e?(await q(e,480),e.scrollIntoView({behavior:"smooth",block:"center"}),N(800),{ok:!0}):{ok:!1,reason:"not_found"}}function Uo(t,e){let n=z(t);return n?(He(n,e),{ok:!0}):{ok:!1,reason:"not_found"}}async function qo(t){let e=z(t);if(!e)return{ok:!1,reason:"not_found"};if(!e.isConnected)return{ok:!1,reason:"stale_target"};if(await q(e,420),await tt(),!e.isConnected)return{ok:!1,reason:"stale_target"};let n=ze(e);if(n)return e.click(),N(800),{ok:!0,verified:!0,observed:`navigating to ${n}`};let o=await Vt(e,()=>e.click());return N(800),Ve(o.verified),{ok:!0,verified:o.verified,observed:o.observed}}async function jt(t){let e=t.getBoundingClientRect(),n=window.innerHeight;(e.bottom<80||e.top>n-80)&&(t.scrollIntoView({behavior:"smooth",block:"center"}),await new Promise(r=>setTimeout(r,350)))}async function Fo(t){let e=z(t);return e?e.isConnected?(await jt(e),await q(e,480),{ok:!0}):{ok:!1,reason:"stale_target"}:{ok:!1,reason:"not_found"}}async function Bo(t){let e=z(t);return e?e.isConnected?(await jt(e),await q(e,420),await tt(),await new Promise(n=>setTimeout(n,120)),e.isConnected?(e.click(),N(800),{ok:!0}):{ok:!1,reason:"stale_target"}):{ok:!1,reason:"stale_target"}:{ok:!1,reason:"not_found"}}var kt="sm_visitor_id";function Wo(){let t=new Uint8Array(8);return(globalThis.crypto??window.crypto).getRandomValues(t),`v_${Array.from(t,n=>n.toString(16).padStart(2,"0")).join("")}`}function Ko(){try{let e=localStorage.getItem(kt);if(e){let n=JSON.parse(e);if(n?.id&&typeof n.expiresAt=="number")return n}}catch{}let t=document.cookie.match(new RegExp(`(?:^|; )${kt}=([^;]+)`));return t?{id:decodeURIComponent(t[1]??""),expiresAt:Date.now()+1}:null}function je(t){try{localStorage.setItem(kt,JSON.stringify(t));let e=Math.floor(6048e5/1e3);document.cookie=`${kt}=${t.id}; max-age=${e}; path=/; SameSite=Lax; Secure`}catch{}}function ot(){let t=Date.now(),e=Ko();if(e&&e.expiresAt>t)return je({id:e.id,expiresAt:t+6048e5}),e.id;let n=Wo();return je({id:n,expiresAt:t+6048e5}),n}var rt=[200,500],Ue=t=>new Promise(e=>setTimeout(e,t));async function Ut(t,e){let n;for(let o=0;o<=rt.length;o++)try{let r=await fetch(t,e);if(r.status>=500&&o<rt.length){await Ue(rt[o]??0);continue}return r}catch(r){if(n=r,o<rt.length){await Ue(rt[o]??0);continue}throw r}throw n}async function qe(t){try{let e=ot(),n=await Ut(`${t.apiBase}/v1/install`,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({merchantId:t.merchantId,domain:t.domain,userAgent:navigator.userAgent,referrer:document.referrer||null})});if(!n.ok)return{kind:"err",reason:`install_${n.status}`};let o=await n.json();Oe(o.platform??null),de({visitorId:e,platform:o.platform??"custom"});let r=await Ut(`${t.apiBase}/v1/session`,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({merchantId:t.merchantId,domain:t.domain})});if(!r.ok)return{kind:"err",reason:`session_${r.status}`};let i=await r.json(),s=null;try{let a=await Ut(`${t.apiBase}/v1/voice/token`,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({sessionId:i.sessionId,merchantId:t.merchantId,visitorId:e})});a.ok?s=await a.json():console.warn("[shoppingmate] voice unavailable \u2014 status",a.status)}catch(a){console.warn("[shoppingmate] voice unavailable \u2014",a)}return{kind:"ok",sessionId:i.sessionId,wsUrl:i.wsUrl,merchantStatus:o.status,personaId:o.personaId??s?.personaId??null,widgetPosition:o.widgetPosition??null,widgetSize:o.widgetSize??null,widgetAccent:o.widgetAccent??null,widgetLabel:o.widgetLabel??null,widgetGreeting:o.widgetGreeting??null,voice:s,visitorId:e,insights:o.insights??null}}catch(e){return{kind:"err",reason:e instanceof Error?e.message:"network"}}}function Fe(t){let e=0,n=s=>{let a=Date.now();a-e<200||(e=a,t.send(s))},o=s=>{let a=s.target;if(!a)return;let l=Go(a),u=l?Yo(l,t.hints):null;n({type:"visitor_action",sessionId:t.sessionId,action:"click",intentKey:u,url:window.location.href,elementLabel:l,timestamp:Date.now()})},r=()=>{n({type:"visitor_action",sessionId:t.sessionId,action:"route_change",intentKey:null,url:window.location.href,elementLabel:null,timestamp:Date.now()})},i=s=>{let a=s.target;if(!a)return;let l=a.tagName?.toLowerCase();l!=="input"&&l!=="textarea"&&l!=="select"||a.type==="password"||n({type:"visitor_action",sessionId:t.sessionId,action:"form_focus",intentKey:null,url:window.location.href,elementLabel:a.name||a.id||null,timestamp:Date.now()})};return document.addEventListener("click",o,{passive:!0,capture:!0}),window.addEventListener("popstate",r),document.addEventListener("focusin",i,{passive:!0}),()=>{document.removeEventListener("click",o,!0),window.removeEventListener("popstate",r),document.removeEventListener("focusin",i)}}function Go(t){return t.getAttribute("aria-label")??t.getAttribute("title")??(t.textContent??"").trim().slice(0,80)??null}function Yo(t,e){let n=t.toLowerCase();if(e.has(n))return n;for(let o of e.keys())if(n.includes(o)||o.includes(n))return o;return null}function Ke(t){return t.replace(/[-_]+/g," ").trim().replace(/\b\w/g,e=>e.toUpperCase())}function Be(t){let e=String(t??"").trim();return!e||/^\d+$/.test(e)?null:Ke(e)}function We(t){let e=(t||"/").split(/[?#]/)[0]??"/";if(e==="/"||e==="")return"the home page";if(/^\/checkout/.test(e))return"checkout";if(/^\/cart\/?$/.test(e))return"your cart";let n=e.replace(/\/+$/,"").split("/").pop()??"";return n?`the ${Ke(n)} page`:"that page"}function Ge(t,e){switch(t.type){case"cart_add":{let n=Be(t.sku),o=n?`${t.qty>1?`${t.qty} \xD7 `:""}${n}`:"that";return e.ok?{text:`Added ${o} to your cart`,ok:!0}:{text:`Couldn't add ${n??"that"} to your cart`,ok:!1}}case"cart_set_qty":{let n=Be(t.sku)??"that item";return e.ok?t.qty<=0?{text:`Removed ${n} from your cart`,ok:!0}:{text:`Set ${n} to ${t.qty}`,ok:!0}:{text:`Couldn't update ${n}`,ok:!1}}case"cart_clear":return e.ok?{text:"Emptied your cart",ok:!0}:{text:"Couldn't empty your cart",ok:!1};case"apply_coupon":return e.ok?{text:`Applied code ${t.code.toUpperCase()}`,ok:!0}:{text:`Code ${t.code.toUpperCase()} didn't apply`,ok:!1};case"navigate":return e.ok?{text:`Opened ${We(t.path)}`,ok:!0}:{text:`Couldn't open ${We(t.path)}`,ok:!1};case"form_fill":case"checkout_fill":return e.ok?(e.filled??[]).filter(r=>!r.ok).length>0?{text:"Filled in some of your details \u2014 please check the page",ok:!1}:{text:"Filled in your details \u2014 please check them on the page",ok:!0}:{text:"Couldn't fill in your details \u2014 please type them on the page",ok:!1};case"checkout_place":return e.ok?{text:"Sent your order to the payment page",ok:!0}:{text:"Couldn't place the order",ok:!1};case"click":return e.ok?e.verified===!1?{text:"That tap didn't change anything \u2014 trying another way",ok:!1}:null:{text:"Couldn't find that on the page",ok:!1};default:return null}}var qt=10,Ye='[data-cart-count],#cart-icon-bubble,.cart-count,.cart-count-bubble,[class*="cart-count"],[class*="CartCount"]';function Jo(t=window){try{if(navigator.globalPrivacyControl)return!1;let e=t.Shopify?.customerPrivacy?.analyticsProcessingAllowed;if(typeof e=="function")return!!e();if(typeof t.OnetrustActiveGroups=="string")return t.OnetrustActiveGroups.includes("C0002");if(t.Cookiebot?.hasResponse)return!!t.Cookiebot.consent?.statistics}catch{}return null}function Xo(t,e){return t!==null?t:!/^Europe\//.test(e)}function Qo(t){return t<768?"mobile":t<1024?"tablet":"desktop"}function Je(t,e,n){let o=new URLSearchParams(t).get("utm_source");if(o)return o.toLowerCase().slice(0,40);if(!e)return"direct";try{let r=new URL(e).hostname.replace(/^www\./,"");return r===n.replace(/^www\./,"")?"internal":/google\./.test(r)?"google":/facebook|fb\.|instagram/.test(r)?"meta":r.slice(0,40)}catch{return"direct"}}function Zo(t,e){if(/\/(thank|order-confirm|order-success|checkouts\/.*\/thank_you)/i.test(t))return"purchase";if(/\/checkout/i.test(t))return"checkout";if(/^\/cart\/?$/i.test(t))return"cart";for(let n of e)try{if(new RegExp(n.urlPattern).test(t))return n.pageType}catch{}return t==="/"||t===""?"home":"other"}function Ft(){return Math.max(document.documentElement.scrollHeight,document.body?.scrollHeight??0,window.innerHeight,1)}function Xe(){try{let e=window.__shoppingmateGetCart__;if(typeof e=="function"){let n=e()?.count;if(typeof n=="number")return n}}catch{}let t=Number((document.querySelector(Ye)?.textContent??"").replace(/\D/g,""));return Number.isFinite(t)&&document.querySelector(Ye)!==null?t:null}function tr(t){let e=t?.closest?.('a,button,input,select,textarea,summary,[role="button"],[role="link"],[role="tab"]');if(!e)return null;let n=e.tagName==="A"?"link":e.tagName==="BUTTON"?"button":e.getAttribute("role")??e.tagName.toLowerCase();return Y(n,B(e)||e.getAttribute("name")||"")}var _t="sm_ins_visit",er=30*60*1e3;function nr(t=Date.now(),e=()=>Math.random().toString(36).slice(2)){let n=null;try{n=JSON.parse(sessionStorage.getItem(_t)??"null")}catch{n=null}if(!n||t-n.last>er){let o=!1;try{o=!localStorage.getItem("sm_seen"),localStorage.setItem("sm_seen","1")}catch{}n={id:`v_${e()}${t.toString(36)}`,last:t,isNew:o,bot:!1,qa:!1}}n.last=t;try{sessionStorage.setItem(_t,JSON.stringify(n))}catch{}return n}function Bt(t){try{let e=JSON.parse(sessionStorage.getItem(_t)??"null");e&&sessionStorage.setItem(_t,JSON.stringify({...e,...t}))}catch{}}var Wt=!1;function Qe(){Wt=!0,Bt({bot:!0})}function or(t,e){if(t>=1)return!0;if(t<=0)return!1;let n=0;for(let o of e)n=n*31+o.charCodeAt(0)>>>0;return n%1e3/1e3<t}function Ze(t){if(!t.config?.enabled)return null;let e=nr();if(!or(t.config.sampleRate,e.id))return null;let n=(()=>{try{return Intl.DateTimeFormat().resolvedOptions().timeZone??""}catch{return""}})();if(!Xo(Jo(),n))return null;let o=[];bt().then(c=>{o=c});let r=e.qa||/ShoppingmateBot|HeadlessChrome/.test(navigator.userAgent)||new URLSearchParams(location.search).has("sm_qa");r&&!e.qa&&Bt({qa:!0});let i=e.isNew;e.bot&&(Wt=!0);let s=(()=>{try{let c=sessionStorage.getItem("sm_src")??Je(location.search,document.referrer,location.hostname);return sessionStorage.setItem("sm_src",c),c}catch{return Je(location.search,document.referrer,location.hostname)}})(),a=l();function l(){return{path:location.pathname,start:Date.now(),maxScroll:0,attention:new Array(qt).fill(0),cells:{},elements:{},rage:0,dead:0,errorClicks:0,deadTargets:[],rageTargets:[],focused:new Set,submitted:!1,lcp:null,cls:0,inp:null,jsErrors:0,cartStart:Xe(),recent:[],lastClickAt:0,sent:!1}}let u=()=>{let c=Math.min(100,Math.round((window.scrollY+window.innerHeight)/Ft()*100));c>a.maxScroll&&(a.maxScroll=c)},d=window.setInterval(()=>{if(document.visibilityState!=="visible")return;let c=Math.min(qt-1,Math.floor((window.scrollY+window.innerHeight/2)/Ft()*qt));a.attention[c]=(a.attention[c]??0)+1},1e3),p=c=>{if(H(c.target))return;let f=Date.now(),k=Math.min(9,Math.floor((c.clientX+window.scrollX)/Math.max(document.documentElement.scrollWidth,1)*10)),b=Math.min(9,Math.floor((c.clientY+window.scrollY)/Ft()*10)),_=`${k},${b}`;a.cells[_]=(a.cells[_]??0)+1;let A=tr(c.target);A&&(a.elements[A]=(a.elements[A]??0)+1),a.recent=a.recent.filter(M=>f-M.t<700&&Math.abs(M.x-c.clientX)<30&&Math.abs(M.y-c.clientY)<30),a.recent.push({t:f,x:c.clientX,y:c.clientY}),a.recent.length===3&&(a.rage+=1,A&&a.rageTargets.length<5&&a.rageTargets.push(A)),a.lastClickAt=f;let F=location.href,I=c.target instanceof Element?c.target:null,G=I?.closest('a,button,label,summary,[role="button"],[role="tab"],[role="option"]')??I?.parentElement??I,at=document.activeElement,st=!1,Rn=M=>M instanceof HTMLElement&&(M.matches('dialog,[role="dialog"],[aria-modal="true"],[role="alert"],[role="status"]')||/fixed|sticky/.test(getComputedStyle(M).position)),Qt=new MutationObserver(M=>{for(let L of M)if(!H(L.target)){if(G?.contains(L.target)){st=!0;return}if(L.type==="attributes"&&G&&L.target.contains?.(G)&&/^(aria-|open$|hidden$)/.test(L.attributeName??"")){st=!0;return}if(L.type==="childList"&&[...L.addedNodes].some(Rn)){st=!0;return}}});Qt.observe(document.body,{subtree:!0,childList:!0,attributes:!0,characterData:!0}),window.setTimeout(()=>{Qt.disconnect();let M=document.activeElement!==at&&document.activeElement!==document.body;if(!st&&!M&&location.href===F&&a.path===location.pathname){a.dead+=1;let L=A??(()=>{let Zt=(I?.textContent??I?.getAttribute("alt")??"").replace(/\s+/g," ").trim().toLowerCase();return Zt?`text|${Zt.slice(0,30)}`:null})();L&&a.deadTargets.length<5&&!a.deadTargets.includes(L)&&a.deadTargets.push(L)}},800)},y=c=>{/shoppingmate|widget\/v1/.test(`${c.filename??""}`)||(a.jsErrors+=1,Date.now()-a.lastClickAt<1e3&&(a.errorClicks+=1))},w=c=>{let f=c.target;if(!f||H(f)||!/^(INPUT|TEXTAREA|SELECT)$/.test(f.tagName))return;let k=(f.getAttribute("type")??"").toLowerCase();if(k==="hidden"||k==="password")return;let b=(f.getAttribute("name")||f.id||f.getAttribute("placeholder")||f.tagName).slice(0,40);a.focused.add(b)},S=()=>{a.submitted=!0},E=[];try{let c=new PerformanceObserver(b=>{let _=b.getEntries().at(-1);_&&(a.lcp=Math.round(_.startTime))});c.observe({type:"largest-contentful-paint",buffered:!0});let f=new PerformanceObserver(b=>{for(let _ of b.getEntries())_.hadRecentInput||(a.cls+=_.value??0)});f.observe({type:"layout-shift",buffered:!0});let k=new PerformanceObserver(b=>{for(let _ of b.getEntries())a.inp=Math.max(a.inp??0,Math.round(_.duration))});k.observe({type:"event",buffered:!0,durationThreshold:40}),E=[c,f,k]}catch{}let h=()=>{if(a.sent)return;a.sent=!0,Bt({last:Date.now()});let c=Object.fromEntries(Object.entries(a.elements).sort((A,F)=>F[1]-A[1]).slice(0,20)),f=Xe(),k={v:1,merchantId:t.merchantId,sessionId:e.id,visitorId:t.visitorId,path:a.path,pageType:Zo(a.path,o),device:Qo(window.innerWidth),source:s,newVisitor:i,dwellMs:Date.now()-a.start,maxScroll:a.maxScroll,attention:a.attention,cells:a.cells,elements:c,rage:a.rage,dead:a.dead,errorClicks:a.errorClicks,deadTargets:a.deadTargets,rageTargets:a.rageTargets,abandonedFields:a.submitted?[]:[...a.focused].slice(0,10),lcp:a.lcp,cls:Math.round(a.cls*1e3)/1e3,inp:a.inp,jsErrors:a.jsErrors,botEngaged:Wt,cartIncreased:a.cartStart!==null&&f!==null&&f>a.cartStart,qa:r},b=JSON.stringify(k),_=`${t.apiBase}/v1/insights/pageview`;try{navigator.sendBeacon?.(_,new Blob([b],{type:"text/plain"}))||fetch(_,{method:"POST",body:b,keepalive:!0,headers:{"content-type":"text/plain"}}).catch(()=>{})}catch{}},x=()=>{location.pathname!==a.path&&(h(),a=l(),u())},C=history.pushState,T=history.replaceState;history.pushState=function(...c){let f=C.apply(this,c);return window.setTimeout(x,0),f},history.replaceState=function(...c){let f=T.apply(this,c);return window.setTimeout(x,0),f};let m=()=>h();return window.addEventListener("scroll",u,{passive:!0}),window.addEventListener("popstate",x),window.addEventListener("pagehide",m),document.addEventListener("visibilitychange",()=>{document.visibilityState==="hidden"&&h()}),document.addEventListener("click",p,!0),document.addEventListener("focusin",w,!0),document.addEventListener("submit",S,!0),window.addEventListener("error",y),u(),()=>{h(),window.clearInterval(d);for(let c of E)c.disconnect();history.pushState=C,history.replaceState=T,window.removeEventListener("scroll",u),window.removeEventListener("popstate",x),window.removeEventListener("pagehide",m),document.removeEventListener("click",p,!0),document.removeEventListener("focusin",w,!0),document.removeEventListener("submit",S,!0),window.removeEventListener("error",y)}}var tn={"calm-clinician":"Sage","calmosis-clinician":"Calmio",stylist:"Lumi",coach:"Kai",concierge:"Olivia",curator:"Theo",guide:"Maya",expert:"Arjun",host:"Ana"},rr={"calmosis-clinician":"calm-clinician"};function ir(){let t="https://shoppingmate-web.vercel.app/widget/personas";return t&&typeof t=="string"?t.replace(/\/$/,""):"https://cdn.shoppingmate.ai/v1/personas"}var en={id:"pending",name:"Assistant",initial:"A",avatarUrl:""};function nn(){return en}function on(t){if(!t||!tn[t])return en;let e=tn[t],n=rr[t]??t;return{id:t,name:e,initial:e.charAt(0).toUpperCase(),avatarUrl:`${ir()}/${n}.png`}}var rn=0,R=()=>(rn+=1,`t${rn}`);function ar(t,e){switch(e.type){case"set_mode":return{...t,mode:e.mode};case"set_voice_state":return e.state!=="idle"?{...t,voiceState:e.state,voiceError:null,invited:!1}:{...t,voiceState:e.state};case"set_connection":return{...t,connection:e.status,thinking:e.status==="connected"?t.thinking:!1};case"set_voice_error":return{...t,voiceError:e.error};case"set_invited":return{...t,invited:e.invited};case"receipt":{let n=t.transcript[t.transcript.length-1];return n&&n.kind==="receipt"&&n.text===e.text&&n.ok===e.ok?t:{...t,transcript:[...t.transcript,{id:R(),role:"system",kind:"receipt",text:e.text,ok:e.ok,ts:Date.now()}]}}case"reset":return{...t,transcript:[],thinking:!1,closed:!1,closedReason:null,checkoutUrl:null,capWarning:null};case"user_input":return{...t,transcript:[...t.transcript,{id:R(),role:"user",kind:"text",text:e.text,ts:Date.now()}]};case"agent_event":{let n=e.event;switch(n.type){case"thinking":return{...t,thinking:!0};case"end_of_turn":return{...t,thinking:!1};case"say":{let o=t.transcript[t.transcript.length-1];return o&&o.role==="agent"&&o.kind==="text"&&o.partial?{...t,thinking:!1,transcript:[...t.transcript.slice(0,-1),{...o,text:n.text,partial:!1,ts:Date.now()}]}:{...t,thinking:!1,transcript:[...t.transcript,{id:R(),role:"agent",kind:"text",text:n.text,ts:Date.now()}]}}case"say_partial":{let o=t.transcript[t.transcript.length-1];return o&&o.role==="agent"&&o.kind==="text"&&o.partial?{...t,thinking:!1,transcript:[...t.transcript.slice(0,-1),{...o,text:n.text,ts:Date.now()}]}:{...t,thinking:!1,transcript:[...t.transcript,{id:R(),role:"agent",kind:"text",text:n.text,ts:Date.now(),partial:!0}]}}case"user_text":return{...t,transcript:[...t.transcript,{id:R(),role:"user",kind:"text",text:n.text,ts:Date.now()}]};case"cards":return{...t,transcript:[...t.transcript,{id:R(),role:"agent",kind:"cards",items:n.items,ts:Date.now()}]};case"tool_result":return n.toolName==="case.open"&&n.ok?{...t,transcript:[...t.transcript,{id:R(),role:"system",kind:"receipt",text:"Your request is with the team \u2014 they\u2019ll contact you",ok:!0,ts:Date.now()}]}:t;case"checkout_redirect":return{...t,checkoutUrl:n.url};case"cap_warning":return{...t,capWarning:{reason:n.reason,remaining:n.remaining},transcript:[...t.transcript,{id:R(),role:"system",kind:"cap_warning",remaining:n.remaining,ts:Date.now()}]};case"session_closed":return{...t,closed:!0,closedReason:n.reason,transcript:[...t.transcript,{id:R(),role:"system",kind:"closed",reason:n.reason,ts:Date.now()}]};default:return t}}default:return t}}function Kt(t){let e={sessionId:t.sessionId,mode:"pill",voiceState:"idle",transcript:[],thinking:!1,closed:!1,closedReason:null,checkoutUrl:null,capWarning:null,connection:"connecting",voiceError:null,invited:!1},n=[];return{get:()=>e,dispatch:o=>{e=ar(e,o);for(let r of n)r(e)},subscribe:o=>(n.push(o),()=>{let r=n.indexOf(o);r>=0&&n.splice(r,1)})}}var an=`
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
`;var sn=[1e3,2e3,4e3,8e3,16e3],sr=5;function cn(t,e){let n=null,o=0,r=!1,i=[];function s(){r||(e.onStatus(o>0?"reconnecting":"connecting"),n=new WebSocket(t),n.onopen=()=>{e.onStatus("connected"),o>0&&n?.send(JSON.stringify({type:"session_resume",sessionId:e.sessionId})),o=0;for(let a of i)n?.send(a);i=[]},n.onmessage=a=>e.onEvent(typeof a.data=="string"?a.data:""),n.onerror=()=>{},n.onclose=()=>{if(r)return;if(o+=1,o>=sr){e.onStatus("disconnected");return}let a=Math.min(o-1,sn.length-1),l=sn[a]??3e4;e.onStatus("reconnecting"),setTimeout(s,l)})}return s(),{send:a=>{n&&n.readyState===1?n.send(a):i.push(a)},close:()=>{r=!0,n?.close()}}}var g={captionResting:"AI ASSISTANT",captionIncoming:"INCOMING CALL",captionThinking:"THINKING",captionConnected:"CONNECTED",captionRetry:"TAP TO RETRY",captionOffline:"OFFLINE",talkToPrefix:"Talk to",callCta:"Call",acceptCta:"Accept",callAria:"Start voice call",acceptAria:"Accept call",micMute:"Mute mic",micUnmute:"Unmute mic",retryAria:"Retry call",endCallAria:"End call",closeAria:"Close",openAria:"Open shoppingmate",chatAria:"Chat instead",callFailedTitle:"Could not start the call. Please try again.",callHelpHeading:"How can I help you?",callBullets:["Find the right product","Compare options out loud","Check out on this page"],panelHelpHeading:"Hi, I'm",panelHelpSubtitle:"I'm here to help you:",panelBullets:["Find the right product fast","Compare options out loud","Check out without leaving the page"],panelPrompts:["Help me find the right product","Can you compare your products for me?","I'd like to check out"],poweredBy:"Powered by shoppingmate",chatPlaceholder:"Type a quick question\u2026",reconnecting:"Reconnecting\u2026",disconnected:"Connection lost \u2014 reload to retry",closed:{user:"Conversation ended",cap:"Time to wrap up \u2014 reload for a new chat",error:"Something went wrong"},payNow:"Pay now \u2192",capWarning:"A couple minutes left",thinking:"thinking\u2026",micDenied:"Mic blocked \u2014 switching to text"};var D=t=>`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${t}</svg>`,Gt=D('<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>'),ln=D('<path d="M18 6 6 18"/><path d="m6 6 12 12"/>'),un=D('<path d="M5 12h14"/>'),dn=D('<path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>'),pn=D('<path d="M10.68 13.31a16 16 0 0 0 3.41 2.6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7 2 2 0 0 1 1.72 2v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.42 19.42 0 0 1-3.33-2.67"/><path d="M5 5a2 2 0 0 1 2-2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L10.9 11.1"/><line x1="22" y1="2" x2="2" y2="22"/>'),mn=D('<path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="22"/>'),fn=D('<line x1="2" y1="2" x2="22" y2="22"/><path d="M18.89 13.23A7.12 7.12 0 0 0 19 12v-2"/><path d="M5 10v2a7 7 0 0 0 12 5"/><path d="M15 9.34V5a3 3 0 0 0-5.68-1.33"/><path d="M9 9v3a3 3 0 0 0 5.12 2.12"/><line x1="12" y1="19" x2="12" y2="22"/>'),gn=D('<path d="M22 2 11 13"/><path d="M22 2l-7 20-4-9-9-4 20-7z"/>');function it(t){return t.replace(/[&<>"']/g,e=>e==="&"?"&amp;":e==="<"?"&lt;":e===">"?"&gt;":e==='"'?"&quot;":"&#39;")}function cr(t){return it(t.trim()).replace(/\*\*([^*\n]+)\*\*/g,"<strong>$1</strong>").replace(/__([^_\n]+)__/g,"<strong>$1</strong>").replace(/(^|\s)\*([^*\n]+)\*(?=\s|$|[.,!?])/g,"$1$2").replace(/^#{1,6}\s+/gm,"").replace(/^\s*[-•]\s+/gm,"\u2022 ").replace(/\n{2,}/g,`
`).replace(/\n/g,"<br>")}function yn(t,e,n){e==="user"?t.textContent=n:t.innerHTML=cr(n)}function lr(t,e){let n=document.createElement("button");return n.className="card",n.type="button",n.dataset.sku=t.sku,n.innerHTML=`
    ${t.image?`<img src="${it(t.image)}" alt="${it(t.title)}" />`:'<div class="card-img-fallback"></div>'}
    <div class="title">${it(t.title)}</div>
    <div class="price">${it(t.priceFormatted)}</div>
  `,n.addEventListener("click",()=>e({sku:t.sku,variantId:t.variantId})),n}function ur(t,e){if(t.kind==="text"){let o=document.createElement("div");return o.className=`bubble ${t.role}`,yn(o,t.role,t.text),o}if(t.kind==="cards"){let o=document.createElement("div");o.className="cards-row";for(let r of t.items)o.appendChild(lr(r,e));return o}if(t.kind==="receipt"){let o=document.createElement("div");o.className=`receipt ${t.ok?"ok":"warn"}`,o.setAttribute("role","status");let r=document.createElement("span");r.className="receipt-icon",r.setAttribute("aria-hidden","true"),r.textContent=t.ok?"\u2713":"!";let i=document.createElement("span");return i.textContent=t.text,o.append(r,i),o}if(t.kind==="cap_warning"){let o=document.createElement("div");return o.className="bubble system",o.textContent=g.capWarning,o}let n=document.createElement("div");return n.className="bubble system",n.textContent=g.closed[t.reason],n}var hn=new WeakMap;function St(t,e,n){let o=hn.get(t)??[],r=new Map(o.map(l=>[l.id,l])),i=new Set(e.map(l=>l.id));for(let l of o)i.has(l.id)||l.el.remove();let s=[],a=!1;for(let l=0;l<e.length;l++){let u=e[l];if(!u)continue;let d=r.get(u.id);if(d)u.kind==="text"&&d.text!==u.text&&(yn(d.el,u.role,u.text),d.text=u.text,a=!0),s.push(d);else{let p=ur(u,n);t.appendChild(p),s.push({id:u.id,el:p,text:u.kind==="text"?u.text:void 0}),a=!0}}hn.set(t,s),a&&(t.scrollTop=t.scrollHeight)}function dr(t){switch(t){case"mic_policy_blocked":return"Voice is disabled on this page \u2014 text chat still works.";case"mic_denied":return"Microphone blocked. Allow mic access in your browser, then tap Call.";case"mic_unavailable":return"No microphone found \u2014 check your audio device, then tap Call.";case"connect_failed":return"Couldn't reach voice. Tap Call to retry.";default:return"Tap Call to try again."}}function bn(t){return t.muted?"you're muted":t.voiceState==="connecting"?`connecting to ${t.personaName}\u2026`:t.voiceState==="speaking"?`${t.personaName} is speaking\u2026`:t.voiceState==="listening"?`${t.personaName} is listening\u2026`:`${t.personaName} is ready`}function vn(t){return t.voiceState==="idle"&&t.voiceError?"error":t.transcript.length===0?"prompt":"transcript"}function pr(t){return`${vn(t)}|${t.checkoutUrl??""}|${t.personaName}|${t.voiceError?.code??""}`}function wn(t,e){let n=pr(e),o=vn(e);if(t.dataset.chromeKey!==n){let s=o==="error"?`
          <div class="call-error">
            <p class="call-error-title">${g.callFailedTitle}</p>
            <p class="call-error-hint">${dr(e.voiceError?.code??"unknown")}</p>
          </div>`:"",a=o==="prompt"?`
          <div class="call-prompt">
            <h2 class="call-prompt-heading">${g.callHelpHeading}</h2>
            <ul class="call-prompt-bullets">
              ${g.callBullets.map(u=>`<li>${u}</li>`).join("")}
            </ul>
          </div>`:"",l=o!=="transcript";t.innerHTML=`
      <div class="panel call-panel">
        <button class="panel-close" data-action="close" aria-label="${g.closeAria}">${un}</button>
        ${s}
        ${a}
        <div class="status-line ${o==="error"?"hidden":""}" data-region="status">${bn(e)}</div>
        <div class="transcript ${l?"hidden":""}" data-region="transcript" aria-live="polite"></div>
        ${e.checkoutUrl?`<a class="checkout-cta" data-action="checkout" href="${e.checkoutUrl}" target="_blank" rel="noopener">${g.payNow}</a>`:""}
        <div class="panel-footer">${g.poweredBy}</div>
      </div>
    `,t.querySelector('[data-action="close"]')?.addEventListener("click",e.onClose),t.querySelector('[data-action="checkout"]')?.addEventListener("click",e.onCheckout),t.dataset.chromeKey=n}let r=t.querySelector('[data-region="status"]');if(r instanceof HTMLElement){let s=bn(e);r.textContent!==s&&(r.textContent=s)}let i=t.querySelector('[data-region="transcript"]');i instanceof HTMLElement&&o==="transcript"&&St(i,e.transcript,e.onCardTap)}function mr(t){return`${t.transcript.length===0?"1":"0"}|${t.checkoutUrl??""}|${t.closed?"1":"0"}|${t.personaName}|${t.personaInitial}|${t.personaAvatarUrl}`}function xn(t,e){let n=mr(e);if(t.dataset.chromeKey!==n){let r=e.transcript.length===0,i=g.panelBullets.map((u,d)=>`<button type="button" class="welcome-bullet" data-prompt="${d}" ${e.closed?"disabled":""}>${u}<span class="welcome-bullet-arrow" aria-hidden="true">\u2192</span></button>`).join(""),s=r?`
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
        <button class="panel-close" data-action="close" aria-label="${g.closeAria}">${ln}</button>
        ${s}
        <div class="transcript ${r?"transcript-empty":""}" data-region="transcript" aria-live="polite"></div>
        ${e.checkoutUrl?`<a class="checkout-cta" href="${e.checkoutUrl}" target="_blank" rel="noopener">${g.payNow}</a>`:""}
        <form class="input-row">
          <input type="text" placeholder="${g.chatPlaceholder}" ${e.closed?"disabled":""} />
          <button class="send" type="submit" aria-label="Send" ${e.closed?"disabled":""}>${gn}</button>
        </form>
        <div class="panel-footer">${g.poweredBy}</div>
      </div>
    `,t.querySelector('[data-action="close"]')?.addEventListener("click",e.onClose),t.querySelectorAll(".welcome-bullet").forEach(u=>{u.addEventListener("click",()=>{if(e.closed)return;let d=Number(u.dataset.prompt),p=g.panelPrompts[d]??g.panelBullets[d];p&&e.onSend(p)})});let a=t.querySelector("form"),l=t.querySelector("input");a instanceof HTMLFormElement&&l instanceof HTMLInputElement&&a.addEventListener("submit",u=>{u.preventDefault();let d=l.value.trim();d&&(l.value="",e.onSend(d))}),t.dataset.chromeKey=n}let o=t.querySelector('[data-region="transcript"]');o instanceof HTMLElement&&St(o,e.transcript,e.onCardTap)}function fr(t,e,n,o,r,i,s=8){let a=Math.max(s,r-n-s),l=Math.max(s,i-o-s);return{x:Math.min(Math.max(s,t),a),y:Math.min(Math.max(s,e),l)}}function gr(t,e,n,o=8){let r=(t.left+t.right)/2,i=(t.top+t.bottom)/2,s=r>e/2?"right":"left",a=i>n/2?"bottom":"top",l=Math.max(o,s==="right"?e-t.right:t.left),u=Math.max(o,a==="bottom"?n-t.bottom:t.top);return{hSide:s,hVal:l,vSide:a,vVal:u}}function Yt(t,e){t.classList.add("dragged"),t.style.transform="none",e.hSide==="right"?(t.style.right=`${e.hVal}px`,t.style.left="auto"):(t.style.left=`${e.hVal}px`,t.style.right="auto"),e.vSide==="bottom"?(t.style.bottom=`${e.vVal}px`,t.style.top="auto"):(t.style.top=`${e.vVal}px`,t.style.bottom="auto"),t.classList.toggle("dock-top",e.vSide==="top"),t.classList.toggle("dock-bottom",e.vSide==="bottom"),t.classList.toggle("dock-left",e.hSide==="left"),t.classList.toggle("dock-right",e.hSide==="right")}function kn(t){try{let e=window.localStorage.getItem(t);if(!e)return null;let n=JSON.parse(e);if((n.hSide==="left"||n.hSide==="right")&&(n.vSide==="top"||n.vSide==="bottom")&&typeof n.hVal=="number"&&typeof n.vVal=="number")return n}catch{}return null}function hr(t,e){try{window.localStorage.setItem(t,JSON.stringify(e))}catch{}}function _n(t,e){let n=e.offsetWidth||0,o=e.offsetHeight||0,r=window.innerWidth,i=window.innerHeight;return{...t,hVal:Math.min(Math.max(8,t.hVal),Math.max(8,r-n-8)),vVal:Math.min(Math.max(8,t.vVal),Math.max(8,i-o-8))}}function Sn(t){let{root:e,surface:n,storageKey:o}=t,r=()=>n.querySelector(".tray")??n,i=kn(o);i&&Yt(e,_n(i,r()));let s=0,a=0,l=0,u=0,d=!1,p=null,y=h=>{if(p!==null&&h.pointerId!==p)return;let x=h.clientX-s,C=h.clientY-a;if(!d&&Math.hypot(x,C)<6)return;if(!d)try{p!=null&&n.setPointerCapture(p)}catch{}d=!0,e.classList.add("dragging","dragged"),e.style.transform="none";let T=e.offsetWidth,m=e.offsetHeight,{x:c,y:f}=fr(l+x,u+C,T,m,window.innerWidth,window.innerHeight);e.style.left=`${c}px`,e.style.top=`${f}px`,e.style.right="auto",e.style.bottom="auto",e.classList.remove("dock-top","dock-bottom","dock-left","dock-right"),h.preventDefault()},w=h=>{if(window.removeEventListener("pointermove",y),window.removeEventListener("pointerup",w),p=null,!d)return;d=!1,e.classList.remove("dragging");let x=m=>{m.stopPropagation(),m.preventDefault()};n.addEventListener("click",x,{capture:!0,once:!0}),window.setTimeout(()=>n.removeEventListener("click",x,{capture:!0}),350);let C=r().getBoundingClientRect(),T=gr({top:C.top,left:C.left,right:C.right,bottom:C.bottom},window.innerWidth,window.innerHeight);Yt(e,T),hr(o,T),h.preventDefault()},S=h=>{if(h.button!=null&&h.button!==0)return;let x=r().getBoundingClientRect();s=h.clientX,a=h.clientY,l=x.left,u=x.top,d=!1,p=h.pointerId??null,window.addEventListener("pointermove",y),window.addEventListener("pointerup",w)},E=()=>{let h=kn(o);h&&Yt(e,_n(h,r()))};return n.addEventListener("pointerdown",S),window.addEventListener("resize",E),()=>{n.removeEventListener("pointerdown",S),window.removeEventListener("pointermove",y),window.removeEventListener("pointerup",w),window.removeEventListener("resize",E)}}function yr(t){return t.voiceState==="connecting"?"connecting":t.voiceState!=="idle"?"connected":t.voiceError?"error":t.invited?"incoming":"resting"}function br(t,e){return[e,t.mode,t.callable?"1":"0",t.voiceState,t.connection,t.invited?"1":"0",t.personaName,t.personaInitial,t.personaAvatarUrl,t.launcherLabel??"",t.launcherCaption??""].join("|")}function vr(t,e){let n=t.voiceState==="muted",o=t.voiceState==="speaking",r=t.connection==="disconnected",i=(w,S)=>`
    <button class="tray-call" data-action="call" aria-label="${S}">
      ${dn}<span class="tray-call-label">${w}</span>
    </button>`,s=`
    <button class="tray-btn ghost" data-action="chat" aria-label="${g.openAria}">${Gt}</button>`,a=`
    <button class="tray-btn tray-chat" data-action="chat" aria-label="${g.chatAria}" title="${g.chatAria}">${Gt}</button>`,l=w=>`
    <button class="tray-btn ${n?"muted":""}" data-action="mic" ${w?"disabled":""}
      aria-pressed="${n}" aria-label="${n?g.micUnmute:g.micMute}">${n?fn:mn}</button>`,u=`
    <button class="tray-btn end" data-action="end" aria-label="${g.endCallAria}">${pn}</button>`,d='<span class="tray-spinner" aria-hidden="true"></span>',p=`
    <div class="tray-waveform active ${o?"speaking":""}" aria-hidden="true">
      ${Array.from({length:14}).map(()=>'<span class="bar"></span>').join("")}
    </div>`,y=r?"offline":"online";switch(e){case"incoming":return{caption:g.captionIncoming,captionClass:"incoming",presenceClass:y,nameText:t.personaName,controls:`${i(g.acceptCta,g.acceptAria)}${a}`};case"connecting":return{caption:g.captionThinking,captionClass:"thinking",presenceClass:"online",nameText:t.personaName,controls:`${d}${l(!0)}${u}`};case"connected":return{caption:g.captionConnected,captionClass:"connected",presenceClass:"online",nameText:t.personaName,controls:`${p}${l(!1)}${u}`};case"error":return{caption:g.captionRetry,captionClass:"retry",presenceClass:"offline",nameText:t.personaName,controls:`${i(g.callCta,g.retryAria)}${u}`};default:{let w=t.launcherLabel?.trim(),S=t.launcherCaption?.trim();return{caption:r?g.captionOffline:S||g.captionResting,captionClass:r?"retry":"resting",presenceClass:y,nameText:w||`${g.talkToPrefix} ${t.personaName}`,controls:t.callable?`${i(g.callCta,g.callAria)}${a}`:s}}}}function Cn(t,e){let n=yr(e),o=br(e,n);if(t.dataset.trayKey===o)return;let r=vr(e,n),i=e.mode==="chat"||e.mode==="call"||e.mode==="expanded";t.innerHTML=`
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
  `,t.querySelector('[data-action="toggle"]')?.addEventListener("click",()=>{i?e.onClose():e.onChat()}),t.querySelector('[data-action="call"]')?.addEventListener("click",e.onCall),t.querySelector('[data-action="chat"]')?.addEventListener("click",e.onChat),t.querySelector('[data-action="mic"]')?.addEventListener("click",()=>{e.onMute(e.voiceState!=="muted")}),t.querySelector('[data-action="end"]')?.addEventListener("click",e.onEnd),t.dataset.trayKey=o}var Tn="shoppingmate-widget",En="SM-XPK2EN",An="SM-2SCCLZ",Mn=new Set(["bottom-right","bottom-left","bottom-center","center","center-left","center-right","top-right","top-left"]),Ln=new Set(["small","medium","large"]),wr=6e3,xr=12e3,kr=["cart-sidebar-show","cart-open","cart--open","cart-drawer-open","cart-drawer--active","cart-drawer-is-open","js-drawer-open","drawer-open","drawer--open","js-drawer-open-right","cart-active","is-cart-open","cart-is-open","cart-visible","show-cart","cart-show","mini-cart-active","minicart-active","mini-cart--active","ajaxcart-open","header-cart-open"],_r=["menu-open","menu--open","menu-is-open","is-menu-open","menu-drawer-open","menu-drawer--active","mobile-menu-open","mobile-menu--open","mobile-nav-open","nav-open","nav--open","nav-is-open","is-nav-open","js-nav-open","js-menu-open","navigation-open","header-menu-open","offcanvas-open","off-canvas-open","offcanvas-nav-open","offcanvas-menu-open"];function Sr(t,e){if(e==="/cart"||e.startsWith("/cart/")||e.startsWith("/cart?"))return!0;let n=t.toLowerCase();return kr.some(o=>n.includes(o))||_r.some(o=>n.includes(o))}function Cr(){try{let t=window.location.pathname||"",e=`${document.documentElement.className} ${document.body?document.body.className:""}`;return Sr(e,t)}catch{return!1}}function In(){return"live-kit"==="web-speech"?"web-speech":"live-kit"}var Jt=class extends HTMLElement{constructor(){super(...arguments);v(this,"rootEl",null);v(this,"pillHost",null);v(this,"panelHost",null);v(this,"store",Kt({sessionId:"pending"}));v(this,"socket",null);v(this,"voiceMode",K(null,pt()));v(this,"voice",null);v(this,"persona",nn());v(this,"launcherLabel",null);v(this,"launcherCaption",null);v(this,"apiBase","");v(this,"merchantId","");v(this,"domain",window.location.host);v(this,"stopActivityTracker",null);v(this,"inviteTimer",null);v(this,"inviteDismissTimer",null);v(this,"collapseTimer",null);v(this,"stopCollapse",null);v(this,"cartObserver",null);v(this,"scrollResizeRaf",!1);v(this,"overlayRecheck",null);v(this,"stopDrag",null);v(this,"ambience",Et(!1));v(this,"onHostGesture",()=>{this.onCartVisibilityChange(),window.setTimeout(this.onCartVisibilityChange,200),window.setTimeout(this.onCartVisibilityChange,550)});v(this,"onScrollResize",()=>{this.scrollResizeRaf||(this.scrollResizeRaf=!0,requestAnimationFrame(()=>{this.scrollResizeRaf=!1,this.onCartVisibilityChange()}))});v(this,"onCartVisibilityChange",()=>{if(!this.rootEl)return;let n=this.store.get(),o=n.mode==="call"||n.voiceState!=="idle",r=n.mode==="chat"||n.mode==="expanded",i=(Cr()||!r&&this.launcherCovered())&&!o;this.rootEl.classList.toggle("host-overlay-hidden",i)})}connectedCallback(){if(this.shadowRoot)return;let n=this.getAttribute("data-id"),o=this.getAttribute("data-api")??this.apiBase;if(!n){console.warn("[shoppingmate] data-id missing on widget element");return}this.merchantId=n,this.apiBase=o,this.ambience=Et(this.getAttribute("data-ambience")!=="off");let r=this.attachShadow({mode:"open"}),i=document.createElement("style");i.textContent=an,r.appendChild(i);let s=document.createElement("div"),a=this.merchantId===An?"center-left":"bottom-right",l=(this.getAttribute("data-position")??a).toLowerCase(),u=Mn.has(l)?`pos-${l}`:"pos-bottom-right",d=(this.getAttribute("data-size")??"medium").toLowerCase(),p=Ln.has(d)&&d!=="medium"?` size-${d}`:"";s.className=`root ${u}${p}`,r.appendChild(s),this.rootEl=s,this.panelHost=document.createElement("div"),this.pillHost=document.createElement("div"),s.appendChild(this.panelHost),s.appendChild(this.pillHost),this.store.subscribe(()=>this.render()),this.render(),this.stopDrag=Sn({root:s,surface:this.pillHost,storageKey:`sm-widget-pos:${this.merchantId}`}),this.stopCollapse=this.setupAutoCollapse(s,this.pillHost),this.setupCartVisibility(s),In()==="live-kit"&&ce(),this.start()}applyServerPosition(n){let o=this.rootEl;if(!o||o.classList.contains("dragged"))return;let r=n.toLowerCase();if(Mn.has(r)){for(let i of Array.from(o.classList))i.startsWith("pos-")&&o.classList.remove(i);o.classList.add(`pos-${r}`)}}applyAccent(n){let o=this.rootEl;if(!o)return;let r=n.trim();!/^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(r)&&!/^rgba?\([\d.,\s%]+\)$/i.test(r)||o.style.setProperty("--sm-accent",r)}applyServerSize(n){let o=this.rootEl;if(!o)return;let r=n.toLowerCase();Ln.has(r)&&(o.classList.remove("size-small","size-large"),r!=="medium"&&o.classList.add(`size-${r}`))}disconnectedCallback(){this.socket?.close(),this.voiceMode.stop(),this.ambience.stop(),this.stopActivityTracker?.(),this.inviteTimer&&clearTimeout(this.inviteTimer),this.inviteDismissTimer&&clearTimeout(this.inviteDismissTimer),this.collapseTimer&&clearTimeout(this.collapseTimer),this.stopCollapse?.(),this.cartObserver?.disconnect(),window.removeEventListener("popstate",this.onCartVisibilityChange),document.removeEventListener("click",this.onHostGesture,!0),document.removeEventListener("keyup",this.onHostGesture,!0),window.removeEventListener("scroll",this.onScrollResize),window.removeEventListener("resize",this.onScrollResize),this.overlayRecheck&&window.clearInterval(this.overlayRecheck),this.stopDrag?.()}setupCartVisibility(n){this.onCartVisibilityChange(),this.cartObserver=new MutationObserver(this.onCartVisibilityChange),this.cartObserver.observe(document.documentElement,{attributes:!0,attributeFilter:["class"]}),document.body&&this.cartObserver.observe(document.body,{attributes:!0,attributeFilter:["class"]}),window.addEventListener("popstate",this.onCartVisibilityChange),document.addEventListener("click",this.onHostGesture,!0),document.addEventListener("keyup",this.onHostGesture,!0),window.addEventListener("scroll",this.onScrollResize,{passive:!0}),window.addEventListener("resize",this.onScrollResize),this.overlayRecheck=window.setInterval(()=>{this.rootEl?.classList.contains("host-overlay-hidden")&&this.onCartVisibilityChange()},1500)}launcherCovered(){let n=this.rootEl;if(!n||typeof document.elementsFromPoint!="function")return!1;let o=n.getBoundingClientRect();if(!o.width||!o.height)return!1;let r=o.left+o.width/2,i=o.top+o.height/2;for(let s of document.elementsFromPoint(r,i)){if(s===this||this.contains(s)||s.contains(this)||s.tagName==="SHOPPINGMATE-WIDGET")continue;let a=s;for(;a&&a!==document.body&&a!==document.documentElement;){let l=getComputedStyle(a);if(l.position==="fixed"&&l.pointerEvents!=="none"){let u=a.getBoundingClientRect(),d=u.left<=r&&u.right>=r&&u.top<=i&&u.bottom>=i,p=u.width>=window.innerWidth*.4||u.height>=window.innerHeight*.4,y=l.visibility!=="hidden"&&l.display!=="none"&&Number(l.opacity)>.01;if(d&&p&&y)return!0}a=a.parentElement}}return!1}setupAutoCollapse(n,o){let r=()=>{this.collapseTimer&&clearTimeout(this.collapseTimer),this.collapseTimer=setTimeout(()=>n.classList.add("collapsed"),wr)},i=()=>{n.classList.remove("collapsed"),r()};return o.addEventListener("pointerenter",i),o.addEventListener("pointerdown",i),o.addEventListener("focusin",i),o.addEventListener("pointerleave",r),r(),()=>{o.removeEventListener("pointerenter",i),o.removeEventListener("pointerdown",i),o.removeEventListener("focusin",i),o.removeEventListener("pointerleave",r)}}async start(){let n=await qe({apiBase:this.apiBase,merchantId:this.merchantId,domain:this.domain});if(n.kind==="err"){console.warn("[shoppingmate] bootstrap failed:",n.reason);return}this.store=Kt({sessionId:n.sessionId}),this.store.subscribe(()=>this.render()),Re({apiBase:this.apiBase,merchantId:this.merchantId,sessionId:n.sessionId}),n.insights?.enabled&&Ze({apiBase:this.apiBase,merchantId:this.merchantId,sessionId:n.sessionId,visitorId:n.visitorId,config:n.insights}),this.voice=n.voice,this.persona=on(n.personaId??n.voice?.personaId??null),n.widgetPosition&&this.applyServerPosition(n.widgetPosition),n.widgetSize&&this.applyServerSize(n.widgetSize),n.widgetAccent&&this.applyAccent(n.widgetAccent),this.launcherLabel=n.widgetLabel?.trim()||null,this.launcherCaption=n.widgetGreeting?.trim()||null,this.render();let o=In(),r=X();if(o==="live-kit"&&this.voice){let i=ft({stack:"live-kit",livekit:{sessionId:n.sessionId,wsUrl:this.voice.wsUrl,token:this.voice.token,roomName:this.voice.roomName,onTranscriptEvent:s=>this.handleLiveKitData(s)}});i&&(this.voiceMode=i,this.armVoiceWarm())}else{let i=ft({stack:"web-speech"});i&&(this.voiceMode=i),r?.onFinal(s=>{this.store.dispatch({type:"user_input",text:s,mode:"voice"}),this.socket?.send($({type:"user_text",sessionId:n.sessionId,text:s,mode:"voice",visitorId:ot()}))})}this.voiceMode.onStateChange(i=>this.store.dispatch({type:"set_voice_state",state:i})),this.voiceMode.onError?.(i=>{console.warn("[shoppingmate] voice error",i),this.store.dispatch({type:"set_voice_error",error:i})}),this.socket=cn(n.wsUrl,{sessionId:n.sessionId,onEvent:i=>{let s=At(i);s&&this.handleAgentEvent(s)},onStatus:i=>this.store.dispatch({type:"set_connection",status:i})}),(this.merchantId===En||this.merchantId===An)&&(this.inviteTimer=setTimeout(()=>{this.store.get().voiceState==="idle"&&this.store.get().mode==="pill"&&(this.store.dispatch({type:"set_invited",invited:!0}),this.inviteDismissTimer=setTimeout(()=>{let i=this.store.get();i.invited&&i.voiceState==="idle"&&i.mode==="pill"&&this.store.dispatch({type:"set_invited",invited:!1})},xr))},5e3)),this.stopActivityTracker=Fe({sessionId:n.sessionId,hints:new Map,send:i=>this.publishWidgetMessage(i)})}armVoiceWarm(){let n=this.pillHost;if(!n)return;let o=()=>this.voiceMode.warm?.();for(let i of["pointerenter","touchstart","focusin"])n.addEventListener(i,o,{passive:!0});let r=!1;this.store.subscribe(()=>{let i=this.store.get(),s=i.invited||i.mode==="chat"||i.mode==="expanded";s&&!r&&o(),r=s})}async handleAgentEvent(n,o="ws"){if(n.type==="host_action_request"){let r=await De(n.action),i=Ge(n.action,r);i&&this.store.dispatch({type:"receipt",text:i.text,ok:i.ok}),this.publishWidgetMessage({type:"host_action_result",callId:n.callId,result:r},o);return}if(n.type!=="persona_swap"&&n.type!=="agent_warmed"){if(n.type==="agent_ready"){this.voiceMode.signalAgentReady?.();return}this.store.dispatch({type:"agent_event",event:n}),n.type==="say"&&this.voiceMode.speak(n.text)}}publishWidgetMessage(n,o="ws"){let r=$(n);if(o==="livekit"&&this.voiceMode.publishData){let i=new TextEncoder().encode(r);this.voiceMode.publishData(i);return}this.socket?.send(r)}render(){if(!this.pillHost||!this.panelHost)return;let n=this.store.get();this.onCartVisibilityChange();let o=X()!==null;n.mode==="call"?wn(this.panelHost,{voiceState:n.voiceState,muted:n.voiceState==="muted",transcript:n.transcript,checkoutUrl:n.checkoutUrl,personaName:this.persona.name,voiceError:n.voiceError,onClose:()=>this.store.dispatch({type:"set_mode",mode:"pill"}),onCardTap:r=>this.cardTap(r),onCheckout:()=>{}}):n.mode==="chat"||n.mode==="expanded"?xn(this.panelHost,{transcript:n.transcript,checkoutUrl:n.checkoutUrl,personaName:this.persona.name,personaInitial:this.persona.initial,personaAvatarUrl:this.persona.avatarUrl,onSend:r=>this.userText(r,"text"),onCall:()=>this.openCall(),onClose:()=>this.store.dispatch({type:"set_mode",mode:"pill"}),onCardTap:r=>this.cardTap(r),closed:n.closed}):this.panelHost.innerHTML="",Cn(this.pillHost,{mode:n.mode,callable:o,voiceState:n.voiceState,connection:n.connection,voiceError:n.voiceError,invited:n.invited,personaName:this.persona.name,personaInitial:this.persona.initial,personaAvatarUrl:this.persona.avatarUrl,launcherLabel:this.launcherLabel,launcherCaption:this.launcherCaption,onCall:()=>this.openCall(),onMute:r=>this.voiceMode.setMuted(r),onEnd:()=>{this.voiceMode.stop(),this.ambience.stop(),this.store.dispatch({type:"set_mode",mode:"pill"})},onChat:()=>{n.invited&&this.store.dispatch({type:"set_invited",invited:!1}),this.store.dispatch({type:"set_mode",mode:"chat"})},onClose:()=>this.store.dispatch({type:"set_mode",mode:"pill"})})}openCall(){this.store.get().invited&&(this.merchantId===En&&this.publishWidgetMessage({type:"tour_request"}),this.store.dispatch({type:"set_invited",invited:!1})),this.inviteTimer&&(clearTimeout(this.inviteTimer),this.inviteTimer=null),this.store.dispatch({type:"set_mode",mode:"call"}),this.voiceMode.start(),this.ambience.start()}userText(n,o){Qe(),this.store.dispatch({type:"user_input",text:n,mode:o});let r=this.store.get().sessionId;this.socket?.send($({type:"user_text",sessionId:r,text:n,mode:o,visitorId:ot()}))}handleLiveKitData(n){let o;try{o=new TextDecoder().decode(n)}catch{return}let r=At(o);r&&this.handleAgentEvent(r,"livekit")}cardTap(n){let o=this.store.get().sessionId;this.socket?.send($({type:"card_tap",sessionId:o,action:"cartAdd",sku:n.sku,variantId:n.variantId,qty:1}))}};function Hn(){customElements.get(Tn)||customElements.define(Tn,Jt)}window.__shoppingmateNav__={snapshot:()=>W().text,keys:()=>ct(W().text)};function Tr(){let t=document.currentScript instanceof HTMLScriptElement?document.currentScript:null,e=t?.dataset.id;if(!e){console.warn("[shoppingmate] data-id missing on script tag");return}let o=(t?.dataset.api??"https://api-production-1ea1.up.railway.app").trim(),r=document.querySelector("shoppingmate-widget");r&&(r.getAttribute("data-api")||r.setAttribute("data-api",o),r.getAttribute("data-id")||r.setAttribute("data-id",e)),Hn();let i=()=>{let s=document.querySelector("shoppingmate-widget");if(s){s.getAttribute("data-api")||s.setAttribute("data-api",o),s.getAttribute("data-id")||s.setAttribute("data-id",e);return}let a=document.createElement("shoppingmate-widget");a.setAttribute("data-id",e),a.setAttribute("data-api",o),document.body.appendChild(a)};document.readyState==="loading"?document.addEventListener("DOMContentLoaded",i,{once:!0}):i()}Tr();})();
