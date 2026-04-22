import { NextRequest } from "next/server";

export function assertCronSecret(req: NextRequest): void {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization");
  const q = req.nextUrl.searchParams.get("secret");

  if (secret && (auth === `Bearer ${secret}` || q === secret)) return;

  /** Vercel Cron sets this header on scheduled invocations */
  if (process.env.VERCEL && req.headers.get("x-vercel-cron") === "1") return;

  if (!secret) throw new Error("CRON_SECRET not configured (required outside Vercel cron)");
  throw new Error("Unauthorized");
}
