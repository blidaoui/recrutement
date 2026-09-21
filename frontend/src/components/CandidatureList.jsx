import { useState } from 'react';
import { ImOffice } from 'react-icons/im';
import { BsPersonCheckFill } from 'react-icons/bs';

const STATUT_INFO = {
  ACCEPTEE: { label: 'Acceptée', className: 'statut-acceptee' },
  REFUSEE: { label: 'Refusée', className: 'statut-refusee' },
  EN_ATTENTE: { label: 'En attente', className: 'statut-attente' },
};

const API_BASE = import.meta.env?.VITE_API_URL || 'http://localhost:5000';

const getStatutInfo = (statut) => STATUT_INFO[statut] || STATUT_INFO.EN_ATTENTE;

export default function CandidatureList({ candidatures, onUpdateStatut }) {
  const [selectedCv, setSelectedCv] = useState(null);
  const [selectedCandidature, setSelectedCandidature] = useState(null);

  // Sans onUpdateStatut, on est forcément sur l'espace CANDIDAT (ses propres
  // candidatures) : il n'y a alors rien à "gérer", juste à consulter où il en est.
  // Avec onUpdateStatut, on est sur l'espace RECRUTEUR (candidatures reçues sur
  // une de ses offres) : on affiche le profil du candidat + les actions.
  const isRecruteurView = !!onUpdateStatut;

  if (!candidatures || candidatures.length === 0) {
    return (
      <div className="empty-state">
        {isRecruteurView
          ? 'Aucune candidature enregistrée pour le moment.'
          : "Vous n'avez postulé à aucune offre pour le moment."}
      </div>
    );
  }

  /* ============================== VUE RECRUTEUR ============================== */
  if (isRecruteurView) {
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
              <th>Actions Recruteur</th>
            </tr>
          </thead>
          <tbody>
            {candidatures.map((c) => {
              const candidatNom = c.candidat?.nom || c.candidat?.email || c.offre?.titre || 'Candidat';
              const accountEmail = c.candidat?.email || '';
              const cv = c.cv || (c.candidat?.cvs?.[0] ? c.candidat.cvs[0] : null);
              const cvSkills = cv?.skillsExtraites || [];
              const statutInfo = getStatutInfo(c.statut);

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
                        {Number(c.scoreMatching || 0).toFixed(0)}%
                      </span>
                    </div>
                  </td>
                  <td>
                    <span className={`statut-pill ${statutInfo.className}`}>{statutInfo.label}</span>
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
                </tr>
              );
            })}
          </tbody>
        </table>

        {/* Modal d'inspection détaillée du CV du candidat */}
        {selectedCv && (
          <div className="modal-overlay" onClick={() => setSelectedCv(null)}>
            <div className="modal-card cv-inspector-modal" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <h3> CV de {selectedCv.candidatNom}</h3>
                <button type="button" className="close-modal-btn" onClick={() => setSelectedCv(null)}>X</button>
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
                        <a href={`${API_BASE}${selectedCv.fileUrl}`} target="_blank" rel="noreferrer" className="btn-download-cv">
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
                <button type="button" className="btn-cancel" onClick={() => setSelectedCv(null)}>Fermer</button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  /* ============================== VUE CANDIDAT ============================== */
  return (
    <div className="table-responsive">
      <table className="candidatures-table">
        <thead>
          <tr>
            <th>Offre</th>
            <th>Entreprise</th>
            <th>Contrat</th>
            <th>Matching IA</th>
            <th>Statut</th>
            <th>Envoyée le</th>
            <th>Détails</th>
          </tr>
        </thead>
        <tbody>
          {candidatures.map((c) => {
            const offre = c.offre || {};
            const statutInfo = getStatutInfo(c.statut);
            const dateEnvoi = c.createdAt
              ? new Date(c.createdAt).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })
              : '—';

            return (
              <tr key={c.id}>
                <td>
                  <div className="candidat-info">
                    <span className="candidat-nom">{offre.titre || 'Offre indisponible'}</span>
                    {offre.pays && offre.pays !== 'Non précisé' && (
                      <span className="candidat-email">{offre.pays}</span>
                    )}
                  </div>
                </td>
                <td>{offre.entreprise || '—'}</td>
                <td>
                  {offre.typeContrat && offre.typeContrat !== 'Non précisé' ? (
                    <span className="mini-skill-badge">{offre.typeContrat}</span>
                  ) : (
                    <span className="text-muted">—</span>
                  )}
                </td>
                <td>
                  <div className="score-cell">
                    <span className={`score-badge score-${c.scoreMatching >= 70 ? 'haut' : c.scoreMatching >= 40 ? 'moyen' : 'bas'}`}>
                      {Number(c.scoreMatching || 0).toFixed(0)}%
                    </span>
                  </div>
                </td>
                <td>
                  <span className={`statut-pill ${statutInfo.className}`}>{statutInfo.label}</span>
                </td>
                <td>{dateEnvoi}</td>
                <td>
                  <button type="button" className="btn-view-cv-details" onClick={() => setSelectedCandidature(c)}>
                    Voir l'offre
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {/* Détail de l'offre visée par une candidature */}
      {selectedCandidature && (
        <div className="modal-overlay" onClick={() => setSelectedCandidature(null)}>
          <div className="modal-card cv-inspector-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{selectedCandidature.offre?.titre || 'Détail de la candidature'}</h3>
              <button type="button" className="close-modal-btn" onClick={() => setSelectedCandidature(null)}>X</button>
            </div>

            <div className="cv-modal-body">
              <div className="login-prompt-offre">
                <span className="login-prompt-offre-icon"><ImOffice /></span>
                <div className="login-prompt-offre-info">
                  <h4>{selectedCandidature.offre?.titre}</h4>
                  {selectedCandidature.offre?.entreprise && <p>{selectedCandidature.offre.entreprise}</p>}
                  {selectedCandidature.offre?.pays && selectedCandidature.offre.pays !== 'Non précisé' && (
                    <span className="login-prompt-pays">{selectedCandidature.offre.pays}</span>
                  )}
                </div>
              </div>

              {selectedCandidature.offre?.description && (
                <div className="cv-extracted-skills">
                  <h5 className="details-section-title">Description de l'offre</h5>
                  <p>{selectedCandidature.offre.description}</p>
                </div>
              )}

              {(selectedCandidature.offre?.skillsObligatoires?.length > 0 || selectedCandidature.offre?.skillsRequises?.length > 0) && (
                <div className="cv-extracted-skills">
                  <h5 className="details-section-title">Compétences demandées</h5>
                  <div className="skills-badge-list">
                    {(selectedCandidature.offre.skillsObligatoires || selectedCandidature.offre.skillsRequises || []).map((s) => (
                      <span key={s} className="skill-badge-lg">{s}</span>
                    ))}
                  </div>
                </div>
              )}

              <div className="contact-grid">
                <div className="contact-item">
                  <span className="contact-label">Statut de la candidature :</span>
                  <span className="contact-value">
                    <span className={`statut-pill ${getStatutInfo(selectedCandidature.statut).className}`}>
                      {getStatutInfo(selectedCandidature.statut).label}
                    </span>
                  </span>
                </div>
                <div className="contact-item">
                  <span className="contact-label">Score de matching IA :</span>
                  <span className="contact-value"><BsPersonCheckFill /> {Number(selectedCandidature.scoreMatching || 0).toFixed(0)}%</span>
                </div>
              </div>
            </div>

            <div className="modal-actions">
              <button type="button" className="btn-cancel" onClick={() => setSelectedCandidature(null)}>Fermer</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}