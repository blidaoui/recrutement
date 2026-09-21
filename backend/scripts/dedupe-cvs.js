// Script à exécuter UNE SEULE FOIS, avant la migration Prisma qui ajoute
// la contrainte `candidatId @unique` sur le modèle CV.
//
// Nettoie les doublons accumulés par l'ancien comportement (chaque upload
// créait une nouvelle ligne au lieu de remplacer le CV existant) : pour
// chaque candidat ayant plusieurs CV, on garde le plus récent et on
// supprime les autres (fichier physique + ligne en base).
//
// Usage : node scripts/dedupe-cvs.js

const fs = require('fs');
const path = require('path');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const cvs = await prisma.cV.findMany({ orderBy: { createdAt: 'desc' } });

  const parCandidat = new Map();
  for (const cv of cvs) {
    if (!parCandidat.has(cv.candidatId)) parCandidat.set(cv.candidatId, []);
    parCandidat.get(cv.candidatId).push(cv);
  }

  let totalSupprimes = 0;

  for (const [candidatId, liste] of parCandidat) {
    if (liste.length <= 1) continue;

    // liste est triée du plus récent au plus ancien (orderBy createdAt desc)
    const [aGarder, ...aSupprimer] = liste;
    console.log(`Candidat ${candidatId} : ${liste.length} CV(s) -> conservation du CV #${aGarder.id}, suppression de ${aSupprimer.length}`);

    for (const cv of aSupprimer) {
      if (cv.urlFichier) {
        fs.unlink(path.resolve(cv.urlFichier), (err) => {
          if (err && err.code !== 'ENOENT') console.warn(`  Impossible de supprimer le fichier ${cv.urlFichier}:`, err.message);
        });
      }
      await prisma.cV.delete({ where: { id: cv.id } });
      totalSupprimes++;
    }
  }

  console.log(`\nTerminé. ${totalSupprimes} CV(s) en double supprimé(s).`);
  console.log('Tu peux maintenant lancer : npx prisma migrate dev --name cv_unique_par_candidat');
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});