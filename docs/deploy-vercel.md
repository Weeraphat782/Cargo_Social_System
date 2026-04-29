# Vercel production deploy (Hobby + free cron)

This runbook matches `vercel.json` in the repo: scheduled crons (agent, publish, weekly Meta OAuth refresh) and `maxDuration` for long serverless routes.

## 1) Vercel project settings

| Setting | Value | Why |
|--------|--------|-----|
| **Functions region** | **Singapore (sin1)** | Align with Supabase Singapore to cut DB round-trip (~ms vs ~200ms). |
| Vercel Dashboard | **Settings → Functions → Function region** | |

## 2) Cron schedule (UTC)

| Path | Schedule | Bangkok (ICT, UTC+7) |
|------|----------|----------------------|
| `/api/cron/agent` | `0 23 * * *` | ~06:00 next calendar day in ICT |
| `/api/cron/meta-oauth-refresh` | `0 9 * * 0` (Sun 09:00 UTC) | ~16:00 ICT — rotates Meta OAuth tokens before ~60d expiry | the app also accepts manual calls with `CRON_SECRET` (see `lib/cron-auth.ts`).

### Minute-level schedules (`CUSTOM_DATETIMES`)

Campaigns using **Custom date & times** (`CUSTOM_DATETIMES`) store explicit wall-clock slots as `YYYY-MM-DDTHH:mm` in `scheduleConfig.datetimes` (campaign timezone). Runs advance **per slot**, so **`/api/cron/tick`** (see env `CRON_TOPIC_AGENT_ENABLED` below) must run **often enough** for closely spaced slots — e.g. if slots are minutes apart, a daily cron alone is not sufficient; align tick frequency with your shortest gap between slots.

## 3) Environment variables (Production)

Copy from your local `.env` and set **Vercel → Project → Settings → Environment Variables** for **Production** (and Preview if you use it).

### Database

- `DATABASE_URL` — PgBouncer / transaction pooler (e.g. port **6543**).
- `DIRECT_URL` — Direct / session to Postgres (e.g. port **5432**), for migrations and Prisma.

If build fails with P3005 or migration history issues, see `.env.example` and comments for `prisma migrate resolve` / `db:mark-init-applied`.

### Auth (NextAuth v5 / Auth.js)

- **`AUTH_SECRET`** — random, e.g. `openssl rand -base64 32` (or **`NEXTAUTH_SECRET`** legacy alias).
- **`AUTH_URL`** — production origin, e.g. `https://your-app.vercel.app` (or **`NEXTAUTH_URL`**).

### Admin dashboard

- `ADMIN_EMAIL`, `ADMIN_PASSWORD_HASH` (bcrypt) as in `.env.example`.

### Cron security

- `CRON_SECRET` — random string; required for `curl` / external triggers without Vercel’s cron header.
- `CRON_TOPIC_AGENT_ENABLED` — omit or `false` so `/api/cron/tick` only publishes due posts and runs **campaigns**. Set `true` only if you still want the legacy Topic agent (creates posts tied to topics, not campaigns). Default off avoids extra posts from cron.

### AI & news

- `GEMINI_API_KEY`
- `GOOGLE_CSE_API_KEY`, `GOOGLE_CSE_ID` (recommended for news URLs)
- `CONTENT_BUDGET_PER_DAY=3` — cap used when the Topic agent cron is enabled (see above).

### Token encryption (platform credentials in DB)

- `ENCRYPTION_KEY` — 32-byte hex (64 characters); see `.env.example`.

### Cloudflare R2 (public images for Meta / LinkedIn)

Required together for R2 upload (see `lib/imagegen/gemini.ts`); otherwise the app may fall back to base64 (not suitable for production social posting).

- `R2_ENDPOINT` **or** `R2_ACCOUNT_ID`
- `R2_ACCESS_KEY_ID`
- `R2_SECRET_ACCESS_KEY`
- `R2_PUBLIC_BUCKET_NAME` **or** `R2_BUCKET`
- `R2_PUBLIC_URL` **or** `R2_PUBLIC_BASE_URL`

### Meta / LinkedIn

- **Meta OAuth:** `META_APP_ID`, `META_APP_SECRET`, `META_REDIRECT_URI` — redirect URI must match Meta Developer Console (**Facebook Login** → Valid OAuth Redirect URIs) exactly (production `https://…/api/oauth/meta/callback`). Prefer **Connect with Facebook** on **Connections**; cron `/api/cron/meta-oauth-refresh` (weekly on Vercel) rotates tokens before ~60-day expiry when OAuth credentials exist.
- **Facebook Page + Instagram Business:** Alternatively paste Page token, Page ID, and IG user ID under **Connections** (encrypted in DB) — see `README.md` “Meta”.
- **LinkedIn:** `LINKEDIN_CLIENT_ID`, `LINKEDIN_CLIENT_SECRET`, `LINKEDIN_REDIRECT_URI` (production URL) for **Connect with LinkedIn**; access token + person URN can be saved via **Connections** after OAuth.

### Optional integrations

- `OMG_API_BASE`, `OMG_AGENT_TOKEN` if the newsroom integration is enabled.

## 4) First deploy verification

1. **Build** should run `prisma migrate deploy` (see `package.json` `build` script) then `next build`.

2. **Manual cron smoke test** (after deploy, replace host and secret):

   ```bash
   curl -sS -H "Authorization: Bearer $CRON_SECRET" \
     "https://your-app.vercel.app/api/cron/agent"
   ```

   Expect JSON like `{ "ok": true, ... }` (exact shape from your handler). Errors should be explicit (e.g. missing env, DB).

3. **Publish path**:

   ```bash
   curl -sS -H "Authorization: Bearer $CRON_SECRET" \
     "https://your-app.vercel.app/api/cron/publish"
   ```

4. **Meta OAuth refresh** (only needed after connecting Meta via OAuth):

   ```bash
   curl -sS -H "Authorization: Bearer $CRON_SECRET" \
     "https://your-app.vercel.app/api/cron/meta-oauth-refresh"
   ```

   Expect `{ "ok": true }` or `{ "ok": false, "skipped": "…" }`. Force rotation with `?force=true` (Bearer secret required).

5. In the app UI, confirm: campaign **next run** / upcoming posts / **Recent runs** and `/logs` (PublishLog) as applicable.

## 5) Local pre-deploy checks (optional but recommended)

From repo root:

```bash
npx tsc --noEmit
```

With `npm run dev` and a valid DB + `CRON_SECRET` in `.env`:

```bash
# PowerShell: $env:CRON_SECRET = "..." 
curl -sS -H "Authorization: Bearer $env:CRON_SECRET" "http://localhost:3000/api/cron/agent"
curl -sS -H "Authorization: Bearer $env:CRON_SECRET" "http://localhost:3000/api/cron/publish"
curl -sS -H "Authorization: Bearer $env:CRON_SECRET" "http://localhost:3000/api/cron/meta-oauth-refresh"
```

## 6) Rollback

- **Vercel**: Deployments → select previous production deployment → **Promote to Production**; or
- **Git**: Revert the offending commit, push, and let Vercel rebuild.

## 7) Future scaling

Hobby has **2 cron jobs** max. If you need more schedules, upgrade to Pro or add an external poller (e.g. GitHub Actions `curl` on a schedule) — see project planning notes in your internal docs.
