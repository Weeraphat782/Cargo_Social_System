import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { withAiLog } from "@/lib/ai-logger";
import { generateAndUploadImage } from "@/lib/imagegen/gemini";
import { getBrandTemplateOrDefault } from "@/lib/brands/registry";

const PLATFORM_LABELS: Record<string, string> = {
  FACEBOOK: "Facebook",
  INSTAGRAM: "Instagram",
  LINKEDIN: "LinkedIn",
  OMG: "Newsroom / blog hero",
};

const MOOD_EMOTION_CANDIDATES = [
  "calm",
  "confident",
  "premium",
  "authentic",
  "inviting",
  "warm",
  "bold",
  "playful",
  "minimal",
  "luxurious",
  "trustworthy",
  "energetic",
  "serene",
  "professional",
  "innovative",
  "approachable",
  "elegant",
  "grounded",
  "cinematic",
  "reflective",
];

const DEFAULT_MOOD = "calm, confident, premium, authentic, inviting";

function deriveMoodEmotions(
  ...sources: Array<string | null | undefined>
): string {
  const text = sources.filter(Boolean).join(" ").toLowerCase();
  if (!text) return DEFAULT_MOOD;
  const matched = MOOD_EMOTION_CANDIDATES.filter((c) => text.includes(c));
  if (matched.length >= 3) return matched.slice(0, 5).join(", ");
  return DEFAULT_MOOD;
}

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await ctx.params;
  const body = await req.json().catch(() => ({})) as { userPrompt?: string };
  const userPrompt = typeof body.userPrompt === "string" ? body.userPrompt.trim() : "";

  const campaign = await prisma.campaign.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      description: true,
      keywords: true,
      campaignGoal: true,
      contentPillars: true,
      targetPersona: true,
      brandTemplateId: true,
      brandVoice: true,
      platforms: true,
      theme: true,
    },
  });
  if (!campaign) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const template = await getBrandTemplateOrDefault(campaign.brandTemplateId);
  const ba = template.brandAssets;
  const themeBundle = template.themeBundles[campaign.theme];

  // Derive personality/tone from brand assets
  const brandPersonality = [ba?.visualStyle, ba?.typography].filter(Boolean).join(", ") || "Professional, modern, trustworthy";
  const colorStyle = [ba?.primaryColor, ba?.secondaryColor].filter(Boolean).join(" + ") || "Brand-consistent";

  const promptLibraryBlock = ba?.promptLibrary?.length
    ? `\nBrand mood inspiration (use for tone, palette, and conceptual direction only — do NOT render any item literally as a named place or identifiable building):\n${ba.promptLibrary.slice(0, 3).map((p) => `- ${p}`).join("\n")}\n`
    : "";

  const contentPillarsBlock = campaign.contentPillars
    ? `\nContent pillars to express: ${campaign.contentPillars}`
    : "";

  const platformsLine =
    (campaign.platforms ?? [])
      .map((p) => PLATFORM_LABELS[p] ?? p)
      .join(", ") || "social media (Facebook, Instagram, LinkedIn)";

  const moodEmotions = deriveMoodEmotions(
    ba?.visualStyle,
    campaign.brandVoice,
    themeBundle?.tone,
    themeBundle?.visualStyleNotes
  );

  const positioning = campaign.brandVoice?.trim()
    || themeBundle?.tone
    || "a credible, category-aligned presence";

  const userDirectionBlock = userPrompt
    ? `\nCreator's specific direction (PRIMARY brief — adjust all visual choices to satisfy this):\n"${userPrompt}"\n`
    : "";

  const descriptionBlock = campaign.description?.trim()
    ? `\nCampaign concept: ${campaign.description.trim()}`
    : "";

  const themeCharacterBlock = themeBundle
    ? `

[CAMPAIGN CHARACTER]
- Theme: ${themeBundle.label}
- Tone: ${themeBundle.tone}
- Story angle: ${themeBundle.angle}
- Spotlight: ${themeBundle.leadServiceName}
- Theme-specific palette and mood notes: ${themeBundle.visualStyleNotes}`
    : "";

  const themePaletteOverlay = themeBundle?.visualStyleNotes
    ? ` (theme overlay: ${themeBundle.visualStyleNotes})`
    : "";

  const moodboardPrompt = `Create a high-impact marketing campaign moodboard for: ${campaign.name}.

[CAMPAIGN OBJECTIVE]
Drive ${campaign.campaignGoal ?? "brand awareness and engagement"} by positioning the brand as ${positioning}.${descriptionBlock}
${userDirectionBlock}
[TARGET AUDIENCE INSIGHT]
- Profile: ${campaign.targetPersona ?? "Audience aligned with the brand category"}
- Core motivation: derived from the campaign goal and core message below

[CORE MESSAGE]
"${campaign.keywords}"${contentPillarsBlock}${themeCharacterBlock}

[VISUAL DIRECTION]
- Category: ${template.industryContext}
- Style: ${ba?.visualStyle ?? brandPersonality}
- Color palette: ${colorStyle}${themePaletteOverlay}
- Lighting & lens: natural balanced light, editorial clarity, cohesive across the board
- Composition: layered moodboard collage with varied scales (wide, mid, close-up)
- Texture & material: authentic to the brand's world${promptLibraryBlock}

[CONTENT ELEMENTS]
- Lifestyle / use-case scenarios: aspirational but plausible, never literal landmarks
- Product or service in real context: prefer human presence over empty stock
- Emotional storytelling moments — intimate human details and atmospheric wide shots
- Branding: subtle, integrated, non-intrusive (no logos, no on-image text)

[MARKETING TOUCHPOINTS]
Adapt visuals for: ${platformsLine}.

[MOOD & EMOTION]
${moodEmotions}.

[CREATIVE REFERENCES]
- Attached reference images are the PRIMARY visual anchor (palette, lighting, lens character, photographic style). The moodboard must read as a natural extension of those photos — do NOT drift into a generic stock look that ignores them.
- Treat any named places, buildings, monuments, or landmarks in the brand text as MOOD references only. Render generic, plausible scenes that fit the atmosphere — never attempt photographic recreation of a specific real-world location.
- Avoid: text or typography, brand names, logos, watermarks, generic stock photography, literal landmark recreation.

[OUTPUT REQUIREMENT]
Generate a cohesive, visually consistent moodboard collage with strong storytelling, aligned with the brand positioning above. Premium, editorial quality, optimised for digital marketing performance.

ABSOLUTE REQUIREMENTS — failure to follow is unacceptable:
- ZERO text anywhere in the image — no words, letters, numbers, brand names, logos, watermarks, captions, or labels of any kind
- Consistent visual language and color grading throughout the entire board
- Every element serves the brand positioning and visual direction above
Final instruction: absolutely no text, no typography, no letters, no numbers, no words anywhere in any part of the image.`;

  const brandRefsCount = (ba?.referenceImages ?? []).filter((u) => u?.trim()).length;

  try {
    const result = await withAiLog(
      "moodboard.generate",
      {
        campaignId: campaign.id,
        brandTemplateId: campaign.brandTemplateId,
        hasUserPrompt: Boolean(userPrompt),
        brandRefsCount,
        prompt: moodboardPrompt,
      },
      () =>
        generateAndUploadImage({
          prompt: moodboardPrompt,
          aspect: "OMG",
          storageKeyPrefix: `campaign/${id}/moodboard/${Date.now()}`,
          referenceCategory: null,
          brandReferenceUrls: ba?.referenceImages ?? null,
        }),
      (r) => ({
        ok: Boolean(r.imageUrl && !r.imageUrl.startsWith("data:")),
        extra: { imageUrl: r.imageUrl },
      })
    );

    if (!result.imageUrl || result.imageUrl.startsWith("data:")) {
      return NextResponse.json(
        { error: "Image generation returned no usable image" },
        { status: 500 }
      );
    }

    await prisma.campaign.update({
      where: { id },
      data: {
        moodboardImages: [result.imageUrl],
        moodboardGeneratedAt: new Date(),
      },
    });
    revalidateTag("campaigns");

    return NextResponse.json({ imageUrl: result.imageUrl });
  } catch (err) {
    console.error("[moodboard] generation failed:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Generation failed" },
      { status: 500 }
    );
  }
}
