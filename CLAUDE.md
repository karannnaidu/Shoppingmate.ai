# shoppingmate — project instructions

## Changelog on every push (required)
Every push to `main` that changes what brands or shoppers get **must** add an entry to the public changelog in the same commit:
- File: `web/src/content/changelog.ts` (rendered at https://www.shoppingmate.shop/changelog). Add the release at the **top** of `RELEASES`, or extend today's release if one already exists.
- Write for store owners: outcomes, not module names. Tag each line `new`, `improved` or `fixed`. No internal names (LiveKit, Gemini, OpenRouter, case.open…), no fake numbers.
- List the short commit hashes the entry covers in `commits`.
- Before pushing, run `node scripts/changelog-draft.mjs` — it prints `feat`/`fix` commits on `main` that no entry covers yet.
- Internal-only changes (tests, scripts, refactors, docs) don't need an entry.

## Deploys
- Web: `vercel deploy --prod --yes` only from a clean `main` (never a stacked feature branch). Vercel uploads git-tracked files only — commit first.
- API / voice-agent / worker: `railway up --service <name> --detach`, one service at a time (a "FAILED" with no build is an upload timeout — retry).
- Set Vercel env values from a no-newline file via bash redirect; never pipe from PowerShell (adds a BOM + `\r\n`).

## Marketing site (www.shoppingmate.shop)
- Light-only inside the `.mk` scope (`web/src/app/(marketing)/layout.tsx`); one accent `--mk-accent`; sections live in `web/src/components/mk/*`. Spec: `docs/superpowers/specs/2026-10-31-marketing-site-redesign-prd.md`.
- Phones get the same motion as desktop (compact sticky loop, swipe carousels, animated hero) — never just hide an animation on mobile.
- Never call Olivia an "AI agent" in copy; invented UI must be labelled "Example".
