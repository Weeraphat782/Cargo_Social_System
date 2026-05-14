import { getBrandTemplateOrDefault } from "@/lib/brands/registry";

/**
 * Resolve moodboard + brand reference URLs for image generation (campaign posts / regenerate).
 */
export async function resolveCampaignImageRefs(params: {
  moodboardImages: unknown;
  brandTemplateId: string;
}): Promise<{
  moodboardReferenceUrl: string | null;
  brandReferenceUrls: string[] | null;
}> {
  const imgs = Array.isArray(params.moodboardImages)
    ? (params.moodboardImages as string[])
    : [];
  const first = imgs[0]?.trim();
  const moodboardReferenceUrl =
    first && !first.startsWith("data:") ? first : null;

  const template = await getBrandTemplateOrDefault(params.brandTemplateId);
  const raw = template.brandAssets?.referenceImages ?? [];
  const urls = raw
    .map((u) => u?.trim())
    .filter((u): u is string => Boolean(u && !u.startsWith("data:")));

  return {
    moodboardReferenceUrl,
    brandReferenceUrls: urls.length ? urls : null,
  };
}
