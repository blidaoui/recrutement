-- AlterTable
ALTER TABLE "Offre" ADD COLUMN     "entreprise" TEXT,
ADD COLUMN     "experienceMin" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "langues" TEXT[],
ADD COLUMN     "niveauEtude" TEXT NOT NULL DEFAULT 'Non précisé',
ADD COLUMN     "salaire" INTEGER,
ADD COLUMN     "skillsObligatoires" TEXT[],
ADD COLUMN     "skillsSouhaitees" TEXT[],
ADD COLUMN     "statut" TEXT NOT NULL DEFAULT 'ouverte';
