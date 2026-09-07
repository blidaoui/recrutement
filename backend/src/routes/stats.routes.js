const express = require('express');
const { requireAuth, requireRole } = require('../middleware/auth');
const { getStats } = require('../controllers/stats.controller');

const router = express.Router();

router.get('/', requireAuth, requireRole('ADMIN', 'RECRUTEUR'), getStats);

module.exports = router;
