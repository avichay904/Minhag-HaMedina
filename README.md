# מנהג המדינה · Minhag HaMedina

A public-opinion **survey platform** that collects opinions fast, reliably, and privately. Its defining idea is the **Trust Score**: every answer carries a weight (0.4–1.0) reflecting how strongly the respondent is identified and where they came from, and that weight flows into weighted results, gamification ranks, and question targeting.

> Phase A scope — auth + Trust Score, questions/surveys, publication cycles, weighted results, gamification (ranks/badges/weekly challenge), a full multi-source REST API, and bilingual (Hebrew/English, RTL/LTR) clients. Phase B (graphical Admin, IVR, AI images) is intentionally out of scope.

## Monorepo layout

```
packages/
  shared/      @mhm/shared     — enums, types, constants, PURE domain logic (trust, targeting,
                                  selection, challenge, results, ranks, badges, nickname) + tests
  contracts/   @mhm/contracts  — zod request/response schemas + endpoint map (the wire contract)
apps/
  api/         @mhm/api        — NestJS + Prisma backend (the full /api/v1 surface)
  web/         @mhm/web        — React + Vite + Tailwind + i18next PWA (survey UX, profile, results)
  mobile/      @mhm/mobile     — Expo React Native app (core survey flow), reuses shared + contracts
```

The **business rules live once** in `@mhm/shared` and are imported by the API and the clients, so behaviour is identical everywhere and unit-testable without a database.

## Tech stack

- **Language:** TypeScript everywhere · pnpm workspaces
- **API:** NestJS 10 · Prisma 6 · JWT auth · zod validation (nestjs-zod) · Swagger at `/api/docs`
- **DB:** PostgreSQL (canonical, via Docker Compose) — a single Prisma schema also targets **SQLite** for fast tests/local dev via `pnpm db:sqlite`
- **Web:** React 18 · Vite · Tailwind · react-i18next (RTL/LTR) · React Query · Framer Motion
- **Mobile:** Expo / React Native
- **Tests:** Vitest (unit + e2e)

## Getting started

```bash
pnpm install
pnpm build:libs            # build @mhm/shared + @mhm/contracts (other packages depend on them)

# Option A — PostgreSQL (production-faithful)
docker compose up -d postgres
cp .env.example apps/api/.env
pnpm --filter @mhm/api db:deploy   # or db:migrate for a dev migration
pnpm seed
pnpm dev                            # api (http://localhost:3000/api/v1) + web (http://localhost:5173)

# Option B — SQLite (no Docker needed, great for tests)
pnpm --filter @mhm/api db:sqlite    # derive sqlite schema, push it, generate client
DATABASE_URL="file:./dev.db" pnpm --filter @mhm/api start
```

### Identity (dev mode)

`IDENTITY_MODE=dev` (default) accepts a signed **dev token** so the full auth + Trust Score flow works without real OAuth secrets. Send a social login with `token: "dev:<userId>:<email>"` and `provider: "GOOGLE" | "APPLE"`.

## Verify

```bash
pnpm verify     # lint + build + test across the workspace
```

## API

All routes are under `/api/v1`; interactive docs at `/api/docs`. Auth via `Authorization: Bearer <jwt>` and the `X-Source: web|app|external` header. External sources authenticate with an API key and are scoped + Trust-capped by the Source Registry.

## License

Proprietary — all rights reserved.
