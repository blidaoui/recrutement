const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const prisma = require('../config/db');

function generateToken(user) {
  return jwt.sign(
    { id: user.id, email: user.email, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
}

function setTokenCookie(res, token) {
  res.cookie('token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });
}

// Inscription classique Email / Mot de passe
async function register(req, res) {
  try {
    const { nom, email, motDePasse, role } = req.body;

    if (!nom || !email || !motDePasse) {
      return res.status(400).json({ message: 'Tous les champs obligatoires doivent être remplis' });
    }

    if (motDePasse.length < 6) {
      return res.status(400).json({ message: 'Le mot de passe doit contenir au moins 6 caractères' });
    }

    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return res.status(400).json({ message: 'Un compte avec cet email existe déjà' });
    }

    const hashedPassword = await bcrypt.hash(motDePasse, 10);
    const userRole = role === 'RECRUTEUR' ? 'RECRUTEUR' : 'CANDIDAT';

    const user = await prisma.user.create({
      data: {
        nom,
        email,
        motDePasse: hashedPassword,
        role: userRole,
      },
    });

    const token = generateToken(user);
    setTokenCookie(res, token);

    const { motDePasse: _, ...userWithoutPassword } = user;

    res.status(201).json({
      message: 'Inscription réussie',
      user: userWithoutPassword,
    });
  } catch (err) {
    console.error('Erreur inscription:', err);
    res.status(500).json({ message: 'Erreur lors de l\'inscription' });
  }
}

// Connexion classique Email / Mot de passe
async function login(req, res) {
  try {
    const { email, motDePasse } = req.body;

    if (!email || !motDePasse) {
      return res.status(400).json({ message: 'Email et mot de passe requis' });
    }

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !user.motDePasse) {
      return res.status(400).json({ message: 'Email ou mot de passe incorrect' });
    }

    const isMatch = await bcrypt.compare(motDePasse, user.motDePasse);
    if (!isMatch) {
      return res.status(400).json({ message: 'Email ou mot de passe incorrect' });
    }

    const token = generateToken(user);
    setTokenCookie(res, token);

    const { motDePasse: _, ...userWithoutPassword } = user;

    res.json({
      message: 'Connexion réussie',
      user: userWithoutPassword,
    });
  } catch (err) {
    console.error('Erreur connexion:', err);
    res.status(500).json({ message: 'Erreur lors de la connexion' });
  }
}

// Appelé après succès de l'authentification Google (passport)
function googleCallback(req, res) {
  const token = generateToken(req.user);
  setTokenCookie(res, token);
  res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:5173'}/offres`);
}

function logout(req, res) {
  res.clearCookie('token');
  req.logout?.(() => {});
  res.json({ message: 'Déconnexion réussie' });
}

function getMe(req, res) {
  if (!req.user) return res.status(401).json({ message: 'Non authentifié' });
  const { motDePasse: _, ...userWithoutPassword } = req.user;
  res.json({ user: userWithoutPassword });
}

async function updateProfile(req, res) {
  try {
    const { nom, email, motDePasse } = req.body;
    const userId = req.user.id;

    const data = {};
    if (nom?.trim()) data.nom = nom.trim();
    if (email?.trim()) {
      const existing = await prisma.user.findUnique({ where: { email: email.trim() } });
      if (existing && existing.id !== userId)
        return res.status(400).json({ message: 'Cet email est déjà utilisé par un autre compte' });
      data.email = email.trim();
    }
    if (motDePasse) {
      if (motDePasse.length < 6)
        return res.status(400).json({ message: 'Le mot de passe doit contenir au moins 6 caractères' });
      data.motDePasse = await bcrypt.hash(motDePasse, 10);
    }

    const updated = await prisma.user.update({ where: { id: userId }, data });
    const { motDePasse: _, ...userWithoutPassword } = updated;
    res.json({ message: 'Profil mis à jour avec succès', user: userWithoutPassword });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Erreur lors de la mise à jour du profil' });
  }
}

async function deleteAccount(req, res) {
  try {
    const userId = req.user.id;
    if (req.user.role === 'ADMIN')
      return res.status(403).json({ message: 'Le compte administrateur ne peut pas être supprimé' });

    await prisma.candidature.deleteMany({ where: { candidatId: userId } });
    await prisma.cV.deleteMany({ where: { candidatId: userId } });
    await prisma.offre.deleteMany({ where: { recruteurId: userId } });
    await prisma.user.delete({ where: { id: userId } });

    res.clearCookie('token');
    res.json({ message: 'Compte supprimé avec succès' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Erreur lors de la suppression du compte' });
  }
}

module.exports = { register, login, googleCallback, logout, getMe, generateToken, updateProfile, deleteAccount };
