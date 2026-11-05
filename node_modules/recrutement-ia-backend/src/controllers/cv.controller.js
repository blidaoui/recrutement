const fs = require('fs');
const path = require('path');
const prisma = require('../config/db');
const { extractTextFromFile } = require('../services/ia/extractText');
const { extractSkills } = require('../services/ia/extractSkills');
const { parseCvDetails } = require('../services/ia/parseCvDetails');
const { isValidEmail } = require('../utils/emailValidation');

function formatCvResponse(cv) {
  if (!cv) return null;

  const parsed = parseCvDetails(cv.texteExtrait);
  const fileName = cv.urlFichier ? path.basename(cv.urlFichier) : null;
  // Prefix is /cv/download/ — the axios baseURL already includes /api,
  // so the final URL becomes /api/cv/download/:filename as expected.
  const fileUrl = fileName ? `/cv/download/${fileName}` : null;

  return {
    id: cv.id,
    candidatId: cv.candidatId,
    skillsExtraites: cv.skillsExtraites || [],
    texteExtrait: cv.texteExtrait || '',
    previewText: parsed.previewText,
    // Les coordonnées éditées manuellement (via PUT /cv/contact) priment sur
    // celles extraites automatiquement du texte du CV.
    emailExtrait: cv.emailOverride || parsed.email,
    telephoneExtrait: cv.telephoneOverride || parsed.telephone,
    emailDetecte: parsed.email,
    telephoneDetecte: parsed.telephone,
    hasOverride: Boolean(cv.emailOverride || cv.telephoneOverride),
    nomFichier: cv.nomFichier || null,
    fileUrl,
    createdAt: cv.createdAt,
  };
}

// POST /api/cv/upload - le candidat uploade son CV (remplace le précédent s'il existe)
async function uploadCV(req, res) {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'Aucun fichier fourni' });
    }

    const texteExtrait = await extractTextFromFile(req.file.path, req.file.mimetype);
    const skillsExtraites = await extractSkills(texteExtrait);

    // One CV per candidate: delete the old file before upserting
    const ancien = await prisma.cV.findUnique({ where: { candidatId: req.user.id } });
    if (ancien?.urlFichier) {
      fs.unlink(path.resolve(ancien.urlFichier), (err) => {
        if (err && err.code !== 'ENOENT') console.warn('Impossible de supprimer l\'ancien CV:', err.message);
      });
    }

    // Réinitialisation des surcharges manuelles lors du dépôt d'un nouveau CV
    const cv = await prisma.cV.upsert({
      where: { candidatId: req.user.id },
      update: {
        urlFichier: req.file.path,
        nomFichier: req.file.originalname,
        texteExtrait,
        skillsExtraites,
        emailOverride: null,
        telephoneOverride: null,
      },
      create: {
        candidatId: req.user.id,
        urlFichier: req.file.path,
        nomFichier: req.file.originalname,
        texteExtrait,
        skillsExtraites,
        emailOverride: null,
        telephoneOverride: null,
      },
    });

    res.status(201).json({
      message: 'CV analysé avec succès',
      cv: formatCvResponse(cv),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Erreur lors de l'analyse du CV", error: err.message });
  }
}

// GET /api/cv/mes-cv - liste des CV du candidat connecté
async function getMesCV(req, res) {
  try {
    const cvs = await prisma.cV.findMany({
      where: { candidatId: req.user.id },
      orderBy: { createdAt: 'desc' },
    });

    const formattedCvs = cvs.map(formatCvResponse);
    res.json({ cvs: formattedCvs });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Erreur lors de la récupération des CVs' });
  }
}

// GET /api/cv/download/:filename - télécharger / afficher le fichier du CV
async function telechargerCV(req, res) {
  try {
    const safeFileName = path.basename(req.params.filename);
    const filePath = path.resolve(__dirname, '../uploads', safeFileName);

    if (!fs.existsSync(filePath)) {
      return res.status(404).send('Fichier CV introuvable');
    }

    // Retrouver le CV en base pour connaître le nom et type d'origine
    const cv = await prisma.cV.findFirst({ where: { urlFichier: { contains: safeFileName } } });
    const originalName = cv?.nomFichier || safeFileName;
    const ext = (safeFileName.split('.').pop() || '').toLowerCase();
    const contentType = ext === 'pdf' ? 'application/pdf'
      : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `inline; filename="${originalName}"`);
    fs.createReadStream(filePath).pipe(res);
  } catch (err) {
    console.error('Erreur téléchargement CV:', err);
    res.status(500).send('Erreur lors du téléchargement');
  }
}

// PUT /api/cv/contact — candidate manually corrects email/phone extracted from their CV,
// or resets them to the automatically extracted values from the CV.
async function updateContact(req, res) {
  try {
    const { telephoneExtrait, emailExtrait, resetToCv } = req.body;

    if (resetToCv) {
      const cv = await prisma.cV.update({
        where: { candidatId: req.user.id },
        data: {
          telephoneOverride: null,
          emailOverride: null,
        },
      });
      return res.json({ message: 'Coordonnées réinitialisées depuis le CV', cv: formatCvResponse(cv) });
    }

    const telephone = telephoneExtrait == null ? '' : String(telephoneExtrait).trim();
    const email = emailExtrait == null ? '' : String(emailExtrait).trim();

    if (telephone) {
      const digitsOnly = telephone.replace(/\D/g, '');
      if (digitsOnly.length < 8 || digitsOnly.length > 15) {
        return res.status(400).json({ message: 'Le téléphone doit contenir entre 8 et 15 chiffres.' });
      }
    }

    if (emailExtrait !== undefined && email && !isValidEmail(email)) {
      return res.status(400).json({ message: 'Adresse email invalide. Exemple : sarah.benali@talent.tn' });
    }
 
    const cv = await prisma.cV.update({
      where: { candidatId: req.user.id },
      data: {
        ...(telephoneExtrait !== undefined && { telephoneOverride: telephone || null }),
        ...(emailExtrait !== undefined && { emailOverride: email || null }),
      },
    });
 
    res.json({ message: 'Coordonnées mises à jour', cv: formatCvResponse(cv) });
  } catch (err) {
    if (err.code === 'P2025') {
      return res.status(404).json({ message: 'Aucun CV trouvé pour cet utilisateur' });
    }
    console.error(err);
    res.status(500).json({ message: 'Erreur lors de la mise à jour des coordonnées' });
  }
}
 
module.exports = { uploadCV, getMesCV, telechargerCV, updateContact, formatCvResponse };
