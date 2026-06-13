# Minhag HaMedina — Deployment Guide

## Local full-stack with Docker Compose

```bash
# 1. (First time) Copy the example env file and fill in secrets
cp .env.example .env      # create this file once; git-ignored

# 2. Build images and start all services (postgres + api + web)
docker compose up --build

# 3. Services are available at:
#    REST API  → http://localhost:3000/api/v1
#    Web SPA   → http://localhost:8080
#    Postgres  → localhost:5432 (user: mhm / password: mhm / db: minhag_hamedina)
```

What happens automatically on `up`:
- Postgres initialises its data directory on the first run.
- The `api` container waits for Postgres to pass its healthcheck, then runs
  `prisma migrate deploy` before starting `node dist/main.js`.
- The `web` container builds the SPA with `VITE_API_BASE_URL` baked in, then
  serves it via nginx with SPA fallback.

To tear down (keep data):
```bash
docker compose down
```

To tear down and wipe the database volume:
```bash
docker compose down -v
```

---

## One-click deploy to Render

Render blueprint file: `render.yaml` in the project root.

Steps:
1. Push this repository to GitHub / GitLab.
2. In the [Render dashboard](https://dashboard.render.com) choose
   **New → Blueprint** and connect the repo.
3. Render creates a Postgres database and two services (`mhm-api`, `mhm-web`).
4. After creation, open the `mhm-api` service **Environment** tab and set the
   secret variables marked `sync: false` (see table below).
5. Trigger a manual deploy (or push a commit) — Render will build and deploy
   both services.

---

## Required environment variables

| Variable | Service | Required | Notes |
|---|---|---|---|
| `DATABASE_URL` | api | YES | Auto-wired from Render Postgres; set manually for Docker/other providers |
| `JWT_SECRET` | api | YES | Random string ≥ 32 chars; keep secret |
| `ADMIN_API_TOKEN` | api | YES | Bearer token for `/admin/*` endpoints; keep secret |
| `PORT` | api | no | Defaults to `3000` |
| `VITE_API_BASE_URL` | web (build arg) | YES | Full URL of the deployed API, e.g. `https://mhm-api.onrender.com` |

### Optional variables

| Variable | Service | Notes |
|---|---|---|
| `IDENTITY_MODE` | api | `dev` (default, skips OAuth) or `live` (requires Google/Apple IDs) |
| `GOOGLE_CLIENT_ID` | api | Required when `IDENTITY_MODE=live` for Google Sign-In |
| `APPLE_CLIENT_ID` | api | Required when `IDENTITY_MODE=live` for Apple Sign-In |
| `FCM_PROJECT_ID` | api | Firebase Cloud Messaging project ID — enables push notifications |
| `FCM_SERVER_KEY` | api | FCM legacy server key (v1 API) |
| `FCM_SERVICE_ACCOUNT` | api | FCM service-account JSON (string) for Admin SDK |

### Notes on specific features

**`IDENTITY_MODE`**
Set to `live` in production. In `dev` mode the API accepts any token claim
without verifying signatures — useful for local development and e2e tests.

**Google / Apple OAuth (`GOOGLE_CLIENT_ID`, `APPLE_CLIENT_ID`)**
Obtain from Google Cloud Console / Apple Developer Portal. Required only when
`IDENTITY_MODE=live`.

**FCM push notifications**
All three FCM variables are optional. When absent the API falls back to the
`LogPushSender` (console-only). Supply them to enable real push delivery to
the mobile app.

---

## Local `.env` template

Create `.env` at the project root for local Docker Compose overrides:

```dotenv
# Secrets (required)
JWT_SECRET=change-me-in-production-use-a-long-random-string
ADMIN_API_TOKEN=change-me-admin-token

# Web SPA — API URL seen by the browser (must be reachable from the client)
VITE_API_BASE_URL=http://localhost:3000

# Set to 'live' and supply OAuth IDs when testing OAuth locally
IDENTITY_MODE=dev
GOOGLE_CLIENT_ID=
APPLE_CLIENT_ID=

# Optional: FCM push notifications
FCM_PROJECT_ID=
FCM_SERVER_KEY=
FCM_SERVICE_ACCOUNT=
```
