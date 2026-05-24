# Bucket B — Demo-Undeniable Acceptance Runbook

**Date:** 2026-05-19
**Tag at completion:** `bucket-b-demo-undeniable-complete`
**Prereq:** `SHOPPINGMATE_DEMO_TOUR_ENABLED=true` set in Railway env for `voice-agent` service; widget v1.x deployed; DNS for `shoppingmate.ai` live.

## Setup
1. Open `https://shoppingmate.ai` in a fresh incognito window.
2. Open DevTools → Network tab → filter on "ws" to confirm LiveKit connection.
3. Open DevTools → Console — no errors expected.

## Smoke

| # | Action | Expected |
|---|--------|----------|
| 1 | Load `shoppingmate.ai`, wait 5s without interacting | Soft prompt bubble appears at lower-right: "Want a quick tour?" |
| 2 | Click **Yes, show me** | Call tray opens; Sage starts speaking; Beat 1 runs: scroll to features, three highlight pulses with narration |
| 3 | During Beat 1, say "wait, how does install work?" | Tour pauses; Sage answers the question; asks "want me to continue?" |
| 4 | Say "yes, continue" | Beat 2: brief silence (~1-2s) as voice swaps to Stella; one sentence in Stella's voice; voice swaps back to Sage |
| 5 | Tour transitions to Beat 3 automatically | Navigate to `/pricing`; smooth-scroll to plan grid; Starter card pulses with violet ring; Sage says "Starter is thirty dollars per month for one hundred conversations. Want me to sign you up?" |
| 6 | Inspect transcript log in widget tray | Voiced price matches `formatPlanSpeech('starter')` exactly — no `$30`, no rephrase |
| 7 | Say "sign me up" | `site.click('signup button')` fires; signup modal or `/signup` page opens |
| 8 | Reload page, ignore the soft prompt for 30 seconds | No re-prompt appears in the same session (verify on second reload that the 5s timer fires fresh — session-level dismissal does NOT persist across full reloads, only across the soft-prompt's own lifecycle) |

## Metrics check (24h after enable)

Run:
```sql
SELECT name, SUM(value) FROM metric_events
WHERE name LIKE 'demo.tour.%' OR name LIKE 'pricing.quote.%'
  AND created_at > NOW() - INTERVAL '24 hours'
GROUP BY name ORDER BY 1;
```

Pass criteria:
- `demo.tour_offered → demo.tour_accepted` ratio ≥ 30%
- `pricing.quote.rephrased_blocked` ≤ 5% of `pricing.quote.called`

## On pass
```bash
git tag bucket-b-demo-undeniable-complete
git push --tags
```

## On fail
File issues per failure mode. Common ones:
- AX-tree miss → check that the ARIA labels on the target component still match the agent's intent vocabulary (`packages/agent/src/demo-tour.ts BEAT_PLANS`).
- Price rephrase → confirm `pricing.quote` is being called BEFORE the say turn; check `allowedSpeechTokens` is being persisted across turns in Redis.
- Persona swap stalls > 3s → check Gemini Live latency in Railway logs; may need to keep both voice contexts pre-warmed (Bucket C concern).
