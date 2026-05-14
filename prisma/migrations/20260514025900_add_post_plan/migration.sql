-- CreateEnum
CREATE TYPE "PlanStatus" AS ENUM ('PENDING', 'EXECUTED', 'SKIPPED');

-- CreateTable
CREATE TABLE "PostPlan" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "scheduledFor" TIMESTAMP(3) NOT NULL,
    "indexInRun" INTEGER NOT NULL DEFAULT 0,
    "pillar" TEXT,
    "brief" TEXT,
    "keywordHint" TEXT,
    "status" "PlanStatus" NOT NULL DEFAULT 'PENDING',
    "postId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PostPlan_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PostPlan_postId_key" ON "PostPlan"("postId");

-- CreateIndex
CREATE INDEX "PostPlan_campaignId_scheduledFor_idx" ON "PostPlan"("campaignId", "scheduledFor");

-- CreateIndex
CREATE INDEX "PostPlan_scheduledFor_status_idx" ON "PostPlan"("scheduledFor", "status");

-- CreateIndex
CREATE UNIQUE INDEX "PostPlan_campaignId_scheduledFor_indexInRun_key" ON "PostPlan"("campaignId", "scheduledFor", "indexInRun");

-- AddForeignKey
ALTER TABLE "PostPlan" ADD CONSTRAINT "PostPlan_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PostPlan" ADD CONSTRAINT "PostPlan_postId_fkey" FOREIGN KEY ("postId") REFERENCES "Post"("id") ON DELETE SET NULL ON UPDATE CASCADE;
