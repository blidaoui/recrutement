/**
 * Calculates a matching score between a candidate's skills and a job offer's required skills.
 *
 * Score = (matched skills / required skills) * 100
 * Bonus up to +10 pts for extra skills the candidate has beyond the requirements,
 * rewarding a richer profile without distorting the core calculation.
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

  // Bonus for extra skills the candidate has beyond the required set
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
