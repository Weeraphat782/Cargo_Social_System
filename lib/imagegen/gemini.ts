import {
  GoogleGenAI,
  createPartFromBase64,
  createPartFromText,
  createUserContent,
} from "@google/genai";
import { requireEnv } from "@/lib/env";
import { uploadPublicImage } from "@/lib/storage/r2";
import { withGeminiRetry } from "@/lib/gemini-retry";
import {
  loadReferenceSet,
  type LoadedReferenceImage,
} from "@/lib/imagegen/references";

/** Aspect presets per platform (width x height) */
export const ASPECT_PRESETS = {
  FACEBOOK: { w: 1200, h: 630, label: "wide landscape" },
  INSTAGRAM: { w: 1080, h: 1080, label: "square" },
  LINKEDIN: { w: 1200, h: 627, label: "landscape" },
  OMG: { w: 1200, h: 675, label: "hero banner" },
} as const;

export type AspectKey = keyof typeof ASPECT_PRESETS;

function getGenAI(): GoogleGenAI {
  return new GoogleGenAI({ apiKey: requireEnv("GEMINI_API_KEY") });
}

/**
 * Generate an image with Gemini (image-capable model) and upload to R2.
 * Falls back to returning a placeholder data URL only if generation returns no image (dev).
 */
export async function generateAndUploadImage(options: {
  prompt: string;
  aspect: AspectKey;
  storageKeyPrefix: string;
  /** Optional folder id under public/reference-images; falls back to REFERENCE_DEFAULT_CATEGORY env. */
  referenceCategory?: string | null;
}): Promise<{ imageUrl: string; prompt: string }> {
  const { w, h, label } = ASPECT_PRESETS[options.aspect];
  const refCategory =
    options.referenceCategory?.trim() ||
    process.env.REFERENCE_DEFAULT_CATEGORY?.trim() ||
    undefined;

  const refSet: { styleNotes: string; images: LoadedReferenceImage[] } =
    refCategory
      ? await loadReferenceSet(refCategory, 3)
      : { styleNotes: "", images: [] };

  const styleNotesBlock =
    refSet.styleNotes.trim().length > 0
      ? `\n\nReference style notes: ${refSet.styleNotes.trim()}`
      : "";

  const fullPrompt = `${options.prompt}${styleNotesBlock}

Style: professional logistics / supply chain photography, cinematic lighting, clean modern composition, no text overlays, no watermarks, no logos.
Composition: ${label}, approximately ${w}x${h} pixels.`;

  const ai = getGenAI();

  const model =
    process.env.GEMINI_IMAGE_MODEL ?? "gemini-2.0-flash-exp";

  const multimodalIntro =
    refSet.images.length > 0
      ? "The following images are reference examples for style, color palette, and composition only. Generate a single new image that matches the text prompt; do not copy, collage, or reproduce the reference images.\n\n"
      : "";

  const contents =
    refSet.images.length > 0
      ? createUserContent([
          createPartFromText(`${multimodalIntro}${fullPrompt}`),
          ...refSet.images.map((img) =>
            createPartFromBase64(img.data.toString("base64"), img.mimeType)
          ),
        ])
      : fullPrompt;

  const response = await withGeminiRetry(
    `generateImage:${options.aspect}`,
    () =>
      ai.models.generateContent({
        model,
        contents,
        config: {
          responseModalities: ["TEXT", "IMAGE"],
        },
      })
  );

  let imageBytes: Buffer | null = null;
  let mimeType = "image/png";
  const fromGetter = response.data;
  if (fromGetter) {
    imageBytes = Buffer.from(fromGetter, "base64");
  } else {
    const parts = response.candidates?.[0]?.content?.parts ?? [];
    for (const part of parts) {
      const inline = part.inlineData;
      if (inline?.data) {
        imageBytes = Buffer.from(inline.data, "base64");
        if (inline.mimeType) mimeType = inline.mimeType;
        break;
      }
    }
  }

  if (!imageBytes?.length) {
    // Log why so we can diagnose (refusal, safety block, quota, etc.)
    const finishReason = response.candidates?.[0]?.finishReason;
    const textParts = response.candidates?.[0]?.content?.parts
      ?.map((p) => p.text)
      .filter(Boolean)
      .join(" ");
    console.error(
      `[imagegen] No image bytes returned (model=${model}, aspect=${options.aspect}). finishReason=${finishReason ?? "n/a"}; textParts=${textParts?.slice(0, 300) ?? "n/a"}`
    );
    // Dev fallback: 1x1 transparent PNG as data URL (avoid breaking queue)
    const b64 =
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
    const dataUrl = `data:image/png;base64,${b64}`;
    return { imageUrl: dataUrl, prompt: fullPrompt };
  }

  const hasR2 =
    Boolean(process.env.R2_ACCESS_KEY_ID) &&
    Boolean(process.env.R2_SECRET_ACCESS_KEY) &&
    Boolean(process.env.R2_ENDPOINT || process.env.R2_ACCOUNT_ID) &&
    Boolean(process.env.R2_PUBLIC_BUCKET_NAME || process.env.R2_BUCKET) &&
    Boolean(process.env.R2_PUBLIC_URL || process.env.R2_PUBLIC_BASE_URL);

  if (!hasR2) {
    const dataUrl = `data:${mimeType};base64,${imageBytes.toString("base64")}`;
    return { imageUrl: dataUrl, prompt: fullPrompt };
  }

  const ext = mimeType.split("/")[1]?.split(";")[0] || "png";
  const key = `${options.storageKeyPrefix}/${Date.now()}-${options.aspect.toLowerCase()}.${ext}`;
  const url = await uploadPublicImage(key, imageBytes, mimeType);
  return { imageUrl: url, prompt: fullPrompt };
}
