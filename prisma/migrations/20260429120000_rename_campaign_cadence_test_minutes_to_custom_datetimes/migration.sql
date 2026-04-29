-- Rename enum label; existing rows stored as TEST_MINUTES remain valid under Prisma enum CUSTOM_DATETIMES.
ALTER TYPE "CampaignCadence" RENAME VALUE 'TEST_MINUTES' TO 'CUSTOM_DATETIMES';
