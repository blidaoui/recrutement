const prisma = require('../config/db');
const { extractSkills } = require('../services/ia/extractSkills');

// POST /api/offres - le recruteur ou l'admin crée une offre
async function creerOffre(req, res) {
  try {
    const { titre, entreprise, description, skillsObligatoires, skillsSouhaitees, experienceMin, niveauEtude, langues, salaire, pays, typeContrat, statut } = req.body;

    if (!titre || !description) {
      return res.status(400).json({ message: 'Titre et description requis' });
    }

    const parseSkills = (val) => {
      if (Array.isArray(val)) return val.map(s => String(s).trim()).filter(Boolean);
      if (typeof val === 'string' && val.trim()) return val.split(',').map(s => s.trim()).filter(Boolean);
      return [];
    };

    const obligatoires = parseSkills(skillsObligatoires);
    const souhaitees = parseSkills(skillsSouhaitees);
    const extracted = extractSkills(description);
    const allSkills = Array.from(new Set([...obligatoires, ...souhaitees, ...extracted]));
    const parsedLangues = parseSkills(langues);

    const offre = await prisma.offre.create({
      data: {
        recruteurId: req.user.id,
        titre,
        entreprise: entreprise || null,
        description,
        skillsRequises: allSkills,
        skillsObligatoires: obligatoires,
        skillsSouhaitees: souhaitees,
        experienceMin: experienceMin !== undefined && String(experienceMin).trim() !== '' ? String(experienceMin).trim() : '0',
        niveauEtude: niveauEtude || 'Non précisé',
        langues: parsedLangues,
        salaire: salaire ? Number(salaire) : null,
        pays: pays || 'Non précisé',
        typeContrat: typeContrat || 'Non précisé',
        statut: statut || 'ouverte',
      },
    });

    res.status(201).json({ offre, message: 'Offre créée avec succès' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Erreur lors de la création de l'offre" });
  }
}

// GET /api/offres - liste publique des offres
async function listerOffres(req, res) {
  try {
    const offres = await prisma.offre.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        recruteur: { select: { nom: true, email: true } },
        candidatures: { select: { id: true, candidatId: true } },
      },
    });
    res.json({ offres });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Erreur lors de la récupération des offres' });
  }
}

// GET /api/offres/:id
async function getOffre(req, res) {
  try {
    const offre = await prisma.offre.findUnique({
      where: { id: Number(req.params.id) },
      include: {
        recruteur: { select: { nom: true, email: true } },
        candidatures: true,
      },
    });

    if (!offre) return res.status(404).json({ message: 'Offre introuvable' });
    res.json({ offre });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Erreur lors de la récupération de l\'offre' });
  }
}

// PUT /api/offres/:id
async function modifierOffre(req, res) {
  try {
    const offreId = Number(req.params.id);
    const { titre, entreprise, description, skillsObligatoires, skillsSouhaitees, experienceMin, niveauEtude, langues, salaire, pays, typeContrat, statut } = req.body;

    const offreExistante = await prisma.offre.findUnique({ where: { id: offreId } });
    if (!offreExistante) return res.status(404).json({ message: 'Offre introuvable' });
    if (req.user.role !== 'ADMIN' && offreExistante.recruteurId !== req.user.id)
      return res.status(403).json({ message: "Vous n'avez pas l'autorisation de modifier cette offre" });

    const parseSkills = (val) => {
      if (Array.isArray(val)) return val.map(s => String(s).trim()).filter(Boolean);
      if (typeof val === 'string' && val.trim()) return val.split(',').map(s => s.trim()).filter(Boolean);
      return [];
    };

    const obligatoires = skillsObligatoires !== undefined ? parseSkills(skillsObligatoires) : offreExistante.skillsObligatoires;
    const souhaitees = skillsSouhaitees !== undefined ? parseSkills(skillsSouhaitees) : offreExistante.skillsSouhaitees;
    const desc = description || offreExistante.description;
    const extracted = extractSkills(desc);
    const allSkills = Array.from(new Set([...obligatoires, ...souhaitees, ...extracted]));
    const parsedLangues = langues !== undefined ? parseSkills(langues) : offreExistante.langues;

    const offreModifiee = await prisma.offre.update({
      where: { id: offreId },
      data: {
        titre: titre || offreExistante.titre,
        entreprise: entreprise !== undefined ? entreprise : offreExistante.entreprise,
        description: desc,
        skillsRequises: allSkills,
        skillsObligatoires: obligatoires,
        skillsSouhaitees: souhaitees,
        experienceMin: experienceMin !== undefined ? String(experienceMin).trim() : offreExistante.experienceMin,
        niveauEtude: niveauEtude || offreExistante.niveauEtude,
        langues: parsedLangues,
        salaire: salaire !== undefined ? (salaire ? Number(salaire) : null) : offreExistante.salaire,
        pays: pays !== undefined ? (pays || 'Non précisé') : offreExistante.pays,
        typeContrat: typeContrat !== undefined ? (typeContrat || 'Non précisé') : offreExistante.typeContrat,
        statut: statut || offreExistante.statut,
      },
    });

    res.json({ offre: offreModifiee, message: 'Offre mise à jour avec succès' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Erreur lors de la modification de l\'offre' });
  }
}

// DELETE /api/offres/:id - Le recruteur (propriétaire) ou l'ADMIN peut supprimer une offre
async function supprimerOffre(req, res) {
  try {
    const offreId = Number(req.params.id);

    const offreExistante = await prisma.offre.findUnique({ where: { id: offreId } });
    if (!offreExistante) {
      return res.status(404).json({ message: 'Offre introuvable' });
    }

    if (req.user.role !== 'ADMIN' && offreExistante.recruteurId !== req.user.id) {
      return res.status(403).json({ message: 'Vous n\'avez pas l\'autorisation de supprimer cette offre' });
    }

    // Supprimer d'abord les candidatures liées à cette offre pour intégrité référentielle
    await prisma.candidature.deleteMany({ where: { offreId } });

    // Supprimer l'offre
    await prisma.offre.delete({ where: { id: offreId } });

    res.json({ message: 'Offre supprimée avec succès' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Erreur lors de la suppression de l\'offre' });
  }
}

module.exports = {
  creerOffre,
  listerOffres,
  getOffre,
  modifierOffre,
  supprimerOffre,
};