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
  const fileUrl = fileName ? `/cv/download/${fileName}` : null;

  return {
    id: cv.id,
    candidatId: cv.candidatId,
    skillsExtraites: cv.skillsExtraites || [],
    texteExtrait: cv.texteExtrait || '',
    previewText: parsed.previewText,
    emailExtrait: parsed.email,
    telephoneExtrait: parsed.telephone,
    nomFichier: cv.nomFichier || null,
    fileUrl,
    createdAt: cv.createdAt,
  };
}

// POST /api/cv/upload - le candidat uploade son CV
async function uploadCV(req, res) {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'Aucun fichier fourni' });
    }

    const texteExtrait = await extractTextFromFile(req.file.path, req.file.mimetype);
    const skillsExtraites = extractSkills(texteExtrait);

    const cv = await prisma.cV.create({
      data: {
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

module.exports = { uploadCV, getMesCV, telechargerCV, formatCvResponse };
