const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const prisma = require('./db');

passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID || 'dummy_id',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || 'dummy_secret',
      callbackURL: process.env.GOOGLE_CALLBACK_URL || 'http://localhost:5000/api/auth/google/callback',
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        const email = profile?.emails?.[0]?.value;

        if (!email) {
          return done(new Error('Impossible d\'obtenir l\'adresse email depuis le compte Google'), null);
        }

        let user = await prisma.user.findUnique({ where: { googleId: profile.id } });

        if (!user) {
          user = await prisma.user.findUnique({ where: { email } });
        }

        if (!user) {
          user = await prisma.user.create({
            data: {
              nom: profile.displayName || email.split('@')[0],
              email,
              googleId: profile.id,
              role: 'CANDIDAT',
            },
          });
        } else if (!user.googleId) {
          return done(new Error('Un compte avec cet email existe déjà. Veuillez vous connecter avec votre mot de passe.'), null);
        }

        return done(null, user);
      } catch (err) {
        console.error('Erreur Passport Google Strategy:', err);
        return done(err, null);
      }
    }
  )
);

passport.serializeUser((user, done) => done(null, user.id));

passport.deserializeUser(async (id, done) => {
  try {
    const user = await prisma.user.findUnique({ where: { id } });
    done(null, user);
  } catch (err) {
    done(err, null);
  }
});

module.exports = passport;
