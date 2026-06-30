-- CreateTable
CREATE TABLE "subscription_status_logs" (
    "id" TEXT NOT NULL,
    "subscriptionId" TEXT NOT NULL,
    "fromStatus" "SubscriptionStatus" NOT NULL,
    "toStatus" "SubscriptionStatus" NOT NULL,
    "reason" TEXT,
    "triggeredBy" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "subscription_status_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "subscription_status_logs_subscriptionId_idx" ON "subscription_status_logs"("subscriptionId");

-- CreateIndex
CREATE INDEX "subscription_status_logs_createdAt_idx" ON "subscription_status_logs"("createdAt");

-- AddForeignKey
ALTER TABLE "subscription_status_logs" ADD CONSTRAINT "subscription_status_logs_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "subscriptions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
