/**
 * Intelligent multilingual search matcher with accent normalization,
 * English <-> French translations, synonyms, and typo tolerance.
 */

export function normalizeText(str) {
  return String(str || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // remove diacritics / accents
    .replace(/[^a-z0-9\s]/g, ' ')   // replace hyphens/punctuations with spaces
    .replace(/\s+/g, ' ')
    .trim();
}

function levenshtein(a, b) {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  const matrix = Array.from({ length: a.length + 1 }, () => new Array(b.length + 1).fill(0));
  for (let i = 0; i <= a.length; i++) matrix[i][0] = i;
  for (let j = 0; j <= b.length; j++) matrix[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost
      );
    }
  }
  return matrix[a.length][b.length];
}

/**
 * Synonym & Multilingual equivalence groups (FR <-> EN <-> Stems <-> Common typos)
 */
export const SYNONYM_GROUPS = [
  // Tech & Software
  ['developpeur', 'developpeuse', 'developer', 'developper', 'development', 'developpement', 'dev', 'software engineer', 'programmeur', 'codeur'],
  ['ingenieur', 'ingenieure', 'engineer', 'engineering', 'ingenierie'],
  ['front end', 'frontend', 'front'],
  ['back end', 'backend', 'back'],
  ['full stack', 'fullstack'],
  ['react', 'reactjs', 'react js'],
  ['node', 'nodejs', 'node js'],
  ['vue', 'vuejs', 'vue js'],
  ['angular', 'angularjs'],
  ['python', 'py'],
  ['chef de projet', 'project manager', 'product owner', 'scrum master', 'lead project', 'po', 'pm'],
  ['responsable', 'manager', 'lead', 'directeur', 'director', 'superviseur'],
  ['commercial', 'commerciale', 'sales', 'vendeur', 'vendeuse', 'business developer', 'bizdev'],
  ['recruteur', 'recruteuse', 'recruiter', 'rh', 'talent acquisition', 'human resources', 'hr'],
  ['stage', 'stagiaire', 'intern', 'internship', 'alternance', 'apprenti'],
  ['administrateur', 'admin', 'administrator', 'sysadmin', 'system administrator', 'devops', 'cloud'],
  ['designer', 'concepteur', 'graphiste', 'ux', 'ui', 'webdesigner', 'infographiste'],
  ['donnees', 'data', 'big data', 'data scientist', 'data analyst'],
  ['securite', 'security', 'cybersecurite', 'cybersecurity'],
  ['testeur', 'tester', 'qa', 'qualite', 'quality assurance'],

  // Métiers & Secteurs
  ['plombier', 'plomberie', 'plumber', 'sanitaire', 'chauffagiste'],
  ['macon', 'maconnerie', 'mason', 'aide macon', 'construction', 'batiment'],
  ['carreleur', 'carrelage', 'poseur', 'mosaique'],
  ['electricien', 'electricite', 'electrician'],
  ['comptable', 'comptabilite', 'accountant', 'accounting', 'finance', 'financier'],
  ['infirmier', 'infirmiere', 'nurse', 'soignant', 'sante', 'medical'],
  ['assistant', 'assistante', 'secretaire', 'secretary', 'adjointe'],
  ['chauffeur', 'conducteur', 'driver', 'livreur', 'transport'],
  ['mecanicien', 'mecanique', 'mechanic'],
  ['enseignant', 'professeur', 'formateur', 'teacher', 'trainer', 'educateur']
];

export function getSynonymsForWord(word) {
  const norm = normalizeText(word);
  const result = new Set([norm]);
  for (const group of SYNONYM_GROUPS) {
    const normGroup = group.map(normalizeText);
    if (normGroup.some((item) => item === norm || item.split(' ').includes(norm))) {
      normGroup.forEach((item) => result.add(item));
    }
  }
  return Array.from(result);
}

/**
 * Checks whether an offer matches the search query using accent-insensitive,
 * multilingual, synonym, and typo-tolerant matching.
 */
export function matchOfferSearch(offer, query) {
  const normQuery = normalizeText(query);
  if (!normQuery) return true;

  const searchableText = normalizeText([
    offer.titre,
    offer.entreprise,
    offer.description,
    offer.pays,
    offer.typeContrat,
    offer.niveauEtude,
    ...(offer.skillsRequises || []),
    ...(offer.skillsObligatoires || []),
    ...(offer.skillsSouhaitees || []),
    ...(offer.langues || [])
  ].filter(Boolean).join(' '));

  const offerWords = searchableText.split(' ').filter(Boolean);
  const queryTokens = normQuery.split(' ').filter(Boolean);

  return queryTokens.every((token) => {
    const synonyms = getSynonymsForWord(token);

    // 1. Direct or synonym match
    const hasWordOrPhraseMatch = synonyms.some((syn) => {
      if (syn.includes(' ')) {
        return searchableText.includes(syn);
      }
      if (syn.length <= 3) {
        return offerWords.includes(syn);
      }
      return offerWords.some((w) => w.includes(syn));
    });

    if (hasWordOrPhraseMatch) return true;

    // 2. Fuzzy / Typo match on individual words (prefix or Levenshtein distance <= 1)
    return synonyms.some((syn) => {
      if (syn.length < 5) return false;
      return offerWords.some((w) => {
        if (w.length < 5) return false;
        // Common prefix match of 5 characters
        if (w.slice(0, 5) === syn.slice(0, 5)) return true;
        // Levenshtein distance <= 1 for 1-letter typos
        if (Math.abs(w.length - syn.length) <= 1) {
          return levenshtein(w, syn) <= 1;
        }
        return false;
      });
    });
  });
}

