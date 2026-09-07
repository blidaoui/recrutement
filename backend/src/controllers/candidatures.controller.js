const prisma = require('../config/db');
const { calculerScoreMatching } = require('../services/ia/matching');
const { formatCvResponse } = require('./cv.controller');

// POST /api/candidatures - le candidat postule à une offre avec son CV le plus récent
async function postuler(req, res) {
  try {
    const { offreId } = req.body;

    const offre = await prisma.offre.findUnique({ where: { id: Number(offreId) } });
    if (!offre) return res.status(404).json({ message: 'Offre introuvable' });

    const dernierCV = await prisma.cV.findFirst({
      where: { candidatId: req.user.id },
      orderBy: { createdAt: 'desc' },
    });

    if (!dernierCV) {
      return res.status(400).json({
        message: "Aucun CV trouvé",
        noCv: true,
      });
    }

    const { score } = calculerScoreMatching(dernierCV.skillsExtraites, offre.skillsRequises);

    const candidature = await prisma.candidature.upsert({
      where: {
        candidatId_offreId: { candidatId: req.user.id, offreId: offre.id },
      },
      update: { scoreMatching: score },
      create: {
        candidatId: req.user.id,
        offreId: offre.id,
        scoreMatching: score,
      },
    });

    res.status(201).json({ candidature, message: 'Candidature envoyée avec succès' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Erreur lors de la candidature' });
  }
}

// GET /api/candidatures/offre/:offreId - le recruteur voit les candidatures classées par score
async function getCandidaturesParOffre(req, res) {
  try {
    const rawCandidatures = await prisma.candidature.findMany({
      where: { offreId: Number(req.params.offreId) },
      include: {
        candidat: {
          select: {
            id: true,
            nom: true,
            email: true,
            cvs: {
              orderBy: { createdAt: 'desc' },
              take: 1,
            }
          }
        }
      },
      orderBy: { scoreMatching: 'desc' },
    });

    const candidatures = rawCandidatures.map((cand) => {
      const activeCv = cand.candidat?.cvs?.[0] ? formatCvResponse(cand.candidat.cvs[0]) : null;
      return {
        ...cand,
        cv: activeCv,
      };
    });

    res.json({ candidatures });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Erreur lors de la récupération des candidatures' });
  }
}

// GET /api/candidatures/mes-candidatures - le candidat voit ses candidatures
async function getMesCandidatures(req, res) {
  try {
    const rawCandidatures = await prisma.candidature.findMany({
      where: { candidatId: req.user.id },
      include: {
        offre: true,
        candidat: {
          select: {
            id: true,
            nom: true,
            email: true,
            cvs: {
              orderBy: { createdAt: 'desc' },
              take: 1,
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const candidatures = rawCandidatures.map((cand) => {
      const activeCv = cand.candidat?.cvs?.[0] ? formatCvResponse(cand.candidat.cvs[0]) : null;
      return { ...cand, cv: activeCv };
    });

    res.json({ candidatures });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Erreur lors de la récupération de vos candidatures' });
  }
}

// PATCH /api/candidatures/:id/statut - le recruteur change le statut d'une candidature
async function changerStatutCandidature(req, res) {
  try {
    const { id } = req.params;
    const { statut } = req.body; // 'EN_ATTENTE' | 'ACCEPTEE' | 'REFUSEE'

    if (!['EN_ATTENTE', 'ACCEPTEE', 'REFUSEE'].includes(statut)) {
      return res.status(400).json({ message: 'Statut invalide' });
    }

    const candidature = await prisma.candidature.update({
      where: { id: Number(id) },
      data: { statut },
    });

    res.json({ candidature, message: 'Statut mis à jour' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Erreur lors de la mise à jour du statut' });
  }
}

module.exports = {
  postuler,
  getCandidaturesParOffre,
  getMesCandidatures,
  changerStatutCandidature,
};
