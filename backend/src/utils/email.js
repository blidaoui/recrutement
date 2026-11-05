const nodemailer = require('nodemailer');

/**
 * SMTP transporter configured via environment variables.
 * If no SMTP config is provided (e.g. in development), the reset link
 * is printed to the console instead of failing.
 */
function getTransporter() {
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS } = process.env;

  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) {
    return null;
  }

  return nodemailer.createTransport({
    host: SMTP_HOST,
    port: Number(SMTP_PORT) || 587,
    secure: Number(SMTP_PORT) === 465,
    auth: { user: SMTP_USER, pass: SMTP_PASS },
  });
}

async function sendResetPasswordEmail(to, nom, resetLink) {
  // In development, always log the link — useful for test accounts with fake emails
  if (process.env.NODE_ENV !== 'production') {
    console.log(`[email] Lien de réinitialisation pour ${to} :\n${resetLink}`);
  }

  const transporter = getTransporter();

  if (!transporter) {
    if (process.env.NODE_ENV === 'production') {
      console.warn(
        `[email] SMTP non configuré — lien de réinitialisation pour ${to} :\n${resetLink}`
      );
    }
    return;
  }

  // Never let email failures break the request — the link is already in the logs above
  try {
    await transporter.sendMail({
      from: process.env.SMTP_FROM || '"Plateforme IA Recrutement" <no-reply@example.com>',
      to,
      subject: 'Réinitialisation de votre mot de passe',
      html: `
        <p>Bonjour ${nom || ''},</p>
        <p>Vous avez demandé la réinitialisation de votre mot de passe.</p>
        <p><a href="${resetLink}">Cliquez ici pour choisir un nouveau mot de passe</a></p>
        <p>Ce lien expire dans 1 heure. Si vous n'êtes pas à l'origine de cette demande, ignorez cet email.</p>
      `,
    });
  } catch (err) {
    console.error(`[email] Échec de l'envoi à ${to} (le lien reste utilisable ci-dessus) :`, err.message);
  }
}

module.exports = { sendResetPasswordEmail };