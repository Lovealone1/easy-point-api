# ─────────────────────────────────────────────────────────────────────────
# easy-point-api · Production image (multi-stage)
# Runs: node dist/src/main.js  (compiled, no ts-node, no devDependencies)
# ─────────────────────────────────────────────────────────────────────────

ARG NODE_VERSION=22-alpine
ARG PNPM_VERSION=10.11.0

# Every `pnpm install` below passes --config.node-linker=hoisted, producing a
# flat node_modules instead of pnpm's symlinked store. Two reasons: packages
# land at predictable paths that `COPY --from` can address, and copying the tree
# between stages no longer materialises pnpm's links into duplicate files.

# ── deps: install ALL dependencies (needed to build) ───────────────────────
FROM node:${NODE_VERSION} AS deps
RUN apk add --no-cache python3 make g++
ARG PNPM_VERSION
RUN corepack enable && corepack prepare pnpm@${PNPM_VERSION} --activate
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile --ignore-scripts --config.node-linker=hoisted
RUN pnpm rebuild

# ── build: compile TypeScript + generate the Prisma client ─────────────────
FROM node:${NODE_VERSION} AS build
ARG PNPM_VERSION
RUN corepack enable && corepack prepare pnpm@${PNPM_VERSION} --activate
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# `prisma.config.ts` resolves env('DIRECT_URL') when the config loads, but
# `prisma generate` never connects to the database — it only reads the schema.
# A placeholder satisfies the lookup. Scoped to this RUN so it is never baked
# into the image, and the real URL is supplied at runtime.
RUN DIRECT_URL="postgresql://placeholder:placeholder@localhost:5432/placeholder" \
    pnpm exec prisma generate --schema=./prisma/schema.prisma
RUN pnpm build

# ── prod-deps: production-only dependencies, natives rebuilt ───────────────
FROM node:${NODE_VERSION} AS prod-deps
RUN apk add --no-cache python3 make g++
ARG PNPM_VERSION
RUN corepack enable && corepack prepare pnpm@${PNPM_VERSION} --activate
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --prod --frozen-lockfile --ignore-scripts --config.node-linker=hoisted
RUN pnpm rebuild
# Take the client the build stage already generated, instead of generating here
# (that would require the CLI). The hoisted linker makes these paths stable.
# Both are required: @prisma/client/default.js re-exports `.prisma/client`,
# which is where `prisma generate` actually writes the generated code.
COPY --from=build /app/node_modules/@prisma/client ./node_modules/@prisma/client
COPY --from=build /app/node_modules/.prisma ./node_modules/.prisma

# Drop build-only Prisma tooling. `pnpm install --prod` still pulls it because
# the lockfile pins @prisma/client to a variant with the `prisma` peer resolved
# (@prisma/client@7.7.0(prisma@7.7.0(...))), so moving the CLI to
# devDependencies is not enough on its own.
#
# None of these are reachable at runtime: @prisma/client depends only on
# @prisma/client-runtime-utils, and queries go through @prisma/adapter-pg +
# the JS client engine — there is no Rust query engine in this setup.
# studio-core is Prisma Studio; pglite is an embedded Postgres for local dev.
# The trailing entries are peers that only existed to satisfy that tooling
# (autoInstallPeers is on): Prisma Studio declares react/react-dom, and
# @prisma/client declares typescript — none are imported by compiled JS.
RUN rm -rf \
      node_modules/prisma \
      node_modules/@prisma/engines \
      node_modules/@prisma/studio-core \
      node_modules/@prisma/dev \
      node_modules/@electric-sql/pglite \
      node_modules/effect \
      node_modules/.bin/prisma \
      node_modules/typescript \
      node_modules/.bin/tsc \
      node_modules/.bin/tsserver \
      node_modules/prettier \
      node_modules/.bin/prettier \
      node_modules/react \
      node_modules/react-dom

# ── runner: minimal runtime image ───────────────────────────────────────────
FROM node:${NODE_VERSION} AS runner
RUN apk add --no-cache tini
WORKDIR /app
ENV NODE_ENV=production

COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/public ./public
COPY package.json ./
# `prisma/` ships for reference only — the Prisma CLI is NOT in this image.
# Migrations run through the `migrate` compose service (see docs/DEPLOYMENT.md).

# Run as the unprivileged 'node' user baked into the base image (not root).
USER node

EXPOSE 3001

# Node 22 ships a global fetch, so the healthcheck needs no extra binary
# (dropping curl keeps the image smaller and removes an attack surface).
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3001)+'/api/v1/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "dist/src/main.js"]
