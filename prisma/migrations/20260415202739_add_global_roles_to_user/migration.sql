-- CreateEnum
CREATE TYPE "GlobalRole" AS ENUM ('ADMIN', 'MODERATOR', 'USER');

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "globalRole" "GlobalRole" NOT NULL DEFAULT 'USER';
