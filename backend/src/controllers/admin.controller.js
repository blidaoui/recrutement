const prisma = require('../config/db');
const bcrypt = require('bcryptjs');

const SUPER_ADMIN_EMAIL = 'admin@admin.com';

const isSuperAdminUser = (user) => user && user.email && user.email.toLowerCase() === SUPER_ADMIN_EMAIL;

async function listerUtilisateurs(req, res) {
  try {
    const { role, search } = req.query;
    const where = {};
    if (role && role !== 'TOUS') where.role = role;
    if (search) {
      where.OR = [
        { nom: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ];
    }

    const users = await prisma.user.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true, nom: true, email: true, role: true, actif: true, createdAt: true,
        _count: { select: { cvs: true, candidatures: true, offres: true } },
      },
    });

    res.json({ users, total: users.length });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Erreur lors de la récupération des utilisateurs' });
  }
}

async function creerUtilisateur(req, res) {
  try {
    const { nom, email, motDePasse, role } = req.body;

    if (!nom || !email || !motDePasse) {
      return res.status(400).json({ message: 'Le nom, l\'email et le mot de passe sont obligatoires' });
    }

    if (motDePasse.length < 6) {
      return res.status(400).json({ message: 'Le mot de passe doit contenir au moins 6 caractères' });
    }

    const rolesValides = ['CANDIDAT', 'RECRUTEUR', 'ADMIN'];
    const userRole = rolesValides.includes(role) ? role : 'CANDIDAT';

    const existingUser = await prisma.user.findUnique({ where: { email: email.trim() } });
    if (existingUser) {
      return res.status(400).json({ message: 'Un compte avec cet email existe déjà' });
    }

    const hashedPassword = await bcrypt.hash(motDePasse, 10);

    const user = await prisma.user.create({
      data: {
        nom: nom.trim(),
        email: email.trim(),
        motDePasse: hashedPassword,
        role: userRole,
      },
      select: {
        id: true,
        nom: true,
        email: true,
        role: true,
        actif: true,
        createdAt: true,
        _count: { select: { cvs: true, candidatures: true, offres: true } },
      },
    });

    res.status(201).json({
      message: 'Compte créé avec succès',
      user,
    });
  } catch (err) {
    console.error('Erreur création utilisateur admin:', err);
    res.status(500).json({ message: 'Erreur lors de la création du compte' });
  }
}

async function toggleActif(req, res) {
  try {
    const id = Number(req.params.id);
    if (id === req.user.id) return res.status(400).json({ message: 'Impossible de modifier votre propre compte' });

    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) return res.status(404).json({ message: 'Utilisateur introuvable' });
    if (isSuperAdminUser(user)) return res.status(403).json({ message: 'Impossible de modifier le compte super admin' });
    if (user.role === 'ADMIN') return res.status(403).json({ message: 'Impossible de modifier un compte administrateur' });

    const updated = await prisma.user.update({ where: { id }, data: { actif: !user.actif } });
    res.json({ message: `Compte ${updated.actif ? 'activé' : 'désactivé'}`, actif: updated.actif });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Erreur lors de la mise à jour' });
  }
}

async function supprimerUtilisateur(req, res) {
  try {
    const id = Number(req.params.id);
    if (id === req.user.id) return res.status(400).json({ message: 'Impossible de supprimer votre propre compte' });

    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) return res.status(404).json({ message: 'Utilisateur introuvable' });
    if (isSuperAdminUser(user)) return res.status(403).json({ message: 'Impossible de supprimer le compte super admin' });
    if (user.role === 'ADMIN') return res.status(403).json({ message: 'Impossible de supprimer un compte administrateur' });
    await prisma.cV.deleteMany({ where: { candidatId: id } });
    const offres = await prisma.offre.findMany({ where: { recruteurId: id }, select: { id: true } });
    for (const o of offres) {
      await prisma.candidature.deleteMany({ where: { offreId: o.id } });
    }
    await prisma.offre.deleteMany({ where: { recruteurId: id } });
    await prisma.user.delete({ where: { id } });

    res.json({ message: 'Utilisateur supprimé' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Erreur lors de la suppression' });
  }
}

module.exports = { listerUtilisateurs, toggleActif, supprimerUtilisateur, creerUtilisateur };

