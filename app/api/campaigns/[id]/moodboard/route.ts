import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { generateAndUploadImage } from "@/lib/imagegen/gemini";
import { getBrandTemplateOrDefault } from "@/lib/brands/registry";

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
      keywords: true,
      campaignGoal: true,
      contentPillars: true,
      targetPersona: true,
      brandTemplateId: true,
    },
  });
  if (!campaign) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const template = await getBrandTemplateOrDefault(campaign.brandTemplateId);
  const ba = template.brandAssets;

  // Derive personality/tone from brand assets
  const brandPersonality = [ba?.visualStyle, ba?.typography].filter(Boolean).join(", ") || "Professional, modern, trustworthy";
  const colorStyle = [ba?.primaryColor, ba?.secondaryColor].filter(Boolean).join(" + ") || "Brand-consistent";

  const promptLibraryBlock = ba?.promptLibrary?.length
    ? `\nBrand visual references — these specific scenes and subjects MUST guide the imagery:\n${ba.promptLibrary.slice(0, 6).map((p) => `- ${p}`).join("\n")}\n`
    : "";

  const moodboardPrompt = `Create a professional marketing campaign moodboard for a ${template.industryContext} campaign.

Objective:
The moodboard must communicate a clear brand narrative, emotional positioning, and visual direction for a high-performing modern marketing campaign.
${userPrompt ? `\nCreator's specific direction (treat this as the PRIMARY creative brief — adjust all visual choices to satisfy this):\n"${userPrompt}"\n` : ""}
Campaign: ${campaign.name}
Target Audience: ${campaign.targetPersona ?? "Travelers seeking authentic " + template.industryContext + " experiences"}
Campaign Goal: ${campaign.campaignGoal ?? "Brand awareness and engagement"}
Core Message: ${campaign.keywords}
Market Category: ${template.industryContext}
${campaign.contentPillars ? `Content Pillars: ${campaign.contentPillars}` : ""}

BRAND VISUAL STYLE (follow this precisely):
${ba?.visualStyle ?? brandPersonality}
${promptLibraryBlock}
Color palette: ${colorStyle}

REFERENCE PHOTOGRAPHS — PRIMARY VISUAL BASIS:
When reference images are attached to this request, they are the DOMINANT anchor for palette, lighting, lens character, and photographic style. The moodboard collage must read as a natural extension of those photos — do NOT drift into a generic stock look that ignores them.

Moodboard Must Include (weave these naturally into a unified layout):
1. Hero photography — real environments and moments specific to ${template.industryContext}
2. Brand color palette swatches — built around ${colorStyle}
3. Lighting mood references — quality and direction of light specific to this brand
4. Texture and material details — surfaces and elements authentic to this world
5. Atmospheric wide shots — establishing the landscape and mood
6. Intimate close-up details — textures, objects, human moments
7. Emotional storytelling — authentic moments that resonate with the target audience

Visual Style Requirements:
- Highly curated, editorial-quality travel documentary aesthetic
- Premium art direction aligned to ${template.industryContext}
- Cohesive color grading: ${colorStyle}
- Every image must feel unmistakably specific to this brand's world — NOT generic stock photography

ABSOLUTE REQUIREMENTS — failure to follow these is unacceptable:
- ZERO text anywhere in the image — no words, no letters, no brand names, no logos, no watermarks, no captions, no labels of any kind
- All photography must feel unmistakably specific to ${template.industryContext} — never generic or interchangeable with another industry
- Every visual element must serve the brand's world defined in the visual style above
- Consistent visual language and color grading throughout the entire board`;

  try {
    const result = await generateAndUploadImage({
      prompt: moodboardPrompt,
      aspect: "OMG",
      storageKeyPrefix: `campaign/${id}/moodboard/${Date.now()}`,
      referenceCategory: null,
      brandReferenceUrls: ba?.referenceImages ?? null,
    });

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
