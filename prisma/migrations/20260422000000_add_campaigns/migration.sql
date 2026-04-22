-- CreateEnum
CREATE TYPE "CampaignStatus" AS ENUM ('DRAFT', 'ACTIVE', 'PAUSED', 'COMPLETED');

-- CreateEnum
CREATE TYPE "CampaignCadence" AS ENUM ('WEEKLY', 'BIWEEKLY', 'MONTHLY', 'CUSTOM');

-- CreateEnum
CREATE TYPE "CampaignTheme" AS ENUM ('RELIABILITY_PRO', 'INNOVATION_TECH', 'SPEED_URGENCY');

-- AlterTable
ALTER TABLE "Post" ADD COLUMN "campaignId" TEXT;

-- CreateTable
CREATE TABLE "Campaign" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "status" "CampaignStatus" NOT NULL DEFAULT 'DRAFT',
    "keywords" TEXT NOT NULL,
    "brandVoice" TEXT,
    "theme" "CampaignTheme" NOT NULL,
    "cadence" "CampaignCadence" NOT NULL,
    "dayOfWeek" INTEGER,
    "hourOfDay" INTEGER,
    "timezone" TEXT NOT NULL DEFAULT 'Asia/Bangkok',
    "customCron" TEXT,
    "platforms" "Platform"[],
    "postsPerRun" INTEGER NOT NULL DEFAULT 1,
    "totalPostsCap" INTEGER,
    "autoApprove" BOOLEAN NOT NULL DEFAULT false,
    "startAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endAt" TIMESTAMP(3),
    "nextRunAt" TIMESTAMP(3),
    "lastRunAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Campaign_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CampaignRun" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "ok" BOOLEAN NOT NULL DEFAULT false,
    "postId" TEXT,
    "error" TEXT,

    CONSTRAINT "CampaignRun_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "Post" ADD CONSTRAINT "Post_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampaignRun" ADD CONSTRAINT "CampaignRun_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;
