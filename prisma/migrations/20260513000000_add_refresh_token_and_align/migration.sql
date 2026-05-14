-- Aligning schema drift caused by feature/11 and adding RefreshTokens

-- AlterTable
ALTER TABLE "organization_users" ALTER COLUMN "roleId" SET NOT NULL;

-- AlterTable
ALTER TABLE "permissions" DROP COLUMN "createdAt",
DROP COLUMN "updatedAt";

-- AlterTable
ALTER TABLE "role_permissions" DROP COLUMN "createdAt",
DROP COLUMN "updatedAt",
DROP COLUMN "globalRole",
ADD COLUMN "globalRole" "GlobalRole";

-- CreateIndex
CREATE UNIQUE INDEX "role_permissions_globalRole_permissionId_key" ON "role_permissions"("globalRole", "permissionId");

-- AlterTable
ALTER TABLE "roles" DROP COLUMN "displayName",
DROP COLUMN "isDefault",
DROP COLUMN "isSystem",
ADD COLUMN "isSystemDefault" BOOLEAN NOT NULL DEFAULT false,
ALTER COLUMN "organizationId" SET NOT NULL;

-- CreateTable
CREATE TABLE "refresh_tokens" (
    "id" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "userAgent" TEXT,
    "ipAddress" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "refresh_tokens_tokenHash_key" ON "refresh_tokens"("tokenHash");

-- CreateIndex
CREATE INDEX "refresh_tokens_userId_idx" ON "refresh_tokens"("userId");

-- AddForeignKey
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
