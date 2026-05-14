-- Final schema alignment

ALTER TABLE "invitations" ALTER COLUMN "roleId" SET NOT NULL;

ALTER TABLE "modules" DROP COLUMN "createdAt",
DROP COLUMN "displayName",
DROP COLUMN "isActive",
DROP COLUMN "updatedAt";
