# shoppingmate.ai

AI sales agent (voice + text) for D2C merchants. One `<script>` tag install.

- **Roadmap:** [`docs/superpowers/roadmap.md`](docs/superpowers/roadmap.md)
- **Phase 1 spec:** [`docs/superpowers/specs/2026-04-30-shoppingmate-phase1-design.md`](docs/superpowers/specs/2026-04-30-shoppingmate-phase1-design.md)
- **User journey & architecture map:** [`docs/user-journey-flowchart.md`](docs/user-journey-flowchart.md)

## Repo layout

```
apps/
  api/      # Hono HTTP server (provisioning + conversion endpoints)
  worker/   # BullMQ worker (onboarding, smoke tests, [P2] recrawl, KB indexer)
packages/
  db/       # Drizzle schema + client + migrations
  shared/   # env, logger, ID generation
  jobs/     # BullMQ queues + Redis connection
docs/       # roadmap, specs, plans, journey docs
```

## Prerequisites

- Node 20.x (see `.nvmrc`)
- pnpm 10.x (pinned via `packageManager`)
- Docker Desktop (or compatible)

## First-time setup

```bash
pnpm install
docker compose up -d
cp .env.example .env
pnpm db:migrate
```

## Run dev

```bash
pnpm dev
```

API at http://127.0.0.1:3000/health · Worker logs in the same terminal (parallel).

> Note: use `127.0.0.1` rather than `localhost` on Windows — the latter resolves to IPv6 first and Docker only binds IPv4.

## Common commands

| Command | Purpose |
|---|---|
| `pnpm test` | Run all Vitest tests |
| `pnpm lint` | Biome lint check |
| `pnpm lint:fix` | Auto-fix lint issues |
| `pnpm format` | Format with Biome |
| `pnpm typecheck` | TS typecheck across all packages |
| `pnpm db:generate` | Generate a new Drizzle migration from schema changes |
| `pnpm db:migrate` | Apply pending migrations |
| `pnpm db:studio` | Open Drizzle Studio (browser GUI) |
| `pnpm build` | Build all packages and apps |

## License

Proprietary — Calmosis.
