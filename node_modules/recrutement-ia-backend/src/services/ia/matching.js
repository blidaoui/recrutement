/**
 * Calcule un score de matching entre les compétences d'un candidat et
 * celles requises par une offre.
 *
 * Formule : (nb compétences communes / nb compétences requises) x 100
 * Bonus léger pour les compétences supplémentaires du candidat (jusqu'à +10 pts),
 * pour valoriser un profil plus riche sans fausser le cœur du calcul.
 *
 * @param {string[]} skillsCandidat
 * @param {string[]} skillsRequises
 * @returns {{ score: number, skillsCommunes: string[], skillsManquantes: string[] }}
 */
function calculerScoreMatching(skillsCandidat, skillsRequises) {
  if (!skillsRequises || skillsRequises.length === 0) {
    return { score: 0, skillsCommunes: [], skillsManquantes: [] };
  }

  const candidatSet = new Set(skillsCandidat.map((s) => s.toLowerCase()));
  const requisesSet = new Set(skillsRequises.map((s) => s.toLowerCase()));

  const skillsCommunes = skillsRequises.filter((s) => candidatSet.has(s.toLowerCase()));
  const skillsManquantes = skillsRequises.filter((s) => !candidatSet.has(s.toLowerCase()));

  let score = (skillsCommunes.length / skillsRequises.length) * 100;

  // Bonus pour compétences additionnelles pertinentes (hors périmètre requis)
  const skillsSupplementaires = skillsCandidat.filter((s) => !requisesSet.has(s.toLowerCase()));
  const bonus = Math.min(skillsSupplementaires.length * 2, 10);

  score = Math.min(score + bonus, 100);

  return {
    score: Math.round(score * 100) / 100,
    skillsCommunes,
    skillsManquantes,
  };
}

module.exports = { calculerScoreMatching };
