-- AlterTable
ALTER TABLE "Organization" ADD COLUMN     "leadTimeMaxDays" INTEGER,
ADD COLUMN     "leadTimeMinDays" INTEGER,
ADD COLUMN     "returnWindowDays" INTEGER NOT NULL DEFAULT 14;
