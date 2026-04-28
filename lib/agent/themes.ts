import type { CampaignTheme } from "@prisma/client";
import { omgTemplate } from "@/lib/brands/templates/omg";
import { getBrandTemplateOrDefault } from "@/lib/brands/registry";
import type { ThemeBundle } from "@/lib/brands/types";

export type { ThemeBundle };

const THEME_ORDER: CampaignTheme[] = [
  "RELIABILITY_PRO",
  "INNOVATION_TECH",
  "SPEED_URGENCY",
];

export const THEME_BUNDLES: ThemeBundle[] = THEME_ORDER.map(
  (id) => omgTemplate.themeBundles[id]
);

const byId: Record<CampaignTheme, ThemeBundle> = {
  RELIABILITY_PRO: omgTemplate.themeBundles.RELIABILITY_PRO,
  INNOVATION_TECH: omgTemplate.themeBundles.INNOVATION_TECH,
  SPEED_URGENCY: omgTemplate.themeBundles.SPEED_URGENCY,
};

/** @deprecated Prefer getThemeBundleForBrand from @/lib/brands/registry when campaign has brandTemplateId */
export function getThemeBundle(theme: CampaignTheme): ThemeBundle {
  return byId[theme];
}

export async function listThemesForApi(brandTemplateId: string = "omg"): Promise<
  {
    id: CampaignTheme;
    label: string;
    leadServiceName: string;
    tone: string;
    angle: string;
    thumbnailPath: string;
  }[]
> {
  const t = await getBrandTemplateOrDefault(brandTemplateId);
  return THEME_ORDER.map((id) => {
    const b = t.themeBundles[id];
    return {
      id,
      label: b.label,
      leadServiceName: b.leadServiceName,
      tone: b.tone,
      angle: b.angle,
      thumbnailPath: b.thumbnailPath,
    };
  });
}
