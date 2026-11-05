const express = require('express');
const path = require('path');
const multer = require('multer');
const { requireAuth, requireRole } = require('../middleware/auth');
const { uploadCV, getMesCV, telechargerCV, updateContact } = require('../controllers/cv.controller');

const router = express.Router();

const storage = multer.diskStorage({
  destination: 'src/uploads/',
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, require('crypto').randomBytes(16).toString('hex') + ext);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const typesAutorises = [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/plain',
    ];
    cb(null, typesAutorises.includes(file.mimetype));
  },
});

router.post('/upload', requireAuth, requireRole('CANDIDAT'), upload.single('cv'), uploadCV);
router.get('/mes-cv', requireAuth, requireRole('CANDIDAT'), getMesCV);
router.put('/contact', requireAuth, requireRole('CANDIDAT'), updateContact);
router.get('/download/:filename', requireAuth, telechargerCV);

module.exports = router;