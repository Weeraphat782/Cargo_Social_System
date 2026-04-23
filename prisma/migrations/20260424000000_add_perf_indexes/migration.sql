-- CreateIndex
CREATE INDEX "Post_status_createdAt_idx" ON "Post" ("status", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "Post_status_scheduledAt_idx" ON "Post" ("status", "scheduledAt");

-- CreateIndex
CREATE INDEX "Post_campaignId_createdAt_idx" ON "Post" ("campaignId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "Post_topicId_idx" ON "Post" ("topicId");

-- CreateIndex
CREATE INDEX "Post_sourceNewsId_idx" ON "Post" ("sourceNewsId");

-- CreateIndex
CREATE INDEX "Campaign_status_nextRunAt_idx" ON "Campaign" ("status", "nextRunAt");

-- CreateIndex
CREATE INDEX "Campaign_updatedAt_idx" ON "Campaign" ("updatedAt" DESC);

-- CreateIndex
CREATE INDEX "CampaignRun_campaignId_startedAt_idx" ON "CampaignRun" ("campaignId", "startedAt" DESC);

-- CreateIndex
CREATE INDEX "Media_variantId_idx" ON "Media" ("variantId");

-- CreateIndex
CREATE INDEX "PublishLog_postId_attemptAt_idx" ON "PublishLog" ("postId", "attemptAt" DESC);
