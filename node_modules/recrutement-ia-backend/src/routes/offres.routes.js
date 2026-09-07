const express = require('express');
const { requireAuth, requireRole } = require('../middleware/auth');
const {
  creerOffre,
  listerOffres,
  getOffre,
  modifierOffre,
  supprimerOffre,
} = require('../controllers/offres.controller');

const router = express.Router();

router.get('/', listerOffres);
router.get('/:id', getOffre);

// Routes réservées aux Recruteurs et aux Administrateurs
router.post('/', requireAuth, requireRole('RECRUTEUR', 'ADMIN'), creerOffre);
router.put('/:id', requireAuth, requireRole('RECRUTEUR', 'ADMIN'), modifierOffre);
router.delete('/:id', requireAuth, requireRole('RECRUTEUR', 'ADMIN'), supprimerOffre);

module.exports = router;
