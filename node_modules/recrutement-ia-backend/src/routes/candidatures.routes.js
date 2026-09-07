const express = require('express');
const { requireAuth, requireRole } = require('../middleware/auth');
const {
  postuler,
  getCandidaturesParOffre,
  getMesCandidatures,
  changerStatutCandidature,
} = require('../controllers/candidatures.controller');

const router = express.Router();

router.post('/', requireAuth, requireRole('CANDIDAT'), postuler);
router.get('/mes-candidatures', requireAuth, requireRole('CANDIDAT'), getMesCandidatures);
router.get(
  '/offre/:offreId',
  requireAuth,
  requireRole('RECRUTEUR'),
  getCandidaturesParOffre
);
router.patch(
  '/:id/statut',
  requireAuth,
  requireRole('RECRUTEUR'),
  changerStatutCandidature
);

module.exports = router;
