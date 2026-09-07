const express = require('express');
const { requireAuth, requireRole } = require('../middleware/auth');
const { listerUtilisateurs, toggleActif, supprimerUtilisateur, creerUtilisateur } = require('../controllers/admin.controller');

const router = express.Router();

router.get('/users', requireAuth, requireRole('ADMIN'), listerUtilisateurs);
router.post('/users', requireAuth, requireRole('ADMIN'), creerUtilisateur);
router.patch('/users/:id/toggle', requireAuth, requireRole('ADMIN'), toggleActif);
router.delete('/users/:id', requireAuth, requireRole('ADMIN'), supprimerUtilisateur);

module.exports = router;

