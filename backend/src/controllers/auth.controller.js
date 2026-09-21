const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const prisma = require('../config/db');
const { sendResetPasswordEmail } = require('../utils/email');

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

// ── Mot de passe oublié ────────────────────────────────────────
// Étape 1 : l'utilisateur soumet son email, on génère un token à durée de vie limitée
async function forgotPassword(req, res) {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ message: 'Adresse email requise' });
    }

    const user = await prisma.user.findUnique({ where: { email } });

    // Réponse générique dans tous les cas, pour ne pas révéler si l'email existe en base
    const genericResponse = {
      message: 'Si un compte existe avec cet email, un lien de réinitialisation vient d\'être envoyé.',
    };

    if (!user) {
      return res.json(genericResponse);
    }

    // Token brut envoyé par email ; seul son hash est stocké en base (comme un mot de passe)
    const rawToken = crypto.randomBytes(32).toString('hex');
    const hashedToken = crypto.createHash('sha256').update(rawToken).digest('hex');
    const expires = new Date(Date.now() + 60 * 60 * 1000); // 1 heure

    await prisma.user.update({
      where: { id: user.id },
      data: {
        resetPasswordToken: hashedToken,
        resetPasswordExpires: expires,
      },
    });

    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    const resetLink = `${frontendUrl}/reset-password/${rawToken}`;

    await sendResetPasswordEmail(user.email, user.nom, resetLink);

    res.json(genericResponse);
  } catch (err) {
    console.error('Erreur mot de passe oublié:', err);
    res.status(500).json({ message: 'Erreur lors de la demande de réinitialisation' });
  }
}

// Étape 2 : l'utilisateur soumet le token reçu par email + son nouveau mot de passe
async function resetPassword(req, res) {
  try {
    const { token } = req.params;
    const { motDePasse } = req.body;

    if (!token || !motDePasse) {
      return res.status(400).json({ message: 'Token et nouveau mot de passe requis' });
    }
    if (motDePasse.length < 6) {
      return res.status(400).json({ message: 'Le mot de passe doit contenir au moins 6 caractères' });
    }

    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

    const user = await prisma.user.findFirst({
      where: {
        resetPasswordToken: hashedToken,
        resetPasswordExpires: { gt: new Date() },
      },
    });

    if (!user) {
      return res.status(400).json({ message: 'Lien de réinitialisation invalide ou expiré' });
    }

    const hashedPassword = await bcrypt.hash(motDePasse, 10);

    const updated = await prisma.user.update({
      where: { id: user.id },
      data: {
        motDePasse: hashedPassword,
        resetPasswordToken: null,
        resetPasswordExpires: null,
      },
    });

    // Connecte automatiquement l'utilisateur après la réinitialisation
    const authToken = generateToken(updated);
    setTokenCookie(res, authToken);

    const { motDePasse: _, ...userWithoutPassword } = updated;

    res.json({ message: 'Mot de passe réinitialisé avec succès', user: userWithoutPassword });
  } catch (err) {
    console.error('Erreur réinitialisation mot de passe:', err);
    res.status(500).json({ message: 'Erreur lors de la réinitialisation du mot de passe' });
  }
}

module.exports = {
  register,
  login,
  googleCallback,
  logout,
  getMe,
  generateToken,
  updateProfile,
  deleteAccount,
  forgotPassword,
  resetPassword,
};