-- Minute precision for scheduled publish time after auto-approve.
ALTER TABLE "Campaign" ADD COLUMN "publishMinuteOfHour" INTEGER;
