-- AlterTable
ALTER TABLE "invoices" ALTER COLUMN "currency" SET DEFAULT 'COP';

-- AlterTable
ALTER TABLE "subscriptions" ADD COLUMN     "isPaused" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "pausedAt" TIMESTAMP(3);
