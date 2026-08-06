-- CreateTable
CREATE TABLE "user_subscription_price_history" (
    "id" TEXT NOT NULL,
    "userSubscriptionId" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "currency" CHAR(3) NOT NULL,
    "effectiveFrom" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_subscription_price_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_subscription_usage_logs" (
    "id" TEXT NOT NULL,
    "userSubscriptionId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "used" BOOLEAN NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_subscription_usage_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "user_subscription_price_history_userSubscriptionId_idx" ON "user_subscription_price_history"("userSubscriptionId");

-- CreateIndex
CREATE INDEX "user_subscription_usage_logs_userSubscriptionId_idx" ON "user_subscription_usage_logs"("userSubscriptionId");

-- CreateIndex
CREATE UNIQUE INDEX "user_subscription_usage_logs_userSubscriptionId_date_key" ON "user_subscription_usage_logs"("userSubscriptionId", "date");

-- AddForeignKey
ALTER TABLE "user_subscription_price_history" ADD CONSTRAINT "user_subscription_price_history_userSubscriptionId_fkey" FOREIGN KEY ("userSubscriptionId") REFERENCES "user_subscriptions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_subscription_usage_logs" ADD CONSTRAINT "user_subscription_usage_logs_userSubscriptionId_fkey" FOREIGN KEY ("userSubscriptionId") REFERENCES "user_subscriptions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
