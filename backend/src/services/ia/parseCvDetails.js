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

  // Extraction de téléphone
  // 1) Recherche avec préfixes courants (Tél, Téléphone, Mobile, Phone, Portable, Contact...)
  const labeledRegex = /(?:t[ée]l(?:[ée]phone)?|mobile|phone|portable|contact)[\s\w()/:.-]*[:\s-]\s*((?:(?:\+|00)\d{1,3}[\s.-]?(?:\(0\))?[\s.-]?|\(\+?\d{1,3}\)[\s.-]?)?(?:0|\b)[1-9](?:[\s.-]?\d){7,11}\b)/i;
  const labeledMatch = text.match(labeledRegex);

  let telephone = null;
  if (labeledMatch && labeledMatch[1]) {
    telephone = labeledMatch[1].trim();
  } else {
    // 2) Recherche globale avec indicatif international ou format national (sans capturer de dates)
    const generalRegex = /(?:(?:\+|00)\d{1,3}[\s.-]?(?:\(0\))?[\s.-]?|\(\+?\d{1,3}\)[\s.-]?)?(?:0|\b)[1-9](?:[\s.-]?\d){7,11}\b/;
    const generalMatch = text.match(generalRegex);
    telephone = generalMatch ? generalMatch[0].trim() : null;
  }

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
