const fs = require('fs');
const pdfParse = require('pdf-parse');
const mammoth = require('mammoth');

/**
 * Extrait le texte brut d'un fichier CV (PDF ou DOCX).
 * @param {string} filePath - chemin du fichier sur le disque
 * @param {string} mimeType - type MIME du fichier uploadé
 * @returns {Promise<string>} texte brut extrait
 */
async function extractTextFromFile(filePath, mimeType) {
  if (mimeType === 'application/pdf') {
    const buffer = fs.readFileSync(filePath);
    const data = await pdfParse(buffer);
    return data.text;
  }

  if (
    mimeType ===
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ) {
    const result = await mammoth.extractRawText({ path: filePath });
    return result.value;
  }

  throw new Error('Format de fichier non supporté (PDF ou DOCX uniquement)');
}

module.exports = { extractTextFromFile };
