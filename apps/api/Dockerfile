# ============================================================
# Stage 1: builder
# Builds shared libs, generates Prisma client, and compiles the NestJS API.
# ============================================================
FROM node:20-alpine AS builder

# Install pnpm via corepack
RUN corepack enable && corepack prepare pnpm@10.33.0 --activate

WORKDIR /app

# ── Copy workspace manifests first (layer cache) ──────────────────────────────
COPY pnpm-workspace.yaml ./
COPY package.json pnpm-lock.yaml ./

# Package manifests for every workspace member the API depends on
COPY packages/shared/package.json   packages/shared/
COPY packages/contracts/package.json packages/contracts/
COPY apps/api/package.json           apps/api/

# ── Install all dependencies (with lockfile; fall back gracefully) ─────────────
RUN pnpm install --frozen-lockfile

# ── Copy source ───────────────────────────────────────────────────────────────
COPY packages/shared/    packages/shared/
COPY packages/contracts/ packages/contracts/
COPY apps/api/           apps/api/

# ── Build shared libraries first ──────────────────────────────────────────────
RUN pnpm --filter @mhm/shared --filter @mhm/contracts build

# ── Generate Prisma client ────────────────────────────────────────────────────
RUN cd apps/api && pnpm exec prisma generate

# ── Build the NestJS API ──────────────────────────────────────────────────────
RUN cd apps/api && pnpm exec nest build

# ============================================================
# Stage 2: runner
# Slim production image — only compiled output + prod node_modules.
# ============================================================
FROM node:20-alpine AS runner

# Install pnpm via corepack (needed to prune to prod deps)
RUN corepack enable && corepack prepare pnpm@10.33.0 --activate

WORKDIR /app

# ── Copy workspace manifests for a clean prod install ─────────────────────────
COPY pnpm-workspace.yaml ./
COPY package.json pnpm-lock.yaml ./
COPY packages/shared/package.json   packages/shared/
COPY packages/contracts/package.json packages/contracts/
COPY apps/api/package.json           apps/api/

# ── Install production dependencies only ──────────────────────────────────────
RUN pnpm install --frozen-lockfile --prod

# ── Copy compiled output from builder ─────────────────────────────────────────
COPY --from=builder /app/apps/api/dist                    apps/api/dist/
COPY --from=builder /app/packages/shared/dist             packages/shared/dist/
COPY --from=builder /app/packages/contracts/dist          packages/contracts/dist/

# ── Copy Prisma schema + migrations (needed for migrate deploy at startup) ────
COPY --from=builder /app/apps/api/prisma                  apps/api/prisma/

# ── Copy generated Prisma client (engine binaries live inside node_modules) ──
# prisma generate writes to node_modules/@prisma/client — already present via
# prod install, but the query-engine binary may differ; regenerate to be safe.
RUN cd apps/api && pnpm exec prisma generate

# ── Non-root user for security ────────────────────────────────────────────────
RUN addgroup -S mhm && adduser -S mhm -G mhm
USER mhm

EXPOSE 3000

# Required env vars:
#   DATABASE_URL      — postgres connection string
#   JWT_SECRET        — secret for signing JWTs
#   ADMIN_API_TOKEN   — bearer token for admin endpoints
#   PORT              — defaults to 3000
# Optional:
#   IDENTITY_MODE     — 'dev' (default) or 'live' (enables real OAuth)
#   GOOGLE_CLIENT_ID  — required when IDENTITY_MODE=live
#   APPLE_CLIENT_ID   — required when IDENTITY_MODE=live
#   FCM_PROJECT_ID / FCM_SERVER_KEY / FCM_SERVICE_ACCOUNT — push notifications

CMD ["sh", "-c", "cd apps/api && pnpm exec prisma migrate deploy && node dist/main.js"]
