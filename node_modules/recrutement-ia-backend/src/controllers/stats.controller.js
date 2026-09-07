const prisma = require('../config/db');

async function getStats(req, res) {
  try {
    const isAdmin = req.user.role === 'ADMIN';
    const recruteurFilter = isAdmin ? {} : { recruteurId: req.user.id };

    const offres = await prisma.offre.findMany({
      where: recruteurFilter,
      include: {
        candidatures: { select: { id: true, scoreMatching: true, statut: true } },
      },
    });

    const totalOffres = offres.length;
    const offresOuvertes = offres.length;
    const allCandidatures = offres.flatMap((o) => o.candidatures);
    const totalCandidatures = allCandidatures.length;
    const profilsHautScore = allCandidatures.filter((c) => c.scoreMatching >= 70).length;

    const tranches = { '0-39': 0, '40-59': 0, '60-79': 0, '80-100': 0 };
    allCandidatures.forEach(({ scoreMatching: s }) => {
      if (s < 40) tranches['0-39']++;
      else if (s < 60) tranches['40-59']++;
      else if (s < 80) tranches['60-79']++;
      else tranches['80-100']++;
    });

    const statuts = { EN_ATTENTE: 0, ACCEPTEE: 0, REFUSEE: 0 };
    allCandidatures.forEach(({ statut }) => { statuts[statut] = (statuts[statut] || 0) + 1; });

    const performanceParOffre = offres.map((o) => {
      const scores = o.candidatures.map((c) => c.scoreMatching);
      const scoreMoyen = scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
      const meilleurScore = scores.length ? Math.max(...scores) : 0;
      return {
        id: o.id,
        titre: o.titre,
        statut: 'ouverte',
        nbCandidatures: scores.length,
        scoreMoyen: parseFloat(scoreMoyen.toFixed(1)),
        meilleurScore: parseFloat(meilleurScore.toFixed(2)),
      };
    });

    const result = { totalOffres, offresOuvertes, totalCandidatures, profilsHautScore, tranches, statuts, performanceParOffre };

    // Extra stats for ADMIN only
    if (isAdmin) {
      const [totalComptes, totalCandidats, totalCVs] = await Promise.all([
        prisma.user.count(),
        prisma.user.count({ where: { role: 'CANDIDAT' } }),
        prisma.cV.count(),
      ]);

      // Top offres by candidature count
      const topOffres = offres
        .map((o) => ({ titre: o.titre, nbCandidatures: o.candidatures.length }))
        .sort((a, b) => b.nbCandidatures - a.nbCandidatures)
        .slice(0, 5);

      result.admin = { totalComptes, totalCandidats, totalCVs, topOffres };
    }

    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Erreur lors du chargement des statistiques' });
  }
}

module.exports = { getStats };
