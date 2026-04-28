import { omgTemplate } from "@/lib/brands/templates/omg";
import type { BrandService } from "@/lib/brands/types";

/** @deprecated Use BrandService from @/lib/brands/types */
export type OmgService = BrandService;

/** OMG catalog; same as getBrandTemplate("omg").services */
export const OMG_SERVICES: OmgService[] = omgTemplate.services;

export const PROMO_GUIDANCE = omgTemplate.promoGuidance;
