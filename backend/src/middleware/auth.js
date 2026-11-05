const jwt = require('jsonwebtoken');
const prisma = require('../config/db');

/**
 * Reads JWT from httpOnly cookie or Authorization: Bearer header.
 * Attaches the full user object to req.user on success.
 */
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

/**
 * Role guard — usage: requireRole('RECRUTEUR') or requireRole('RECRUTEUR', 'ADMIN')
 */
function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ message: 'Accès interdit pour ce rôle' });
    }
    next();
  };
}

module.exports = { requireAuth, requireRole };
