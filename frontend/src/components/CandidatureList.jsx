import { useState } from 'react';

export default function CandidatureList({ candidatures, onUpdateStatut }) {
  const [selectedCv, setSelectedCv] = useState(null);

  if (!candidatures || candidatures.length === 0) {
    return <div className="empty-state">Aucune candidature enregistrée pour le moment.</div>;
  }

  const getStatutLabel = (statut) => {
    switch (statut) {
      case 'ACCEPTEE': return 'Acceptée';
      case 'REFUSEE': return ' Refusée';
      default: return ' En attente';
    }
  };

  const getStatutClass = (statut) => {
    switch (statut) {
      case 'ACCEPTEE': return 'statut-acceptee';
      case 'REFUSEE': return 'statut-refusee';
      default: return 'statut-attente';
    }
  };

  return (
    <div className="table-responsive">
      <table className="candidatures-table">
        <thead>
          <tr>
            <th>Candidat</th>
            <th>Contact Extrait</th>
            <th>Compétences CV</th>
            <th>Matching IA</th>
            <th>Statut</th>
            <th>Détails CV</th>
            {onUpdateStatut && <th>Actions Recruteur</th>}
          </tr>
        </thead>
        <tbody>
          {candidatures.map((c) => {
            const candidatNom = c.candidat?.nom || c.candidat?.email || c.offre?.titre || 'Candidat';
            const accountEmail = c.candidat?.email || '';
            const cv = c.cv || (c.candidat?.cvs?.[0] ? c.candidat.cvs[0] : null);
            const cvSkills = cv?.skillsExtraites || [];

            return (
              <tr key={c.id}>
                <td>
                  <div className="candidat-info">
                    <span className="candidat-nom">{candidatNom}</span>
                    {accountEmail && <span className="candidat-email">{accountEmail}</span>}
                  </div>
                </td>
                <td>
                  <div className="contact-summary">
                    {cv?.telephoneExtrait && (
                      <span className="mini-contact"> {cv.telephoneExtrait}</span>
                    )}
                    {cv?.emailExtrait && (
                      <span className="mini-contact"> {cv.emailExtrait}</span>
                    )}
                    {!cv?.telephoneExtrait && !cv?.emailExtrait && (
                      <span className="text-muted">{accountEmail}</span>
                    )}
                  </div>
                </td>
                <td>
                  <div className="cv-skills-list">
                    {cvSkills.length > 0 ? (
                      cvSkills.slice(0, 4).map((sk) => (
                        <span key={sk} className="mini-skill-badge">{sk}</span>
                      ))
                    ) : (
                      <span className="text-muted">Aucune compétence détectée</span>
                    )}
                    {cvSkills.length > 4 && (
                      <span className="mini-skill-badge extra">+{cvSkills.length - 4}</span>
                    )}
                  </div>
                </td>
                <td>
                  <div className="score-cell">
                    <span className={`score-badge score-${c.scoreMatching >= 70 ? 'haut' : c.scoreMatching >= 40 ? 'moyen' : 'bas'}`}>
                      {c.scoreMatching.toFixed(0)}%
                    </span>
                  </div>
                </td>
                <td>
                  <span className={`statut-pill ${getStatutClass(c.statut)}`}>
                    {getStatutLabel(c.statut)}
                  </span>
                </td>
                <td>
                  {cv ? (
                    <button
                      type="button"
                      className="btn-view-cv-details"
                      onClick={() => setSelectedCv({ ...cv, candidatNom, accountEmail })}
                    >
                       Voir le CV
                    </button>
                  ) : (
                    <span className="text-muted">Aucun CV</span>
                  )}
                </td>
                {onUpdateStatut && (
                  <td>
                    <div className="action-buttons-group">
                      <button
                        type="button"
                        className="btn-action btn-accept"
                        onClick={() => onUpdateStatut(c.id, 'ACCEPTEE')}
                        disabled={c.statut === 'ACCEPTEE'}
                        title="Accepter la candidature"
                      >
                        Accepter
                      </button>
                      <button
                        type="button"
                        className="btn-action btn-reject"
                        onClick={() => onUpdateStatut(c.id, 'REFUSEE')}
                        disabled={c.statut === 'REFUSEE'}
                        title="Refuser la candidature"
                      >
                        Refuser
                      </button>
                    </div>
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>

      {/* Modal d'inspection détaillée du CV du candidat */}
      {selectedCv && (
        <div className="modal-overlay">
          <div className="modal-card cv-inspector-modal">
            <div className="modal-header">
              <h3> CV de {selectedCv.candidatNom}</h3>
              <button
                type="button"
                className="close-modal-btn"
                onClick={() => setSelectedCv(null)}
              >
                X
              </button>
            </div>

            <div className="cv-modal-body">
              <div className="cv-contact-details">
                <h5 className="details-section-title"> Coordonnées du Candidat</h5>
                <div className="contact-grid">
                  <div className="contact-item">
                    <span className="contact-label">Email Compte :</span>
                    <span className="contact-value">{selectedCv.accountEmail}</span>
                  </div>
                  {selectedCv.emailExtrait && (
                    <div className="contact-item">
                      <span className="contact-label">Email CV :</span>
                      <span className="contact-value">{selectedCv.emailExtrait}</span>
                    </div>
                  )}
                  {selectedCv.telephoneExtrait && (
                    <div className="contact-item">
                      <span className="contact-label">Téléphone :</span>
                      <span className="contact-value">{selectedCv.telephoneExtrait}</span>
                    </div>
                  )}
                  {selectedCv.fileUrl && (
                    <div className="contact-item full">
                      <a
                        href={selectedCv.fileUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="btn-download-cv"
                      >
                         Télécharger le fichier original du CV
                      </a>
                    </div>
                  )}
                </div>
              </div>

              <div className="cv-extracted-skills">
                <h5 className="details-section-title"> Compétences extraites ({selectedCv.skillsExtraites?.length || 0})</h5>
                <div className="skills-badge-list">
                  {selectedCv.skillsExtraites?.map((sk) => (
                    <span key={sk} className="skill-badge-lg">{sk}</span>
                  ))}
                </div>
              </div>

              {selectedCv.texteExtrait && (
                <div className="cv-full-text-box">
                  <h5 className="details-section-title"> Contenu brut extrait du CV</h5>
                  <pre className="raw-cv-text">{selectedCv.texteExtrait}</pre>
                </div>
              )}
            </div>

            <div className="modal-actions">
              <button
                type="button"
                className="btn-cancel"
                onClick={() => setSelectedCv(null)}
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
