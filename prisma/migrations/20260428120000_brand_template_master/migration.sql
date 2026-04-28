-- CreateTable
CREATE TABLE "BrandTemplateMaster" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BrandTemplateMaster_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BrandTemplateMaster_slug_key" ON "BrandTemplateMaster"("slug");

-- CreateIndex
CREATE INDEX "BrandTemplateMaster_slug_idx" ON "BrandTemplateMaster"("slug");
