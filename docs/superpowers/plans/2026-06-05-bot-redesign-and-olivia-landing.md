# Bot widget redesign + Olivia-centric landing page

**Date:** 2026-06-05
**Owner:** Claude (frontend-design)
**Trigger:** Karan, "improve the design of the bot … call button starts the call (not mic) …
incoming-call text … resting pill small … requesting-mic state … mic-denied state …
connected state … make the landing page all about the bot with Olivia microinteractions
everywhere (ref: landinghero.ai / their bot 'Solaine')."

Reference design language: **landinghero.ai** — dark rounded pill launcher, avatar in a
pink→purple gradient ring with a presence dot, persona name + a coloured status caption,
context-specific controls, and a small floating panel above the pill. Their bot is
**Solaine**; ours is **Olivia** (the `concierge` persona).

---

## A. Widget redesign (packages/widget)

### The five call states (from Karan's reference screenshots)

| # | State | Pill caption (colour) | Controls visible | Panel |
|---|-------|----------------------|------------------|-------|
| 1 | **Resting** (idle launcher) | `AI ASSISTANT` (muted grey) + name `Talk to {P}` | green **Call** (phone) button only | none |
| 2 | **Incoming call** (proactive invite) | `INCOMING CALL` (magenta, pulsing) | green **Accept** (phone) + chat button | none |
| 3 | **Connecting / requesting mic** | `THINKING` (green) | spinner ring · mic (mute, disabled) · red **End** | none |
| 4 | **Mic denied / call failed** | `THINKING`→idle, caption `TAP TO RETRY` (red) | mic (retry) · red End | small error panel: "Could not start the call. Please try again." + minimise |
| 5 | **Connected** (live) | `CONNECTED` (green) | live waveform · mic (mute) · red **End** | optional "How can I help you?" prompt panel |

### Hard requirements (explicit from Karan)
1. **The Call button starts the call, NOT the mic button.** Today `pill.ts` wires the mic
   tap to `onCall()` when `!inCall` — remove that. Mic = mute/unmute ONLY, and only exists
   once a call is connecting/connected.
2. **Add a dedicated green Call (phone) button** to the resting pill.
3. **"INCOMING CALL"** attention treatment — proactive invite with a green **Accept**.
4. **Resting pill must look small** (ref image 2): avatar + `Talk to {P}` / `AI ASSISTANT`
   + Call button. No mute/end/waveform clutter at rest.
5. Distinct **requesting-mic** (THINKING + spinner) and **mic-denied/failed** (error panel)
   states.
6. **Connected** = waveform + CONNECTED + mic(mute) + red End.

### State model
Introduce a derived `callPhase` in `pill.ts` from existing store fields — no new transport:
```
resting    ← voiceState 'idle'  && !voiceError && !invited
incoming    ← voiceState 'idle'  && invited (set by soft-prompt/attention timer)
connecting  ← voiceState 'connecting'
connected   ← voiceState 'listening' | 'speaking' | 'muted'
error       ← voiceState 'idle'  && voiceError != null
```
- `invited` is a new boolean in the store, dispatched `set_invited` by the existing
  `mountSoftPrompt` path (demo merchant) and/or an attention timer. Accepting clears it
  and calls `openCall()`.
- The WS-connection status (CONNECTED/CONNECTING/OFFLINE) moves OUT of the caption — it
  becomes the small presence dot colour only. The caption now reflects the **call phase**
  so the visitor reads INCOMING CALL / THINKING / CONNECTED like the reference.

### Files touched
- `src/strings.ts` — new captions (`AI ASSISTANT`, `INCOMING CALL`, `THINKING`,
  `CONNECTED`, `TAP TO RETRY`), `callCta: 'Call'`, `acceptCta` aria, error copy.
- `src/state/store.ts` — add `invited: boolean`, action `set_invited`.
- `src/ui/icons.ts` — keep phone/mic/x; add a spinner (CSS-driven) if needed.
- `src/ui/pill.ts` — rewrite around `callPhase`; resting=small Call pill, incoming=Accept,
  connecting=spinner, connected=waveform+mic+end, error=retry. Mic never starts a call.
- `src/ui/call.ts` — the connected panel becomes the "How can I help you?" prompt; error
  copy already present, keep as the failed-call panel.
- `src/styles/shadow.css.ts` — gradient avatar ring, caption colour variants, green Call
  button, magenta INCOMING pulse, spinner keyframes, small-resting sizing.
- `src/widget.ts` — wire `set_invited` from soft-prompt; ensure `openCall` is reachable
  from the Call/Accept buttons (already via `onCall`).
- Tests: `test/widget.test.ts` stays; add pill render assertions if cheap.

### Build / ship
`pnpm -F @shoppingmate/widget build` → copy `dist/v1.js` → `web/public/widget/v1.js`
(mirrors `web` prebuild). Gzip budget 120KB; livekit must stay lazy (build asserts both).

---

## B. Landing page — "all about Olivia" (web)

Reframe the marketing site so the **bot is the product**: Olivia greets, listens, builds
the cart, and checks out — shown through the SAME microinteractions as the real widget,
reused across the page (ref: landinghero.ai is wall-to-wall Solaine microinteractions).

### New shared components — `web/src/components/olivia/`
- `OliviaAvatar.tsx` — avatar in pink→purple gradient ring + presence dot (sizes sm/md/lg).
- `OliviaWaveform.tsx` — animated bars (idle/active/speaking), reduced-motion safe.
- `OliviaPill.tsx` — the live pill cycling resting → incoming → connecting → connected,
  clickable; mirrors the redesigned widget exactly so the page demos the product.
- `OliviaCallStates.tsx` — a small gallery rendering all 5 states side by side (for a
  "this is what your visitors see" section).

### Section rewrite (`(marketing)/page.tsx`)
1. **Hero** — headline about Olivia ("Meet Olivia. She answers, listens, and builds the
   cart — on every page of your store."). Centerpiece = interactive `OliviaPill` that the
   visitor can click to walk resting→incoming→connecting→connected. CTA: Get started / Talk
   to Olivia.
2. **Meet Olivia / What she does** — three-up: Greets · Listens (waveform) · Builds carts,
   each with a live microinteraction.
3. **The call, end to end** — the `OliviaCallStates` gallery (the 5 states) with captions.
4. Keep Platforms / Pricing / FAQ / Privacy / CTA but re-skin headers to Olivia voice.
5. Retire/repurpose the generic fake-browser Hero chat and the persona-picker Demo into
   Olivia-first equivalents (persona switch can stay as "Olivia has moods/voices").

### Microinteraction reuse
Olivia avatar + waveform appear in: nav (tiny presence), how-it-works steps, footer.
Everything reduced-motion aware. Olivia = `concierge` persona; avatar
`/widget/personas/concierge.png`.

### Constraints
- Next.js in this repo is non-standard — consult `node_modules/next/dist/docs/` before new
  patterns (per web/AGENTS.md). Keep `"use client"` where motion/state is used.
- Don't break the embedded live `<shoppingmate-widget>` (SM-XPK2EN) in the marketing layout.
- Marketing vitest (71/71) must stay green.

---

## Sequencing
1. Widget: strings → store → icons → pill → call → css → widget wiring. Build + copy.
2. Verify widget states in the host example page / serve.
3. Landing: olivia/* components → Hero → sections → reuse. `pnpm -F web test`, typecheck.
4. Capture proof (build log, screenshots if possible), update memory, commit on a branch.

## Open decisions taken as defaults (no blocking questions per Karan)
- Resting caption text = `Talk to {Persona}` with `AI ASSISTANT` sub-caption.
- Incoming-call auto-trigger: reuse the 5s soft-prompt timer on the demo merchant; on the
  marketing page the `OliviaPill` cycles for show.
- Keep brand-safe language (no "agent" in customer copy — memory: drop-agent-language).
  Use "Olivia", "she", verbs/outcomes.
