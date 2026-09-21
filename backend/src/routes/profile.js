const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const prisma = require('../config/db');
const { requireAuth } = require('../middleware/auth'); // ⚠️ adapte le chemin si ton fichier auth.js est dans /middlewares (avec un s)
 
const router = express.Router();
 
// Dossier de stockage des photos de profil (même logique que pour les CVs)
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
  limits: { fileSize: 3 * 1024 * 1024 }, // 3 Mo max
  fileFilter: (req, file, cb) => {
    if (!ALLOWED_TYPES.includes(file.mimetype)) {
      return cb(new Error('Format non supporté. Utilisez JPG, PNG ou WEBP.'));
    }
    cb(null, true);
  },
});
 
// Supprime physiquement l'ancien fichier photo s'il existe
function supprimerAncienneFichier(photoUrl) {
  if (!photoUrl) return;
  const ancienPath = path.join(uploadDir, path.basename(photoUrl));
  fs.unlink(ancienPath, () => {}); // on ignore l'erreur si le fichier n'existe déjà plus
}
 
// POST /api/profile/photo — upload ou remplace la photo de profil de l'utilisateur connecté
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
 
// DELETE /api/profile/photo — retire la photo de profil (retour à l'avatar par défaut)
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
 