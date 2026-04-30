# shoppingmate.ai

AI sales agent (voice + text) for D2C merchants. One `<script>` tag install.

See `docs/superpowers/roadmap.md` for the product roadmap and `docs/superpowers/specs/2026-04-30-shoppingmate-phase1-design.md` for the Phase 1 design.

## Quick start

```bash
pnpm install
docker compose up -d
cp .env.example .env
pnpm db:migrate
pnpm dev
```

API: http://localhost:3000/health
