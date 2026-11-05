const express = require('express');
const path = require('path');
const { requireAuth, requireRole } = require('../middleware/auth');
const { uploadCV, getMesCV, telechargerCV, updateContact } = require('../controllers/cv.controller');
const upload = require('../config/multer');

const router = express.Router();

router.post('/upload', requireAuth, requireRole('CANDIDAT'), upload.single('cv'), uploadCV);
router.get('/mes-cv', requireAuth, requireRole('CANDIDAT'), getMesCV);
router.put('/contact', requireAuth, requireRole('CANDIDAT'), updateContact);
router.get('/download/:filename', requireAuth, telechargerCV);

module.exports = router;
