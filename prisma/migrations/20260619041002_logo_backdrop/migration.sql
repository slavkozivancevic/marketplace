-- CreateEnum
CREATE TYPE "LogoBackdrop" AS ENUM ('AUTO', 'LIGHT', 'DARK', 'NEUTRAL');

-- AlterTable
ALTER TABLE "Brand" ADD COLUMN     "logoBackdrop" "LogoBackdrop" NOT NULL DEFAULT 'AUTO',
ADD COLUMN     "logoUrlDark" TEXT;
