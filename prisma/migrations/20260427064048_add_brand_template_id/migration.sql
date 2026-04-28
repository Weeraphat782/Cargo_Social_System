-- AlterTable
ALTER TABLE "Campaign" ADD COLUMN     "brandTemplateId" TEXT NOT NULL DEFAULT 'omg';

-- AlterTable
ALTER TABLE "Topic" ADD COLUMN     "brandTemplateId" TEXT NOT NULL DEFAULT 'omg';

-- CreateIndex
CREATE INDEX "Campaign_brandTemplateId_idx" ON "Campaign"("brandTemplateId");

-- CreateIndex
CREATE INDEX "Topic_brandTemplateId_idx" ON "Topic"("brandTemplateId");
