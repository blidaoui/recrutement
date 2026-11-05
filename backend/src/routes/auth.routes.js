const express = require('express');
const passport = require('passport');
const rateLimit = require('express-rate-limit');
const {
  register,
  login,
  googleCallback,
  logout,
  getMe,
  updateProfile,
  deleteAccount,
  forgotPassword,
  resetPassword,
} = require('../controllers/auth.controller');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

// Rate limiting for auth endpoints to prevent brute-force and spam
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // Limit each IP to 10 requests per windowMs
  message: { message: 'Trop de tentatives. Veuillez réessayer plus tard.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Authentification classique par Email / Mot de passe
router.post('/register', authLimiter, register);
router.post('/login', authLimiter, login);

// Mot de passe oublié
router.post('/forgot-password', authLimiter, forgotPassword);
router.post('/reset-password/:token', authLimiter, resetPassword);

// Authentification Google OAuth 2.0
router.get('/google', passport.authenticate('google', { scope: ['profile', 'email'], prompt: 'select_account' }));

// Callback Google OAuth avec gestion d'erreur personnalisée (évite le crash 500 en cas d'identifiant/secret invalide)
router.get('/google/callback', (req, res, next) => {
  passport.authenticate('google', { session: false }, (err, user, info) => {
    if (err || !user) {
      console.error('Échec de l\'authentification Google OAuth:', err?.message || err || info);
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
      const errorCode = err?.message?.includes('mot de passe') ? 'email_exists' : 'google_failed';
      return res.redirect(`${frontendUrl}/login?error=${errorCode}`);
    }
    if (!user.actif) {
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
      return res.redirect(`${frontendUrl}/login?error=account_disabled&email=${encodeURIComponent(user.email)}`);
    }
    req.user = user;
    googleCallback(req, res);
  })(req, res, next);
});

router.post('/logout', logout);
router.get('/me', requireAuth, getMe);
router.put('/profile', requireAuth, updateProfile);
router.delete('/profile', requireAuth, deleteAccount);

module.exports = router;
