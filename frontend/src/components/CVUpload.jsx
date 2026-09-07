import { useState } from 'react';
import api from '../api/axios';

export default function CVUpload({ activeCv, onUploaded }) {
  const [fichier, setFichier] = useState(null);
  const [chargement, setChargement] = useState(false);
  const [erreur, setErreur] = useState(null);
  const [succes, setSucces] = useState('');
  const [showUploadForm, setShowUploadForm] = useState(!activeCv);
  const [showFullText, setShowFullText] = useState(false);

  const handleDownload = async (fileUrl, fileName) => {
    try {
      const res = await api.get(fileUrl, { responseType: 'blob' });
      const contentType = res.headers['content-type'] || '';
      const ext = contentType.includes('pdf') ? '.pdf' : '.docx';
      const safeName = fileName
        ? (fileName.endsWith('.pdf') || fileName.endsWith('.docx') ? fileName : fileName + ext)
        : `cv${ext}`;
      const url = window.URL.createObjectURL(new Blob([res.data], { type: contentType }));
      const a = document.createElement('a');
      a.href = url;
      a.download = safeName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch {
      alert('Erreur lors du téléchargement du fichier');
    }
  };

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!fichier) return;

    setChargement(true);
    setErreur(null);
    setSucces('');

    const formData = new FormData();
    formData.append('cv', fichier);

    try {
      const res = await api.post('/cv/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setSucces('CV analysé et enregistré avec succès !');
      setFichier(null);
      setShowUploadForm(false);
      onUploaded?.(res.data.cv);
    } catch (err) {
      setErreur(err.response?.data?.message || 'Erreur lors de l\'upload');
    } finally {
      setChargement(false);
    }
  };

  return (
    <div className="cv-management-card">
      {activeCv && !showUploadForm ? (
        <div className="active-cv-box">
          <div className="active-cv-header">
            <div>
              <span className="active-badge"> CV Actif</span>
              <h4 className="cv-date">
                Mis à jour le {new Date(activeCv.createdAt).toLocaleDateString('fr-FR', {
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit'
                })}
              </h4>
            </div>
            <button
              type="button"
              className="btn-update-cv"
              onClick={() => setShowUploadForm(true)}
            >
               Mettre à jour mon CV
            </button>
          </div>

          {/* Informations de contact extraites du CV */}
          <div className="cv-contact-details">
            <h5 className="details-section-title"> Coordonnées extraites du CV</h5>
            <div className="contact-grid">
              <div className="contact-item">
                <span className="contact-label"> Email détecté :</span>
                <span className="contact-value">{activeCv.emailExtrait || 'Non spécifié'}</span>
              </div>
              <div className="contact-item">
                <span className="contact-label"> Téléphone :</span>
                <span className="contact-value">{activeCv.telephoneExtrait || 'Non détecté'}</span>
              </div>
              {activeCv.fileUrl && (
                <div className="contact-item full">
                  <button
                    type="button"
                    className="btn-download-cv"
                    onClick={() => handleDownload(activeCv.fileUrl, activeCv.nomFichier)}
                  >
                     Télécharger le fichier original
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Compétences extraites par l'IA */}
          <div className="cv-extracted-skills">
            <h5 className="details-section-title"> Compétences clés détectées ({activeCv.skillsExtraites?.length || 0})</h5>
            <div className="skills-badge-list">
              {activeCv.skillsExtraites && activeCv.skillsExtraites.length > 0 ? (
                activeCv.skillsExtraites.map((skill) => (
                  <span key={skill} className="skill-badge-lg">{skill}</span>
                ))
              ) : (
                <span className="text-muted">Aucune compétence détectée automatiquement</span>
              )}
            </div>
          </div>

          {/* Extrait / Texte brut du CV */}
          {activeCv.texteExtrait && (
            <div className="cv-text-preview-box">
              <div className="preview-header">
                <h5 className="details-section-title"> Aperçu du contenu extrait du CV</h5>
                <button
                  type="button"
                  className="btn-toggle-text"
                  onClick={() => setShowFullText(!showFullText)}
                >
                  {showFullText ? 'Masquer le texte complet ' : 'Voir le texte extrait complet '}
                </button>
              </div>

              <div className="cv-text-content">
                <p>{showFullText ? activeCv.texteExtrait : (activeCv.previewText || activeCv.texteExtrait.substring(0, 300) + '...')}</p>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="cv-upload-form-box">
          <div className="form-box-header">
            <h4>{activeCv ? 'Remplacer mon CV' : 'Ajouter mon CV'}</h4>
            {activeCv && (
              <button
                type="button"
                className="btn-cancel-sm"
                onClick={() => setShowUploadForm(false)}
              >
                Annuler
              </button>
            )}
          </div>

          {succes && <div className="succes-banner">{succes}</div>}
          {erreur && <div className="auth-error-alert">{erreur}</div>}

          <form onSubmit={handleUpload} className="upload-form">
            <div className="file-drop-area">
              <input
                type="file"
                accept=".pdf,.docx"
                onChange={(e) => setFichier(e.target.files[0])}
                required
              />
              <div className="file-drop-message">
                {fichier
                  ? ` ${fichier.name}`
                  : ' Glissez-déposez votre CV ou cliquez pour le sélectionner (PDF ou DOCX)'}
              </div>
            </div>

            <button
              type="submit"
              className="btn-submit-cv"
              disabled={chargement || !fichier}
            >
              {chargement ? 'Analyse des compétences par l\'IA en cours...' : 'Enregistrer et Analyser mon CV '}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
