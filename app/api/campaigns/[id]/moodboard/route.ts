import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { withAiLog } from "@/lib/ai-logger";
import { generateAndUploadImage } from "@/lib/imagegen/gemini";
import { getBrandTemplateOrDefault } from "@/lib/brands/registry";
import {
  buildMoodboardCreatorBlock,
  rewriteMoodboardUserPrompt,
} from "@/lib/imagegen/rewrite-user-prompt";

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
    ? `\nBrand mood inspiration — palette / lighting / texture / atmosphere ONLY. Do NOT render any item from this list as a literal subject (no buildings, monuments, places, or objects pulled from these phrases). If a phrase names a place, building, or landmark, treat it strictly as an atmosphere reference:\n${ba.promptLibrary.slice(0, 3).map((p) => `- ${p}`).join("\n")}\n`
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

  const rewrite = userPrompt
    ? await rewriteMoodboardUserPrompt({
        userPrompt,
        campaign: {
          id: campaign.id,
          name: campaign.name,
          description: campaign.description,
          keywords: campaign.keywords,
          theme: campaign.theme,
          brandTemplateId: campaign.brandTemplateId,
        },
        template,
      })
    : null;

  const creatorBlock = rewrite ? `\n\n${buildMoodboardCreatorBlock(rewrite)}` : "";

  const campaignSubjectBlock = `

[CAMPAIGN SUBJECT — HIGHEST PRIORITY FOR SUBJECT CHOICE]
- Derive every scene, object, and activity in the moodboard from these fields below — NOT from the brand reference images and NOT from the brand mood inspiration list.
- Campaign name: ${campaign.name}
- Campaign description: ${campaign.description?.trim() || "(none — infer from goal + core message + theme angle)"}
- Core message / keywords: ${campaign.keywords || "(none)"}
- Content pillars: ${campaign.contentPillars?.trim() || "(none)"}
- Theme angle: ${themeBundle?.angle ?? "(none)"}
- Target audience: ${campaign.targetPersona ?? "Audience aligned with the brand category"}
- If a subject is not implied by these fields, leave the panel empty of that subject — never fill the gap with subjects copied from the brand reference images.`;

  const moodboardPrompt = `Create a high-impact marketing campaign moodboard for: ${campaign.name}.

[CAMPAIGN OBJECTIVE]
Drive ${campaign.campaignGoal ?? "brand awareness and engagement"} by positioning the brand as ${positioning}.${descriptionBlock}
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
- Texture & material: authentic to the brand's world${promptLibraryBlock}${campaignSubjectBlock}

[CONTENT ELEMENTS]
- Lifestyle / use-case scenarios: drawn from [CAMPAIGN SUBJECT] above — aspirational but plausible, never literal landmarks, and never subjects copied from the brand reference images
- Subject treatment: follow the CREATOR DIRECTION block below when present; do not assume human figures unless that block asks for people
- Emotional storytelling moments — mood, light, texture, and composition carry the story when figures are not requested
- Branding: subtle, integrated, non-intrusive (no logos, no on-image text)

[MARKETING TOUCHPOINTS]
Adapt visuals for: ${platformsLine}.

[MOOD & EMOTION]
${moodEmotions}.

[CREATIVE REFERENCES]
- Attached brand reference images are the PALETTE / LIGHTING / LENS / ATMOSPHERE anchor only. Match their color grading, light quality, photographic feel, and editorial polish.
- Do NOT copy subjects from the brand reference images. Specifically: do NOT borrow buildings, monasteries, landmarks, vehicles, signage, people, or objects that appear in those photos unless the [CAMPAIGN SUBJECT] block above explicitly calls for them.
- Subject matter in the moodboard MUST come from the [CAMPAIGN SUBJECT] block above — not from the brand refs and not from the brand mood inspiration list.
- Treat any named places, buildings, or landmarks anywhere in this prompt as atmosphere references only — never render a specific real-world location.
- Avoid: text or typography, brand names, logos, watermarks, generic stock photography, literal landmark recreation.

[OUTPUT REQUIREMENT]
Generate a cohesive, visually consistent moodboard collage with strong storytelling, aligned with the brand positioning above. Premium, editorial quality, optimised for digital marketing performance.

ABSOLUTE REQUIREMENTS — failure to follow is unacceptable:
- ZERO text anywhere in the image — no words, letters, numbers, brand names, logos, watermarks, captions, or labels of any kind
- Consistent visual language and color grading throughout the entire board
- Every element serves the brand positioning and visual direction above
Final instruction: absolutely no text, no typography, no letters, no numbers, no words anywhere in any part of the image.${creatorBlock}`;

  const brandRefsCount = (ba?.referenceImages ?? []).filter((u) => u?.trim()).length;

  try {
    const result = await withAiLog(
      "moodboard.generate",
      {
        campaignId: campaign.id,
        brandTemplateId: campaign.brandTemplateId,
        hasUserPrompt: Boolean(userPrompt),
        hasUserOverride: Boolean(rewrite),
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
          hasUserOverride: Boolean(rewrite),
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
