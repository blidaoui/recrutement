import { useState, useEffect } from 'react';
import api from '../api/axios';

export default function CVUpload({ activeCv, onUploaded }) {
  const [fichier, setFichier] = useState(null);
  const [chargement, setChargement] = useState(false);
  const [erreur, setErreur] = useState(null);
  const [succes, setSucces] = useState('');
  const [showUploadForm, setShowUploadForm] = useState(!activeCv);
  const [showFullText, setShowFullText] = useState(false);

  const [isEditingContact, setIsEditingContact] = useState(false);
  const [editEmail, setEditEmail] = useState(activeCv?.emailExtrait || '');
  const [editPhone, setEditPhone] = useState(activeCv?.telephoneExtrait || '');
  const [savingContact, setSavingContact] = useState(false);
  const [contactError, setContactError] = useState(null);
  const [contactSuccess, setContactSuccess] = useState('');

  // Auto-reset overrides on mount so detected CV values always show immediately
  useEffect(() => {
    if (activeCv?.hasOverride) {
      api.put('/cv/contact', { resetToCv: true })
        .then((res) => onUploaded?.(res.data.cv))
        .catch(() => {});
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleDownload = async (fileUrl, fileName) => {
    try {
      const requestUrl = fileUrl.startsWith('/api/') ? fileUrl.replace('/api', '') : fileUrl;
      const res = await api.get(requestUrl, { responseType: 'blob' });
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
      setIsEditingContact(false);
      onUploaded?.(res.data.cv);
    } catch (err) {
      setErreur(err.response?.data?.message || 'Erreur lors de l\'upload');
    } finally {
      setChargement(false);
    }
  };

  const handleSaveContact = async (e) => {
    e.preventDefault();
    setSavingContact(true);
    setContactError(null);
    setContactSuccess('');

    try {
      const res = await api.put('/cv/contact', {
        emailExtrait: editEmail,
        telephoneExtrait: editPhone,
      });
      setContactSuccess('Coordonnées mises à jour avec succès !');
      setIsEditingContact(false);
      onUploaded?.(res.data.cv);
    } catch (err) {
      setContactError(err.response?.data?.message || 'Erreur lors de la mise à jour des coordonnées');
    } finally {
      setSavingContact(false);
    }
  };

  const handleResetContact = async () => {
    setSavingContact(true);
    setContactError(null);
    setContactSuccess('');

    try {
      const res = await api.put('/cv/contact', { resetToCv: true });
      setContactSuccess('Coordonnées réinitialisées avec succès selon le CV !');
      setIsEditingContact(false);
      setEditEmail(res.data.cv?.emailExtrait || '');
      setEditPhone(res.data.cv?.telephoneExtrait || '');
      onUploaded?.(res.data.cv);
    } catch (err) {
      setContactError(err.response?.data?.message || 'Erreur lors de la réinitialisation');
    } finally {
      setSavingContact(false);
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
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.8rem', flexWrap: 'wrap', gap: '0.5rem' }}>
              <h5 className="details-section-title" style={{ margin: 0 }}>
                 Coordonnées extraites du CV
                {activeCv.hasOverride && (
                  <span style={{ fontSize: '0.75rem', fontWeight: 500, color: '#764090', marginLeft: '0.6rem', background: '#f3e8ff', padding: '2px 8px', borderRadius: '12px' }}>
                    Modifiées manuellement
                  </span>
                )}
              </h5>
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <button
                  type="button"
                  style={{ fontSize: '0.82rem', padding: '4px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', background: '#fff', cursor: 'pointer', fontWeight: 500 }}
                  onClick={() => {
                    setIsEditingContact(!isEditingContact);
                    setEditEmail(activeCv.emailExtrait || '');
                    setEditPhone(activeCv.telephoneExtrait || '');
                    setContactError(null);
                    setContactSuccess('');
                  }}
                >
                  {isEditingContact ? 'Annuler' : 'Modifier'}
                </button>
              </div>
            </div>

            {contactSuccess && (
              <div style={{ color: '#16a34a', fontSize: '0.85rem', marginBottom: '0.6rem' }}>
                {contactSuccess}
              </div>
            )}
            {contactError && (
              <div style={{ color: '#dc2626', fontSize: '0.85rem', marginBottom: '0.6rem' }}>
                {contactError}
              </div>
            )}

            {isEditingContact ? (
              <form onSubmit={handleSaveContact} style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem', marginTop: '0.4rem' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.8rem' }}>
                  <div className="contact-item">
                    <label className="contact-label">Email :</label>
                    <input
                      type="email"
                      value={editEmail}
                      onChange={(e) => setEditEmail(e.target.value)}
                      placeholder="votre.email@exemple.com"
                      style={{ padding: '0.45rem 0.6rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.9rem' }}
                      required
                    />
                  </div>
                  <div className="contact-item">
                    <label className="contact-label">Téléphone :</label>
                    <input
                      type="text"
                      value={editPhone}
                      onChange={(e) => setEditPhone(e.target.value)}
                      placeholder="+216 99 985 908"
                      style={{ padding: '0.45rem 0.6rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.9rem' }}
                    />
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.2rem' }}>
                  <button
                    type="submit"
                    disabled={savingContact}
                    style={{ padding: '0.45rem 1rem', borderRadius: '6px', background: '#764090', color: '#fff', border: 'none', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600 }}
                  >
                    {savingContact ? 'Enregistrement...' : 'Enregistrer'}
                  </button>
                  {activeCv.hasOverride && (
                    <button
                      type="button"
                      disabled={savingContact}
                      onClick={handleResetContact}
                      style={{ padding: '0.45rem 1rem', borderRadius: '6px', background: '#f1f5f9', color: '#475569', border: '1px solid #cbd5e1', cursor: 'pointer', fontSize: '0.85rem' }}
                    >
                      Restaurer les valeurs du CV
                    </button>
                  )}
                </div>
              </form>
            ) : (
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
            )}
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
