-- CreateTable
CREATE TABLE "QuickAction" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "amount" BIGINT NOT NULL,
    "mode" TEXT NOT NULL DEFAULT 'FORM',
    "showBalance" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "QuickAction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WidgetDevice" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "showBalance" BOOLEAN NOT NULL DEFAULT false,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WidgetDevice_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "QuickAction_userId_idx" ON "QuickAction"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "WidgetDevice_tokenHash_key" ON "WidgetDevice"("tokenHash");

-- CreateIndex
CREATE INDEX "WidgetDevice_userId_idx" ON "WidgetDevice"("userId");

-- AddForeignKey
ALTER TABLE "QuickAction" ADD CONSTRAINT "QuickAction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WidgetDevice" ADD CONSTRAINT "WidgetDevice_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

