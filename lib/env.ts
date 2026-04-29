import { z } from "zod";

const serverSchema = z.object({
  DATABASE_URL: z.string().min(1).optional(),
  AUTH_SECRET: z.string().min(1).optional(),
  AUTH_URL: z.string().url().optional(),
  NEXTAUTH_SECRET: z.string().min(1).optional(),
  NEXTAUTH_URL: z.string().url().optional(),
  ADMIN_EMAIL: z.string().email().optional(),
  ADMIN_PASSWORD_HASH: z.string().min(1).optional(),
  GEMINI_API_KEY: z.string().optional(),
  GEMINI_TEXT_MODEL: z.string().optional(),
  GOOGLE_CSE_API_KEY: z.string().optional(),
  GOOGLE_CSE_ID: z.string().optional(),
  ENCRYPTION_KEY: z
    .string()
    .length(64, "ENCRYPTION_KEY must be 32 bytes hex (64 chars)")
    .optional(),
  OMG_API_BASE: z.string().url().optional(),
  OMG_AGENT_TOKEN: z.string().optional(),
  R2_ACCOUNT_ID: z.string().optional(),
  R2_ACCESS_KEY_ID: z.string().optional(),
  R2_SECRET_ACCESS_KEY: z.string().optional(),
  R2_BUCKET: z.string().optional(),
  R2_PUBLIC_BASE_URL: z.string().url().optional(),
  META_APP_ID: z.string().optional(),
  META_APP_SECRET: z.string().optional(),
  /** Must match Meta App → Facebook Login → Valid OAuth redirect URIs exactly */
  META_REDIRECT_URI: z.string().url().optional(),
  LINKEDIN_CLIENT_ID: z.string().optional(),
  LINKEDIN_CLIENT_SECRET: z.string().optional(),
  CRON_SECRET: z.string().optional(),
  /**
   * When "true", cron routes run the legacy topic agent (posts linked to Topic only, not Campaign).
   * Defaults off — external cron-org ticks otherwise create extra posts beside scheduled campaigns.
   */
  CRON_TOPIC_AGENT_ENABLED: z
    .string()
    .optional()
    .transform((v) => v === "true"),
  CONTENT_BUDGET_PER_DAY: z.coerce.number().min(1).max(20).default(3),
});

export type ServerEnv = z.infer<typeof serverSchema>;

let cached: ServerEnv | null = null;

export function getServerEnv(): ServerEnv {
  if (cached) return cached;
  const parsed = serverSchema.safeParse(process.env);
  if (!parsed.success) {
    console.warn("Env validation:", parsed.error.flatten().fieldErrors);
    return serverSchema.parse({}); // defaults only
  }
  cached = parsed.data;
  return parsed.data;
}

export function requireEnv<K extends keyof ServerEnv>(
  key: K
): NonNullable<ServerEnv[K]> {
  const v = process.env[key as string];
  if (v === undefined || v === "") {
    throw new Error(`Missing required environment variable: ${String(key)}`);
  }
  return v as NonNullable<ServerEnv[K]>;
}

/** Public app origin for redirects (Auth.js v5 uses AUTH_URL; NEXTAUTH_URL is legacy). */
export function getAppBaseUrl(): string {
  return process.env.AUTH_URL ?? process.env.NEXTAUTH_URL ?? "http://localhost:3000";
}
