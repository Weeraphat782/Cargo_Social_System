# Social Media Agent

Human-in-the-loop social media manager: **Gemini** drafts multi-platform copy (structured JSON) from **Google Custom Search** news and **Gemini** generates images (optional **Cloudflare R2** upload), you **approve** in the dashboard, then posts go to **Facebook Page**, **Instagram Business**, **LinkedIn** (personal via UGC API), and **OMG Newsroom** (HTTP API on your site).

## Stack

- Next.js 15 (App Router), TypeScript, Tailwind
- Postgres + Prisma
- NextAuth (credentials) for a single admin
- Vercel Cron–ready routes: `/api/cron/agent`, `/api/cron/publish`

## Setup

1. **Clone and install**

   ```bash
   npm install
   ```

2. **Environment**

   Copy `.env.example` to `.env` and fill values.

   - **DATABASE_URL** — Postgres connection string.
   - **AUTH_SECRET** (Auth.js v5; **NEXTAUTH_SECRET** is a legacy alias) — random string (e.g. `openssl rand -base64 32`).
   - **AUTH_URL** — app origin for redirects (e.g. `http://localhost:3000` in dev; must match the port you run `next dev` on).
   - **ADMIN_EMAIL** / **ADMIN_PASSWORD_HASH** — bcrypt hash of your password:

     ```bash
     node -e "console.log(require('bcryptjs').hashSync('YOUR_PASSWORD', 10))"
     ```

   - **ENCRYPTION_KEY** — 64 hex chars (32 bytes):

     ```bash
     node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
     ```

   - **GEMINI_API_KEY** — [Google AI Studio](https://aistudio.google.com/apikey) (used for drafting, topic suggestions, and image generation).
   - **GEMINI_TEXT_MODEL** (optional) — defaults to `gemini-2.5-flash`.

3. **Database**

   ```bash
   npx prisma migrate deploy
   npm run db:seed
   ```

4. **Google Custom Search**

   Create a Programmable Search Engine restricted to “Search the entire web” or news sites you trust. Use the **API key** and **Search engine ID (cx)** in `GOOGLE_CSE_*`.

5. **Meta (Facebook Page + Instagram Business)**

   - Use a **Facebook Page** (not a personal profile) and an **Instagram Business/Creator** account linked to that page.
   - Create a Meta app, add **Facebook Login** / **Instagram** products, request `pages_manage_posts`, `instagram_basic`, `instagram_content_publish`, `pages_read_engagement`.
   - Use a **Page access token** from this flow—not a personal **user** access token. Legacy user permission **`publish_actions` is deprecated**; Graph API may error (#200) if the token was issued for the wrong scopes or account type.
   - Obtain a long-lived **Page** token with those permissions (Meta Business Suite → your Page → **See profiles**, **Business integrations**, or **Graph API Explorer** scoped to the Page).
   - Use **Graph API** to confirm **Page ID** and **Instagram Business Account ID** (`GET /{page-id}?fields=instagram_business_account`).
   - Enter **Page access token**, **Page ID**, and **IG User ID** under **Connections** in the app (stored encrypted).

6. **LinkedIn**

   - Create a LinkedIn Developer app; enable **Sign In with LinkedIn using OpenID Connect** and **Share on LinkedIn**.
   - Set redirect URL to `LINKEDIN_REDIRECT_URI` (e.g. `https://your-domain.com/api/oauth/linkedin/callback`).
   - Use **Connect with LinkedIn** on **Connections**, or paste **access token** + **person URN** manually (`urn:li:person:...`).

7. **OMG Newsroom**

   Copy the example from [`integration/omg-newsroom`](integration/omg-newsroom) into your OMG Next.js repo, implement `persistNewsroomPost`, and set the same `OMG_AGENT_TOKEN` on both sides. Set `OMG_API_BASE` to `https://cargo.omgexp.com` (no trailing slash).

8. **Images**

   - Production: configure **R2** (or any S3-compatible bucket) so image URLs are **public HTTPS** (required by Instagram Graph API).
   - Set `GEMINI_IMAGE_MODEL` if your Google AI project uses a different image-capable model than the default in `.env.example`.

## Run locally

```bash
npm run dev
```

Open `/login`, then **Topics** → **Run agent now**, or call `POST /api/agent/run` with `{ "topicId": "..." }`.

## Cron (Vercel)

- `vercel.json` schedules (UTC; see `docs/deploy-vercel.md` for ICT):
  - Daily **agent** run: `/api/cron/agent` (`0 23 * * *`)
  - Daily **publish** dispatcher: `/api/cron/publish` (`0 0 * * *`)
- Set `CRON_SECRET` for manual/self-hosted calls with `Authorization: Bearer <CRON_SECRET>` or `?secret=`.
- On Vercel, scheduled invocations send `x-vercel-cron: 1` (handled in code).
- **Local dev:** `npm run dev` runs an in-process scheduler (~every 60s) for due `SCHEDULED` posts, and the **Queue** page has **Run scheduler now** (`POST /api/cron/publish/manual`, session auth).

## Project layout

- `app/(dashboard)/` — Queue, Calendar, Topics, Connections, Logs
- `lib/agent/run.ts` — Gemini text (JSON drafts) + Gemini image pipeline
- `lib/publishers/` — Facebook, Instagram, LinkedIn, OMG
- `integration/omg-newsroom/` — Copy-paste API for OMG site

## License

Private / your use.
