/**
 * Extrait les coordonnées (email, téléphone, aperçu) depuis le texte brut d'un CV.
 * @param {string} rawText
 * @returns {{ email: string|null, telephone: string|null, previewText: string, fullText: string }}
 */
function parseCvDetails(rawText) {
  if (!rawText || typeof rawText !== 'string') {
    return { email: null, telephone: null, previewText: '', fullText: '' };
  }

  const text = rawText.trim();

  // Extraction d'email
  const emailMatch = text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/i);
  const email = emailMatch ? emailMatch[0] : null;

  // Extraction de téléphone (formats FR / Maroc / Intl: +33 6..., 06..., +212...)
  const phoneMatch = text.match(/(?:(?:\+|00)\d{1,3}[-.\s]?)?0[1-9](?:[-.\s]?\d{2}){4}|(?:\+\d{1,3}[-.\s]?)?\d{8,12}/);
  const telephone = phoneMatch ? phoneMatch[0].trim() : null;

  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  const previewText = lines.slice(0, 12).join('\n');

  return {
    email,
    telephone,
    previewText: previewText.length > 400 ? previewText.substring(0, 400) + '...' : previewText,
    fullText: text,
  };
}

module.exports = { parseCvDetails };
