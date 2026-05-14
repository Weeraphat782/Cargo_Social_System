import {
  GoogleGenAI,
  createPartFromBase64,
  createPartFromText,
  createUserContent,
} from "@google/genai";
import { withAiLog } from "@/lib/ai-logger";
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
/** Fetch a remote image URL and return its bytes + mime type for multimodal use. */
async function fetchRemoteImage(
  url: string
): Promise<{ data: Buffer; mimeType: string } | null> {
  try {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return null;
    const contentType = res.headers.get("content-type") ?? "image/jpeg";
    const mimeType = contentType.split(";")[0].trim();
    const ab = await res.arrayBuffer();
    return { data: Buffer.from(ab), mimeType };
  } catch {
    return null;
  }
}

export async function generateAndUploadImage(options: {
  prompt: string;
  aspect: AspectKey;
  storageKeyPrefix: string;
  /** Only used when set — do not set globally via env; keeps image styles diverse. */
  referenceCategory?: string | null;
  /** Article / post grounding to avoid generic stock look */
  newsContext?: { title: string; snippet?: string } | null;
  /**
   * URL of the campaign moodboard image — passed as a visual reference so
   * generated post images align with the campaign's established color/mood direction.
   */
  moodboardReferenceUrl?: string | null;
  /**
   * R2 URLs of brand reference images from brandAssets.referenceImages.
   * Passed as visual style references — Gemini matches color, aesthetic, and feel.
   * Order with moodboard: brand refs first (up to 4), then moodboard (if room), then category refs; total capped at 5.
   */
  brandReferenceUrls?: string[] | null;
}): Promise<{ imageUrl: string; prompt: string }> {
  const { w, h, label } = ASPECT_PRESETS[options.aspect];
  const refCategory = options.referenceCategory?.trim() || undefined;

  const refSet: { styleNotes: string; images: LoadedReferenceImage[] } =
    refCategory
      ? await loadReferenceSet(refCategory, 3)
      : { styleNotes: "", images: [] };

  const styleNotesBlock =
    refSet.styleNotes.trim().length > 0
      ? `\n\nReference style notes: ${refSet.styleNotes.trim()}`
      : "";

  const nc = options.newsContext;
  const sourceBlock =
    nc?.title?.trim() || nc?.snippet?.trim()
      ? `\n\nSource article (for grounding; reflect this story, not a generic stock look):\nTitle: ${(nc?.title ?? "").trim()}\n${(nc?.snippet ?? "").trim() ? `Details: ${(nc?.snippet ?? "").trim()}\n` : ""}`
      : "";

  const fullPrompt = `${options.prompt}${sourceBlock}${styleNotesBlock}

Style: professional commercial marketing photography, editorial quality, natural composition, no text overlays, no watermarks, no logos.
IMPORTANT — avoid hallucination: Do NOT attempt to render specific named real-world locations, identifiable buildings, or architectural structures that require accurate visual knowledge of a particular place. Represent concepts through carefully composed, emotionally resonant scenes — mood, light, atmosphere, human presence — that feel authentic without claiming to depict any specific real location. Stay true to the industry and campaign context described above; avoid defaulting to unrelated generic stock imagery.
If any palette/style hint above names specific places, buildings, or landmarks (e.g. monasteries, named valleys, named cities), interpret those as mood and atmosphere references only — render a generic, atmospheric scene that fits the feeling, never a literal reproduction of a named real-world location.
Aim for visual variety across different posts; prefer a concept-driven scene with real human presence over an empty or abstract stock look.
Composition: ${label}, approximately ${w}x${h} pixels.`;

  const ai = getGenAI();

  const model =
    process.env.GEMINI_IMAGE_MODEL ?? "gemini-2.0-flash-exp";

  const MAX_TOTAL = 5;

  const brandUrls = (options.brandReferenceUrls ?? [])
    .filter((u) => u && !u.startsWith("data:"))
    .slice(0, 4);
  const brandRefs = (
    await Promise.all(brandUrls.map((u) => fetchRemoteImage(u)))
  ).filter((r): r is { data: Buffer; mimeType: string } => r !== null);

  const moodboardFetched = options.moodboardReferenceUrl
    ? await fetchRemoteImage(options.moodboardReferenceUrl)
    : null;

  let slotsLeft = MAX_TOTAL - brandRefs.length;
  const includeMoodboard = Boolean(moodboardFetched && slotsLeft > 0);
  if (includeMoodboard) slotsLeft -= 1;

  const categoryCap =
    brandRefs.length > 0 ? Math.min(slotsLeft, 1) : Math.min(slotsLeft, 3);
  const categorySlice = refSet.images.slice(0, categoryCap);

  const prioritisedRefs = [
    ...brandRefs.map((r) => ({ ref: r, role: "brand" as const })),
    ...(includeMoodboard && moodboardFetched
      ? [{ ref: moodboardFetched, role: "moodboard" as const }]
      : []),
    ...categorySlice.map((r) => ({ ref: r, role: "category" as const })),
  ];

  const allRefImages = prioritisedRefs.map((p) => p.ref);
  const hasMoodboard = prioritisedRefs.some((p) => p.role === "moodboard");
  const hasBrand = prioritisedRefs.some((p) => p.role === "brand");

  const introLines: string[] = [];
  introLines.push(
    "MULTIMODAL IMAGE ORDER (parts left-to-right): brand reference photographs first (if any), then campaign moodboard (if any), then optional folder style refs."
  );
  if (hasBrand) {
    introLines.push(
      "• The FIRST images are the brand's OFFICIAL reference photographs — they are the PRIMARY visual anchor. Match color palette, lighting, photographic style, lens feel, and subject treatment. Do NOT add on-image text, logos, watermarks, signage, or branded objects not visible in those references unless the text prompt explicitly calls for a minimal abstract scene."
    );
    introLines.push(
      "• Brand references override generic stock tendencies; if palette hints in the text conflict with the photos, follow the photos."
    );
  }
  if (hasMoodboard && hasBrand) {
    introLines.push(
      "• After the brand-reference block: campaign moodboard — extend its mood while staying inside the brand photo look-and-feel."
    );
  } else if (hasMoodboard && !hasBrand) {
    introLines.push(
      "• The first attached image is the campaign moodboard — match its palette and aesthetic closely."
    );
  }
  if (categorySlice.length > 0) {
    introLines.push(
      "• Final attached images are supplementary composition hints only — they must not contradict brand references or moodboard."
    );
  }

  const multimodalIntro =
    allRefImages.length > 0
      ? `${introLines.join("\n")}\nGenerate a single NEW original image that follows the text prompt while staying true to the visual world established by the references above. Do not copy or reproduce any reference image directly.\n\n`
      : "";

  const contents =
    allRefImages.length > 0
      ? createUserContent([
          createPartFromText(`${multimodalIntro}${fullPrompt}`),
          ...allRefImages.map((img) =>
            createPartFromBase64(img.data.toString("base64"), img.mimeType)
          ),
        ])
      : fullPrompt;

  type ImageGenOutcome = {
    imageUrl: string;
    prompt: string;
    usedR2: boolean;
    refusalHint?: string;
  };

  const outcome = await withAiLog(
    "image.generate",
    {
      aspect: options.aspect,
      model,
      brandRefs: brandRefs.length,
      moodboardRef: includeMoodboard,
      categoryRefs: categorySlice.length,
      refCategory: refCategory ?? null,
      storageKeyPrefix: options.storageKeyPrefix,
      prompt: fullPrompt,
      promptImages: allRefImages.length,
    },
    async (): Promise<ImageGenOutcome> => {
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
        return {
          imageUrl: dataUrl,
          prompt: fullPrompt,
          usedR2: false,
          refusalHint:
            textParts?.trim() ||
            (finishReason ? `finishReason=${finishReason}` : undefined),
        };
      }

      const hasR2 =
        Boolean(process.env.R2_ACCESS_KEY_ID) &&
        Boolean(process.env.R2_SECRET_ACCESS_KEY) &&
        Boolean(process.env.R2_ENDPOINT || process.env.R2_ACCOUNT_ID) &&
        Boolean(process.env.R2_PUBLIC_BUCKET_NAME || process.env.R2_BUCKET) &&
        Boolean(process.env.R2_PUBLIC_URL || process.env.R2_PUBLIC_BASE_URL);

      if (!hasR2) {
        const dataUrl = `data:${mimeType};base64,${imageBytes.toString("base64")}`;
        return { imageUrl: dataUrl, prompt: fullPrompt, usedR2: false };
      }

      const ext = mimeType.split("/")[1]?.split(";")[0] || "png";
      const key = `${options.storageKeyPrefix}/${Date.now()}-${options.aspect.toLowerCase()}.${ext}`;
      const url = await uploadPublicImage(key, imageBytes, mimeType);
      return { imageUrl: url, prompt: fullPrompt, usedR2: true };
    },
    (out) => ({
      ok: true,
      extra: {
        imageUrl: out.imageUrl,
        usedR2: out.usedR2,
      },
      responseText: out.refusalHint,
    })
  );

  return { imageUrl: outcome.imageUrl, prompt: outcome.prompt };
}
