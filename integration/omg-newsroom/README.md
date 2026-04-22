# OMG Newsroom — agent endpoint (copy into OMG Next.js site)

Add this route to your **cargo.omgexp.com** Next.js app so the Social Media Agent can create newsroom posts via official HTTP (Bearer token).

## 1. Environment (OMG site)

- `OMG_AGENT_TOKEN` — long random string; same value as `OMG_AGENT_TOKEN` in the Social Media Agent `.env`.

## 2. Route: `app/api/newsroom/posts/route.ts`

Copy the example from `route.example.ts` in this folder and wire it to your database / MDX / CMS the same way your admin “new post” UI does.

## 3. Social Media Agent

Set:

- `OMG_API_BASE=https://cargo.omgexp.com` (no trailing slash)
- `OMG_AGENT_TOKEN=<same as OMG site>`
