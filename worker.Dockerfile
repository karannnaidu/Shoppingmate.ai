FROM node:20-slim AS build
WORKDIR /app
RUN corepack enable

COPY pnpm-lock.yaml pnpm-workspace.yaml package.json tsconfig.base.json ./
COPY packages packages
COPY apps apps
COPY web web

RUN pnpm install --frozen-lockfile
RUN pnpm --filter @shoppingmate/worker... build

FROM node:20-slim
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app /app
WORKDIR /app/apps/worker
# Nav Phase 2: real-browser template scans need Chromium; Phase 6 nightly QA
# also runs WebKit (the Safari engine) for Safari desktop + iPhone coverage.
RUN npx playwright install --with-deps chromium webkit
CMD ["node", "dist/index.js"]
