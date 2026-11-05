/**
 * Script pour réinitialiser les coordonnées manuelles (overrides) sur les CVs
 * afin que les coordonnées réelles extraites des fichiers CV s'affichent à nouveau.
 *
 * Usage : node scripts/reset-cv-contact-overrides.js
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('Réinitialisation des surcharges manuelles des coordonnées (emailOverride, telephoneOverride)...');

  const result = await prisma.cV.updateMany({
    data: {
      emailOverride: null,
      telephoneOverride: null,
    },
  });

  console.log(`✅ Succès : ${result.count} CV(s) réinitialisé(s) vers leurs coordonnées d'origine.`);
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error('Erreur :', err.message);
  process.exit(1);
});

