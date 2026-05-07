# Plan 6 Phase C — voice-agent runs as its own process so LiveKit Agent
# crashes don't take down apps/api. Operator owns CI and registry pushing.

FROM node:20-slim AS build
WORKDIR /app
RUN corepack enable

COPY pnpm-lock.yaml pnpm-workspace.yaml package.json tsconfig.base.json ./
COPY packages packages
COPY apps apps
COPY web web

RUN pnpm install --frozen-lockfile
RUN pnpm --filter @shoppingmate/voice-agent... build

FROM node:20-slim
# @livekit/rtc-node bundles a Rust binary that uses rustls/reqwest for the
# /settings/regions HTTPS handshake before opening the WebRTC engine. The
# slim image's cert bundle is sometimes incomplete for this path; install
# ca-certificates explicitly so the regions fetch resolves.
RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates openssl \
  && rm -rf /var/lib/apt/lists/* \
  && update-ca-certificates
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app /app
WORKDIR /app/apps/voice-agent
CMD ["node", "dist/index.js", "start"]
