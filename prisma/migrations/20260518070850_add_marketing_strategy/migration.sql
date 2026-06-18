-- CreateEnum
CREATE TYPE "StrategyStatus" AS ENUM ('UPLOADED', 'ANALYZING', 'READY_REVIEW', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "StrategyDraftStatus" AS ENUM ('PENDING', 'REJECTED', 'CREATED');

-- AlterTable
ALTER TABLE "Campaign" ADD COLUMN     "strategyId" TEXT;

-- CreateTable
CREATE TABLE "MarketingStrategy" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "brandTemplateId" TEXT NOT NULL DEFAULT 'omg',
    "status" "StrategyStatus" NOT NULL DEFAULT 'UPLOADED',
    "sourceFileUrl" TEXT NOT NULL,
    "sourceFileName" TEXT NOT NULL,
    "sourceMimeType" TEXT NOT NULL DEFAULT 'application/pdf',
    "sourceBytes" INTEGER,
    "summary" TEXT,
    "rawExtraction" JSONB,
    "analyzeError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MarketingStrategy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StrategyCampaignDraft" (
    "id" TEXT NOT NULL,
    "strategyId" TEXT NOT NULL,
    "status" "StrategyDraftStatus" NOT NULL DEFAULT 'PENDING',
    "orderIndex" INTEGER NOT NULL DEFAULT 0,
    "payload" JSONB NOT NULL,
    "rationale" TEXT,
    "sourceQuote" TEXT,
    "createdCampaignId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StrategyCampaignDraft_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MarketingStrategy_status_updatedAt_idx" ON "MarketingStrategy"("status", "updatedAt" DESC);

-- CreateIndex
CREATE INDEX "MarketingStrategy_brandTemplateId_idx" ON "MarketingStrategy"("brandTemplateId");

-- CreateIndex
CREATE UNIQUE INDEX "StrategyCampaignDraft_createdCampaignId_key" ON "StrategyCampaignDraft"("createdCampaignId");

-- CreateIndex
CREATE INDEX "StrategyCampaignDraft_strategyId_orderIndex_idx" ON "StrategyCampaignDraft"("strategyId", "orderIndex");

-- CreateIndex
CREATE INDEX "Campaign_strategyId_idx" ON "Campaign"("strategyId");

-- AddForeignKey
ALTER TABLE "Campaign" ADD CONSTRAINT "Campaign_strategyId_fkey" FOREIGN KEY ("strategyId") REFERENCES "MarketingStrategy"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StrategyCampaignDraft" ADD CONSTRAINT "StrategyCampaignDraft_strategyId_fkey" FOREIGN KEY ("strategyId") REFERENCES "MarketingStrategy"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StrategyCampaignDraft" ADD CONSTRAINT "StrategyCampaignDraft_createdCampaignId_fkey" FOREIGN KEY ("createdCampaignId") REFERENCES "Campaign"("id") ON DELETE SET NULL ON UPDATE CASCADE;
