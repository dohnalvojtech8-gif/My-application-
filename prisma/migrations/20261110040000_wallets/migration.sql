BEGIN;
-- AlterTable
ALTER TABLE "Entry" ADD COLUMN     "walletId" TEXT;

-- AlterTable
ALTER TABLE "Series" ADD COLUMN     "walletId" TEXT;

-- AlterTable
ALTER TABLE "QuickAction" ADD COLUMN     "walletId" TEXT;

-- AlterTable
ALTER TABLE "BankAccount" ADD COLUMN     "walletId" TEXT;

-- CreateTable
CREATE TABLE "Wallet" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'BANK',
    "color" TEXT NOT NULL DEFAULT '#0d9488',
    "currency" TEXT NOT NULL DEFAULT 'CZK',
    "opening" BIGINT NOT NULL DEFAULT 0,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "archived" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Wallet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Transfer" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "fromId" TEXT NOT NULL,
    "toId" TEXT NOT NULL,
    "amount" BIGINT NOT NULL,
    "date" TEXT NOT NULL,
    "comment" TEXT NOT NULL DEFAULT '',
    "key" TEXT NOT NULL,

    CONSTRAINT "Transfer_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Wallet_userId_archived_idx" ON "Wallet"("userId", "archived");

-- CreateIndex
CREATE UNIQUE INDEX "Wallet_id_userId_key" ON "Wallet"("id", "userId");

-- CreateIndex
CREATE INDEX "Transfer_userId_date_idx" ON "Transfer"("userId", "date");

-- CreateIndex
CREATE INDEX "Transfer_fromId_userId_idx" ON "Transfer"("fromId", "userId");

-- CreateIndex
CREATE INDEX "Transfer_toId_userId_idx" ON "Transfer"("toId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "Transfer_userId_key_key" ON "Transfer"("userId", "key");

-- CreateIndex
CREATE INDEX "Entry_walletId_userId_date_idx" ON "Entry"("walletId", "userId", "date");

-- Preserve every existing opening balance and financial record in the default wallet.
INSERT INTO "Wallet" ("id", "userId", "name", "opening", "isDefault")
SELECT overlay(overlay(md5('systematic-wallet:' || "id") placing '4' from 13 for 1) placing 'a' from 17 for 1)::uuid::text, "id", 'Osobní účet', "opening", true FROM "User";
UPDATE "Entry" AS e SET "walletId" = w."id" FROM "Wallet" w WHERE w."userId" = e."userId" AND w."isDefault";
ALTER TABLE "Entry" ALTER COLUMN "walletId" SET NOT NULL;
UPDATE "Series" AS e SET "walletId" = w."id" FROM "Wallet" w WHERE w."userId" = e."userId" AND w."isDefault";
ALTER TABLE "Series" ALTER COLUMN "walletId" SET NOT NULL;
UPDATE "QuickAction" AS e SET "walletId" = w."id" FROM "Wallet" w WHERE w."userId" = e."userId" AND w."isDefault";
ALTER TABLE "QuickAction" ALTER COLUMN "walletId" SET NOT NULL;
CREATE UNIQUE INDEX "Wallet_one_default_per_user" ON "Wallet"("userId") WHERE "isDefault";
ALTER TABLE "Wallet" ADD CONSTRAINT "Wallet_currency_czk" CHECK ("currency" = 'CZK');
ALTER TABLE "Transfer" ADD CONSTRAINT "Transfer_distinct_positive" CHECK ("fromId" <> "toId" AND "amount" > 0);

-- AddForeignKey
ALTER TABLE "Entry" ADD CONSTRAINT "Entry_walletId_userId_fkey" FOREIGN KEY ("walletId", "userId") REFERENCES "Wallet"("id", "userId") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Series" ADD CONSTRAINT "Series_walletId_userId_fkey" FOREIGN KEY ("walletId", "userId") REFERENCES "Wallet"("id", "userId") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuickAction" ADD CONSTRAINT "QuickAction_walletId_userId_fkey" FOREIGN KEY ("walletId", "userId") REFERENCES "Wallet"("id", "userId") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BankAccount" ADD CONSTRAINT "BankAccount_walletId_userId_fkey" FOREIGN KEY ("walletId", "userId") REFERENCES "Wallet"("id", "userId") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Wallet" ADD CONSTRAINT "Wallet_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transfer" ADD CONSTRAINT "Transfer_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transfer" ADD CONSTRAINT "Transfer_fromId_userId_fkey" FOREIGN KEY ("fromId", "userId") REFERENCES "Wallet"("id", "userId") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transfer" ADD CONSTRAINT "Transfer_toId_userId_fkey" FOREIGN KEY ("toId", "userId") REFERENCES "Wallet"("id", "userId") ON DELETE NO ACTION ON UPDATE CASCADE;


COMMIT;
