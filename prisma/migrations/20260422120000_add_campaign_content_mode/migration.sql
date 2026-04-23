-- CreateEnum
CREATE TYPE "CampaignContentMode" AS ENUM ('NEWS_DRIVEN', 'SELF_PROMO');

-- AlterTable
ALTER TABLE "Campaign" ADD COLUMN "contentMode" "CampaignContentMode" NOT NULL DEFAULT 'NEWS_DRIVEN';
