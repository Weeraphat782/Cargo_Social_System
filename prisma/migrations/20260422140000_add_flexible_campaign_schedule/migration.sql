-- AlterEnum: new campaign cadence values (Postgres)
ALTER TYPE "CampaignCadence" ADD VALUE 'DAILY';
ALTER TYPE "CampaignCadence" ADD VALUE 'WEEKLY_MULTI';
ALTER TYPE "CampaignCadence" ADD VALUE 'SPECIFIC_DATES';

-- AlterTable
ALTER TABLE "Campaign" ADD COLUMN "scheduleConfig" JSONB;
