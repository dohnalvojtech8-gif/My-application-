-- Historical creation times were not recorded; preserve them as unknown.
ALTER TABLE "Entry" ADD COLUMN "createdAt" TIMESTAMP(3);
ALTER TABLE "Entry" ALTER COLUMN "createdAt" SET DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "Transfer" ADD COLUMN "createdAt" TIMESTAMP(3);
ALTER TABLE "Transfer" ALTER COLUMN "createdAt" SET DEFAULT CURRENT_TIMESTAMP;
DROP INDEX "Entry_userId_date_idx";
CREATE INDEX "Entry_userId_date_createdAt_idx" ON "Entry"("userId", "date", "createdAt");
