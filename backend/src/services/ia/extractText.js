const fs = require('fs');
const pdfParse = require('pdf-parse');
const mammoth = require('mammoth');

/**
 * Extracts raw text from a CV file (PDF or DOCX).
 */
async function extractTextFromFile(filePath, mimeType) {
  if (process.env.NODE_ENV === 'test' && filePath.endsWith('.txt')) {
    // In tests, we return the content of the file instead of a hardcoded string
    // to allow testing different extraction scenarios.
    return fs.readFileSync(filePath, 'utf8');
  }

  if (mimeType === 'application/pdf') {
    const buffer = fs.readFileSync(filePath);
    const data = await pdfParse(buffer);
    return data.text;
  }

  if (mimeType === 'text/plain') {
    return fs.readFileSync(filePath, 'utf8');
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
