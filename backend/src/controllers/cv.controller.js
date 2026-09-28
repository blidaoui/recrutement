const fs = require('fs');
const path = require('path');
const prisma = require('../config/db');
const { extractTextFromFile } = require('../services/ia/extractText');
const { extractSkills } = require('../services/ia/extractSkills');
const { parseCvDetails } = require('../services/ia/parseCvDetails');

function formatCvResponse(cv) {
  if (!cv) return null;

  const parsed = parseCvDetails(cv.texteExtrait);
  const fileName = cv.urlFichier ? path.basename(cv.urlFichier) : null;
  // Le client utilise déjà une base URL /api ; on ne répète pas le préfixe ici pour
  // éviter d'obtenir des URL du type /api/api/cv/download/... dans le front.
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
    const skillsExtraites = extractSkills(texteExtrait);

    // Un seul CV par candidat : on supprime l'ancien fichier physique s'il existe,
    // puis on upsert plutôt que de créer une nouvelle ligne à chaque envoi.
    const ancien = await prisma.cV.findUnique({ where: { candidatId: req.user.id } });
    if (ancien?.urlFichier) {
      fs.unlink(path.resolve(ancien.urlFichier), (err) => {
        if (err && err.code !== 'ENOENT') console.warn('Impossible de supprimer l\'ancien CV:', err.message);
      });
    }

    const cv = await prisma.cV.upsert({
      where: { candidatId: req.user.id },
      update: {
        urlFichier: req.file.path,
        nomFichier: req.file.originalname,
        texteExtrait,
        skillsExtraites,
      },
      create: {
        candidatId: req.user.id,
        urlFichier: req.file.path,
        nomFichier: req.file.originalname,
        texteExtrait,
        skillsExtraites,
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

// PUT /api/cv/contact - le candidat corrige manuellement l'email/téléphone
// extraits automatiquement de son CV (ces valeurs priment ensuite sur l'extraction IA)
async function updateContact(req, res) {
  try {
    const { telephoneExtrait, emailExtrait } = req.body;
 
    const cv = await prisma.cV.update({
      where: { candidatId: req.user.id },
      data: {
        ...(telephoneExtrait !== undefined && { telephoneOverride: telephoneExtrait }),
        ...(emailExtrait !== undefined && { emailOverride: emailExtrait }),
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