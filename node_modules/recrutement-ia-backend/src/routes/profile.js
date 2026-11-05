const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const prisma = require('../config/db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

const uploadDir = path.join(__dirname, '..', 'uploads', 'photos');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `user-${req.user.id}-${Date.now()}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 3 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!ALLOWED_TYPES.includes(file.mimetype)) {
      return cb(new Error('Format non supporté. Utilisez JPG, PNG ou WEBP.'));
    }
    cb(null, true);
  },
});

function supprimerAncienneFichier(photoUrl) {
  if (!photoUrl) return;
  const ancienPath = path.join(uploadDir, path.basename(photoUrl));
  fs.unlink(ancienPath, () => {});
}

router.post('/photo', requireAuth, (req, res) => {
  upload.single('photo')(req, res, async (err) => {
    if (err) {
      return res.status(400).json({ message: err.message || 'Erreur lors de l\'upload' });
    }
    if (!req.file) {
      return res.status(400).json({ message: 'Aucun fichier reçu' });
    }

    try {
      const ancien = await prisma.user.findUnique({ where: { id: req.user.id } });
      supprimerAncienneFichier(ancien?.photoProfil);

      const photoUrl = `/uploads/photos/${req.file.filename}`;

      const user = await prisma.user.update({
        where: { id: req.user.id },
        data: { photoProfil: photoUrl },
        select: { id: true, nom: true, email: true, role: true, photoProfil: true },
      });

      res.json({ message: 'Photo de profil mise à jour', user });
    } catch (e) {
      console.error(e);
      res.status(500).json({ message: 'Erreur serveur' });
    }
  });
});

router.delete('/photo', requireAuth, async (req, res) => {
  try {
    const ancien = await prisma.user.findUnique({ where: { id: req.user.id } });
    supprimerAncienneFichier(ancien?.photoProfil);

    const user = await prisma.user.update({
      where: { id: req.user.id },
      data: { photoProfil: null },
      select: { id: true, nom: true, email: true, role: true, photoProfil: true },
    });

    res.json({ message: 'Photo de profil supprimée', user });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: 'Erreur serveur' });
  }
});

module.exports = router;