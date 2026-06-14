# ============================================================
# Stage 1: builder
# Builds shared libs then runs vite build for the SPA.
# VITE_API_BASE_URL is baked into the JS bundle at build time.
# ============================================================
FROM node:20-alpine AS builder

RUN corepack enable && corepack prepare pnpm@10.33.0 --activate

WORKDIR /app

# ── Build-time arg — baked into the bundle ────────────────────────────────────
ARG VITE_API_BASE_URL=http://localhost:3000
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL

# ── Copy workspace manifests ──────────────────────────────────────────────────
COPY pnpm-workspace.yaml ./
COPY package.json pnpm-lock.yaml ./
COPY packages/shared/package.json    packages/shared/
COPY packages/contracts/package.json packages/contracts/
COPY apps/web/package.json           apps/web/

# ── Install all dependencies ──────────────────────────────────────────────────
RUN pnpm install --frozen-lockfile

# ── Copy source ───────────────────────────────────────────────────────────────
COPY packages/shared/    packages/shared/
COPY packages/contracts/ packages/contracts/
COPY apps/web/           apps/web/

# ── Build shared libraries ────────────────────────────────────────────────────
RUN pnpm --filter @mhm/shared --filter @mhm/contracts build

# ── Build the SPA ─────────────────────────────────────────────────────────────
RUN cd apps/web && pnpm exec vite build

# ============================================================
# Stage 2: runner (nginx:alpine)
# Serves the static dist/ with SPA fallback and sensible caching.
# ============================================================
FROM nginx:1.27-alpine AS runner

# Remove default nginx config
RUN rm /etc/nginx/conf.d/default.conf

COPY apps/web/nginx.conf /etc/nginx/conf.d/mhm.conf

# Copy built SPA from builder
COPY --from=builder /app/apps/web/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
