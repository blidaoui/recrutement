/*
  Warnings:

  - The `experienceMin` column on the `Offre` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - A unique constraint covering the columns `[candidatId]` on the table `CV` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "CV" ADD COLUMN     "emailOverride" TEXT,
ADD COLUMN     "telephoneOverride" TEXT,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "Offre" DROP COLUMN "experienceMin",
ADD COLUMN     "experienceMin" INTEGER NOT NULL DEFAULT 0;

-- CreateIndex
CREATE UNIQUE INDEX "CV_candidatId_key" ON "CV"("candidatId");
