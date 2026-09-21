const nodemailer = require('nodemailer');

// Transporteur SMTP configuré via variables d'environnement.
// Si aucune config SMTP n'est fournie (ex: en développement), on se contente
// d'afficher le lien de réinitialisation dans la console au lieu d'échouer.
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
  // En développement, on affiche toujours le lien dans la console, même si le
  // SMTP est configuré : pratique pour les comptes de test dont l'adresse
  // email est fictive et ne peut de toute façon rien recevoir.
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

  // L'envoi réel ne doit jamais faire échouer la requête : si l'adresse est
  // invalide/fictive (comptes de test) ou que le SMTP a un souci ponctuel,
  // le lien reste de toute façon disponible dans les logs ci-dessus.
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