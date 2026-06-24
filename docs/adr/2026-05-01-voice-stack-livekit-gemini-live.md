# ADR-0001: Voice stack — LiveKit Agents (WebRTC) + Gemini 2.5 Flash Live

**Date:** 2026-05-01
**Status:** Accepted
**Owner:** Karan (Calmosis)
**Supersedes:** Voice-stack section of `docs/superpowers/specs/2026-04-30-shoppingmate-phase1-design.md` §8.1–§8.4 and `docs/superpowers/roadmap.md` §3, §4 Phase 1 (the original Whisper STT + ElevenLabs TTS proposal).

---

## 1. Decision

shoppingmate.ai's v0.1 voice stack is:

| Layer | Choice | Why |
|---|---|---|
| Transport | **LiveKit Agents (WebRTC)** | Sub-200ms RTT, browser-native, server SDK handles audio frames, jitter buffer, and reconnection. Removes the second-WebSocket-for-audio-frames pattern from the original spec. |
| Voice model | **Gemini 2.5 Flash Live (native audio in/out)** | Single round trip — STT, intent, TTS in one model. Removes Whisper round-trip + ElevenLabs round-trip. Persona voicing handled via system-prompt voice descriptors + Gemini's native voice library. |
| Tool-use turns | **Anthropic Sonnet 4.6** | Best tool-use accuracy. Voice turns that need cart/checkout actions hand off Gemini's transcription to Sonnet for the tool-call loop, then back to Gemini for spoken reply. |
| Onboarding extraction | **Anthropic Sonnet 4.6 (vision)** | One-time per merchant; quality matters; vision required for selector grounding. |
| Default text-turn routing | **Anthropic Haiku 4.5** | 70% of text turns are simple (greet, recommend, KB lookup). Haiku-default + Sonnet-on-tool-use is a margin invariant — see strategy §5.4. |

This is a **hybrid LLM stack**: Anthropic for text + tool-use + onboarding selector extraction; Gemini for voice native audio. Revisit if Anthropic ships a Live-API equivalent.

## 2. Context

The 2026-04-30 Phase 1 design specified Whisper streaming STT + ElevenLabs TTS, with a separate WebSocket #2 for audio frames. Two problems surfaced during the 2026-05-01 viability + margin-floor pressure-test:

1. **Latency budget.** Whisper-stream → Sonnet → ElevenLabs is three sequential round trips. Median voice-turn latency in pilot dry-runs was 2.1–2.8s. Goal is sub-1.5s for a "feels human" voice agent.
2. **Cost stack-up.** Whisper ($0.006/min) + ElevenLabs ($0.18/1k chars) + Sonnet voice-bound text ≈ $0.018–$0.030 per voice turn. At the §5.4 margin-floor target (worst-case GM ≥ 70% with $0.30 voice surcharge per conv above 20% voice ratio), this stack does not clear the floor at the Pro plan's blended cost cap.

Gemini 2.5 Flash Live's native-audio mode collapses STT + intent + TTS into one model call. LiveKit Agents wraps this into a clean WebRTC server abstraction.

## 3. Consequences

### Positive

- **One audio round trip per turn** instead of three. Median latency target: 800ms–1.2s.
- **Worst-case voice COGS per conv drops** from ~$0.045 (3 min × $0.015) to ~$0.018 (3 min × $0.006). Helps clear the §5.4 margin floor at every plan including Pro.
- **WebRTC > raw WebSocket #2** for audio: jitter buffer, packet loss recovery, browser-native echo cancellation, automatic reconnect. We don't write any of this.
- **Persona is a system-prompt voice descriptor** (e.g. "warm female mid-tone, calm cadence") rather than a fixed ElevenLabs voice ID. 8 personas → 8 prompt files; no voice catalog to maintain.

### Negative / risks

- **Hybrid LLM stack** — two vendors (Anthropic + Google). Mitigation: each vendor owns one job (Anthropic = text/tools/extraction; Gemini = voice). No overlap; either side can fail without taking down the other half.
- **Gemini Live cost is unverified at scale.** Pre-seed-close blocker §1 in `project_shoppingmate_viability.md` — must run a 100-conv pilot on a real merchant and measure $/conv with 95% CI before signing a term sheet.
- **Voice cloning / brand-tuned voice persona ($99/mo upsell) depends on Gemini's voice-clone surface** which is currently more limited than ElevenLabs. Acceptable for v0.1 (8 preset personas only); revisit when the upsell ships.
- **LiveKit ops surface area.** New service to run (LiveKit SFU). Use LiveKit Cloud for v0.1 to avoid running it ourselves; plan to evaluate self-host once we hit ~500 paying merchants.

### Neutral

- Phase 1 implementation is unchanged at the architectural level — the orchestrator still routes voice frames to a "voice gateway." The internals of that gateway swap from `voice-gateway = whisper-proxy + elevenlabs-stream` to `voice-gateway = livekit-agent + gemini-live-session`.
- No code change required for v0.1 plans 1–3 (foundation, provisioning, onboarding crawl) since voice is a Plan 4–5 deliverable. The swap costs zero re-work because no voice code has been merged yet (confirmed 2026-05-01 in `project_shoppingmate_strategy.md`).

## 4. Rollout

- **Now:** this ADR is the source of truth. All other docs (roadmap, Phase 1 spec, user-journey diagrams, v0.2 spec) are patched in this commit to point here for the voice stack and stop repeating Whisper / ElevenLabs.
- **Plan 4 (voice gateway implementation):** writes the LiveKit Agent + Gemini Live session glue.
- **Plan 4-bis (Gemini Live cost pilot):** 100 production conversations on a real merchant, measured $/conv with 95% CI. Gates the seed close (viability blocker §1).
- **Plan 5 (persona voicing):** 8 persona-prompt files with voice descriptors; A/B 2 personas on the demo store.

## 5. Acceptance for this ADR

- [x] Decision recorded with rationale
- [ ] Roadmap.md §3 + §4 Phase 1 reference this ADR; no Whisper / ElevenLabs in roadmap (patched in same commit)
- [ ] Phase 1 spec §8.1–§8.4 reference this ADR; voice details deleted in favor of "see ADR-0001" (patched in same commit)
- [ ] User-journey-flowchart.md §Story 3 + §B1 architecture + §B5 cost notes reference this ADR (patched in same commit)
- [ ] v0.2 spec §3 reused-from-v0.1 voice line points here (patched in same commit)
- [ ] Plan 4-bis pilot ticket open before any Plan 4 PR merges
- [ ] Margin-floor §5.4 acceptance line ("worst-case GM ≥ 70% on every plan including Pro at 100% voice abuse + surcharge") added to every spec touching the voice path

## 6. Open questions tracked elsewhere

- Pilot cost result → measured number replaces the $0.006/min estimate above; lives in `project_shoppingmate_viability.md` and strategy §5.
- Self-host vs. LiveKit Cloud crossover point → revisit at month 6 with measured per-conv ops cost.
- Gemini voice-clone surface for the $99/mo brand-tuned persona upsell → revisit when that upsell ships (post-v0.2).

## 7. References

- Strategy: `docs/strategy/2026-05-01-shoppingmate-strategy.md` §5 (unit economics) + §5.4 (margin floor)
- Viability: `docs/strategy/2026-05-01-shoppingmate-viability-analysis.md` §3 (unit economics)
- Phase 1 spec: `docs/superpowers/specs/2026-04-30-shoppingmate-phase1-design.md`
- Roadmap: `docs/superpowers/roadmap.md`
- Memory: `~/.claude/projects/<project>/memory/project_shoppingmate_strategy.md` (voice-as-core entry)
