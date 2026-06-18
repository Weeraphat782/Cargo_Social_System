import {
  DeleteObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { requireEnv } from "@/lib/env";

let client: S3Client | null = null;

function resolveEndpoint(): string {
  const direct = process.env.R2_ENDPOINT?.trim();
  if (direct) return direct.replace(/\/$/, "");
  const accountId = requireEnv("R2_ACCOUNT_ID");
  return `https://${accountId}.r2.cloudflarestorage.com`;
}

function resolveBucket(): string {
  return (
    process.env.R2_PUBLIC_BUCKET_NAME?.trim() || requireEnv("R2_BUCKET")
  );
}

function resolvePublicBase(): string {
  const v =
    process.env.R2_PUBLIC_URL?.trim() || process.env.R2_PUBLIC_BASE_URL?.trim();
  if (!v) {
    throw new Error("R2_PUBLIC_URL (or R2_PUBLIC_BASE_URL) not set");
  }
  return v.replace(/\/$/, "");
}

function getClient(): S3Client {
  if (client) return client;
  const accessKeyId = requireEnv("R2_ACCESS_KEY_ID");
  const secretAccessKey = requireEnv("R2_SECRET_ACCESS_KEY");
  client = new S3Client({
    region: "auto",
    endpoint: resolveEndpoint(),
    credentials: { accessKeyId, secretAccessKey },
  });
  return client;
}

export async function uploadPublicImage(
  key: string,
  body: Buffer,
  contentType: string
): Promise<string> {
  const bucket = resolveBucket();
  const publicBase = resolvePublicBase();

  await getClient().send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: body,
      ContentType: contentType,
    })
  );

  return `${publicBase}/${key}`;
}

/** Alias for uploads where MIME type is not an image (e.g. PDF strategy documents). */
export const uploadPublicFile = uploadPublicImage;

/** Best-effort delete by public URL (must match `uploadPublicFile` base URL prefix). */
export async function deletePublicFileByUrl(publicUrl: string): Promise<void> {
  const publicBase = resolvePublicBase();
  if (!publicUrl.startsWith(`${publicBase}/`)) {
    console.warn("[r2] deletePublicFileByUrl: URL not under public base, skipping");
    return;
  }
  const key = publicUrl.slice(publicBase.length + 1);
  const bucket = resolveBucket();
  await getClient().send(
    new DeleteObjectCommand({
      Bucket: bucket,
      Key: key,
    })
  );
}
