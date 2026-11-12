ALTER TABLE "Wallet" DROP CONSTRAINT "Wallet_currency_czk";
ALTER TABLE "Wallet" ADD CONSTRAINT "Wallet_currency_check" CHECK (currency IN ('CZK','EUR','USD','GBP','CHF','PLN','HUF','SEK','NOK','DKK'));
ALTER TABLE "Entry" ADD COLUMN "merchant" TEXT NOT NULL DEFAULT '';
ALTER TABLE "Series" ADD COLUMN "merchant" TEXT NOT NULL DEFAULT '';
ALTER TABLE "QuickAction" ADD COLUMN "merchant" TEXT NOT NULL DEFAULT '';
ALTER TABLE "Transfer" ADD COLUMN "receivedAmount" BIGINT;
ALTER TABLE "Transfer" ADD CONSTRAINT "Transfer_receivedAmount_check" CHECK ("receivedAmount" IS NULL OR "receivedAmount" > 0);
CREATE TABLE "Budget" (
 "id" TEXT NOT NULL PRIMARY KEY,
 "userId" TEXT NOT NULL,
 "walletId" TEXT NOT NULL UNIQUE,
 "amount" BIGINT,
 "paymentLimit" BIGINT,
 "period" TEXT NOT NULL DEFAULT 'MONTHLY',
 "warningPercent" INTEGER NOT NULL DEFAULT 80,
 "enabled" BOOLEAN NOT NULL DEFAULT true,
 CONSTRAINT "Budget_amount_check" CHECK ("amount" IS NULL OR "amount" > 0),
 CONSTRAINT "Budget_paymentLimit_check" CHECK ("paymentLimit" IS NULL OR "paymentLimit" > 0),
 CONSTRAINT "Budget_period_check" CHECK ("period" IN ('WEEKLY','MONTHLY','YEARLY')),
 CONSTRAINT "Budget_warningPercent_check" CHECK ("warningPercent" BETWEEN 1 AND 100),
 CONSTRAINT "Budget_nonempty_check" CHECK ("amount" IS NOT NULL OR "paymentLimit" IS NOT NULL),
 CONSTRAINT "Budget_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
 CONSTRAINT "Budget_walletId_userId_fkey" FOREIGN KEY ("walletId","userId") REFERENCES "Wallet"("id","userId") ON DELETE NO ACTION ON UPDATE CASCADE
);
CREATE INDEX "Budget_userId_idx" ON "Budget"("userId");

CREATE UNIQUE INDEX "Budget_walletId_userId_key" ON "Budget"("walletId","userId");
