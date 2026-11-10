-- CreateTable
CREATE TABLE "BankConnection" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "bank" TEXT NOT NULL,
    "country" TEXT NOT NULL,
    "psuType" TEXT NOT NULL,
    "stateHash" TEXT NOT NULL,
    "stateExpires" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "sessionSecret" TEXT,
    "validUntil" TIMESTAMP(3),
    "syncedAt" TIMESTAMP(3),
    "nextSyncAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lockUntil" TIMESTAMP(3),
    "syncError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BankConnection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BankAccount" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "connectionId" TEXT NOT NULL,
    "identity" TEXT NOT NULL,
    "remoteSecret" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "ibanMasked" TEXT NOT NULL,
    "currency" TEXT NOT NULL,
    "balances" JSONB NOT NULL DEFAULT '[]',

    CONSTRAINT "BankAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BankTransaction" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "sourceKey" TEXT NOT NULL,
    "amount" TEXT NOT NULL,
    "currency" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "uncertain" BOOLEAN NOT NULL DEFAULT false,
    "state" TEXT NOT NULL DEFAULT 'NEW',
    "entryId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BankTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BankConnection_stateHash_key" ON "BankConnection"("stateHash");

-- CreateIndex
CREATE INDEX "BankConnection_status_nextSyncAt_idx" ON "BankConnection"("status", "nextSyncAt");

-- CreateIndex
CREATE INDEX "BankConnection_userId_createdAt_idx" ON "BankConnection"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "BankConnection_id_userId_key" ON "BankConnection"("id", "userId");

-- CreateIndex
CREATE INDEX "BankAccount_connectionId_userId_idx" ON "BankAccount"("connectionId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "BankAccount_userId_identity_key" ON "BankAccount"("userId", "identity");

-- CreateIndex
CREATE UNIQUE INDEX "BankAccount_id_userId_key" ON "BankAccount"("id", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "BankTransaction_entryId_key" ON "BankTransaction"("entryId");

-- CreateIndex
CREATE INDEX "BankTransaction_userId_state_date_idx" ON "BankTransaction"("userId", "state", "date");

-- CreateIndex
CREATE UNIQUE INDEX "BankTransaction_accountId_sourceKey_key" ON "BankTransaction"("accountId", "sourceKey");

-- AddForeignKey
ALTER TABLE "BankConnection" ADD CONSTRAINT "BankConnection_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BankAccount" ADD CONSTRAINT "BankAccount_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BankAccount" ADD CONSTRAINT "BankAccount_connectionId_userId_fkey" FOREIGN KEY ("connectionId", "userId") REFERENCES "BankConnection"("id", "userId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BankTransaction" ADD CONSTRAINT "BankTransaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BankTransaction" ADD CONSTRAINT "BankTransaction_accountId_userId_fkey" FOREIGN KEY ("accountId", "userId") REFERENCES "BankAccount"("id", "userId") ON DELETE CASCADE ON UPDATE CASCADE;

