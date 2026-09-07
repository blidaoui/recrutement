const jwt = require('jsonwebtoken');
const prisma = require('../config/db');

// Vérifie le JWT envoyé dans le cookie httpOnly ou le header Authorization
async function requireAuth(req, res, next) {
  try {
    const token =
      req.cookies?.token ||
      (req.headers.authorization?.startsWith('Bearer ')
        ? req.headers.authorization.split(' ')[1]
        : null);

    if (!token) {
      return res.status(401).json({ message: 'Authentification requise' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await prisma.user.findUnique({ where: { id: decoded.id } });

    if (!user) {
      return res.status(401).json({ message: 'Utilisateur introuvable' });
    }

    if (!user.actif) {
      return res.status(403).json({ message: 'Compte désactivé' });
    }

    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({ message: 'Token invalide ou expiré' });
  }
}

// Restreint l'accès à certains rôles (ex: requireRole('RECRUTEUR'))
function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ message: 'Accès interdit pour ce rôle' });
    }
    next();
  };
}

module.exports = { requireAuth, requireRole };
