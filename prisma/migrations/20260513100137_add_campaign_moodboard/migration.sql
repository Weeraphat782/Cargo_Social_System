-- AlterTable
ALTER TABLE "Campaign" ADD COLUMN     "moodboardGeneratedAt" TIMESTAMP(3),
ADD COLUMN     "moodboardImages" JSONB;
