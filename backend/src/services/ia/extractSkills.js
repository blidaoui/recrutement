const skillsReference = require('./skillsReference');

/**
 * Extrait les compétences reconnues à partir d'un texte brut (CV ou offre).
 * Approche : correspondance par variantes/synonymes, insensible à la casse,
 * avec vérification de "frontière de mot" pour éviter les faux positifs
 * (ex: "java" ne doit pas matcher dans "javascript").
 *
 * @param {string} texte
 * @returns {string[]} liste des compétences détectées (noms canoniques, sans doublons)
 */
function extractSkills(texte) {
  if (!texte) return [];

  const texteNormalise = texte.toLowerCase();
  const skillsDetectees = new Set();

  for (const { skill, variants } of skillsReference) {
    for (const variant of variants) {
      const variantEchappee = variant.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(`(?<![a-z0-9])${variantEchappee}(?![a-z0-9])`, 'i');

      if (regex.test(texteNormalise)) {
        skillsDetectees.add(skill);
        break; // pas besoin de tester les autres variantes de cette compétence
      }
    }
  }

  return Array.from(skillsDetectees);
}

module.exports = { extractSkills };
