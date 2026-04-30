/*
  Warnings:

  - The values [KILOGRAM,LITER] on the enum `UnitOfMeasure` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "UnitOfMeasure_new" AS ENUM ('GRAM', 'MILLILITER', 'UNIT');
ALTER TABLE "supplies" ALTER COLUMN "unitOfMeasure" TYPE "UnitOfMeasure_new" USING ("unitOfMeasure"::text::"UnitOfMeasure_new");
ALTER TABLE "productions" ALTER COLUMN "unitOfMeasure" TYPE "UnitOfMeasure_new" USING ("unitOfMeasure"::text::"UnitOfMeasure_new");
ALTER TYPE "UnitOfMeasure" RENAME TO "UnitOfMeasure_old";
ALTER TYPE "UnitOfMeasure_new" RENAME TO "UnitOfMeasure";
DROP TYPE "public"."UnitOfMeasure_old";
COMMIT;
