import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/axios';
import OffreCard from '../components/OffreCard';
import SearchableSelect from '../components/Searchableselect';
import { COUNTRIES } from '../data/countries';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';
import { isValidEmail } from '../utils/emailValidation';
import { matchOfferSearch, normalizeText } from '../utils/searchMatcher';
import { RiSearchAi2Line } from "react-icons/ri";
import { RiUserLocationFill } from "react-icons/ri";
import { IoReloadOutline } from "react-icons/io5";
import { ImOffice } from "react-icons/im";

const normalizePhone = (value) => String(value || '').replace(/\D/g, '').slice(0, 15);

export default function Offres() {

  const [offres, setOffres] = useState([]);
  const [mesCandidatures, setMesCandidatures] = useState([]);
  const [candidaturesUserId, setCandidaturesUserId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submittingId, setSubmittingId] = useState(null);
  const [search, setSearch] = useState('');
  const [filterStatut, setFilterStatut] = useState('toutes');
  const [filterContrat, setFilterContrat] = useState('tous');
  const [filterPays, setFilterPays] = useState('');


  const [targetOffreId, setTargetOffreId] = useState(null);
  const [cvFile, setCvFile] = useState(null);
  const [uploadingCv, setUploadingCv] = useState(false);
  const [visiteurOffre, setVisiteurOffre] = useState(null);
  const [monCv, setMonCv] = useState(null);
  const [confirmOffre, setConfirmOffre] = useState(null);
  const [editingInfo, setEditingInfo] = useState(false);
  const [editForm, setEditForm] = useState({ nom: '', email: '', telephone: '' });
  const [savingInfo, setSavingInfo] = useState(false);
  const [replacingCv, setReplacingCv] = useState(false);
  const [newCvFile, setNewCvFile] = useState(null);
  const [uploadingNewCv, setUploadingNewCv] = useState(false);

  const { user, setUser } = useAuth();
  const navigate = useNavigate();
  const { showToast, ToastViewport } = useToast();

  const API_BASE = import.meta.env?.VITE_API_URL || 'http://localhost:5000';

  const chargerOffres = async () => {
    try {
      const res = await api.get('/offres');
      setOffres(res.data.offres || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const chargerMesCandidatures = async () => {
    if (user?.role === 'CANDIDAT') {
      try {
        const res = await api.get('/candidatures/mes-candidatures');
        setMesCandidatures(res.data.candidatures || []);
        setCandidaturesUserId(user.id);
      } catch (err) {
        console.error(err);
        setMesCandidatures([]);
        setCandidaturesUserId(null);
      }
    } else {
      setMesCandidatures([]);
      setCandidaturesUserId(null);
    }
  };

  const chargerMonCv = async () => {
    if (user?.role === 'CANDIDAT') {
      try {
        const res = await api.get('/cv/mes-cv');
        const cvs = res.data.cvs || [];
        setMonCv(cvs.length > 0 ? cvs[0] : null);
      } catch (err) {
        console.error(err);
      }
    } else {
      setMonCv(null);
    }
  };

  useEffect(() => {
    chargerOffres();
    chargerMesCandidatures();
    chargerMonCv();
  }, [user]);

  const appliedOffreIds = new Set(mesCandidatures.map((c) => c.offreId));

  const qPays = normalizeText(filterPays);
  const offresFiltrees = offres.filter((o) => {
    const matchStatut = filterStatut === 'toutes' || o.statut === filterStatut;
    const matchContrat = filterContrat === 'tous' || o.typeContrat === filterContrat;
    const matchPays = !qPays || normalizeText(o.pays).includes(qPays);
    const matchSearch = matchOfferSearch(o, search);
    return matchStatut && matchContrat && matchPays && matchSearch;
  });

  const handleContactRecruteur = async (offre) => {
    if (!user) { navigate('/login'); return; }
    try {
      const res = await api.post('/messages/conversations', { recruteurId: offre.recruteurId });
      navigate(`/messages?conv=${res.data.conversation.id}`);
    } catch (err) {
      console.error(err);
    }
  };

  const handlePostulerVisiteur = (offre) => {
    setVisiteurOffre(offre);
  };

  const confirmerConnexion = () => {
    if (!visiteurOffre) return;
    localStorage.setItem('pendingOffreId', String(visiteurOffre.id));
    navigate(`/login?redirect=/offres&offreId=${visiteurOffre.id}`);
  };

  // If the user just logged in with a pending application, reopen the confirmation modal.
  // We never auto-apply — the candidate must always review and confirm first.
  useEffect(() => {
    const pendingOffreId = localStorage.getItem('pendingOffreId');
    if (
      !pendingOffreId ||
      user?.role !== 'CANDIDAT' ||
      candidaturesUserId !== user.id ||
      offres.length === 0
    ) return;

    localStorage.removeItem('pendingOffreId');
    const matchedOffre = offres.find((o) => String(o.id) === String(pendingOffreId));
    if (matchedOffre && appliedOffreIds.has(matchedOffre.id)) {
      showToast('error', 'Vous avez déjà postulé à cette offre.');
    } else if (matchedOffre) {
      setConfirmOffre(matchedOffre);
      setEditingInfo(false);
      setReplacingCv(false);
      setNewCvFile(null);
      setEditForm({
        nom: user?.nom || '',
        email: monCv?.emailExtrait || user?.email || '',
        telephone: normalizePhone(monCv?.telephoneExtrait),
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, offres, candidaturesUserId, mesCandidatures]);

  // Entry point for the "Apply" button — always shows a confirmation modal first
  const handleDemandePostuler = (offreId) => {
    const offre = offres.find((o) => String(o.id) === String(offreId));
    if (offre) {
      setConfirmOffre(offre);
      setEditingInfo(false);
      setReplacingCv(false);
      setNewCvFile(null);
      setEditForm({
        nom: user?.nom || '',
        email: monCv?.emailExtrait || user?.email || '',
        telephone: normalizePhone(monCv?.telephoneExtrait),
      });
    }
  };

  // Saves edits made in the confirmation modal: name/email on user profile, phone on CV
  const handleSaveInfo = async () => {
    const telephone = normalizePhone(editForm.telephone);
    const email = editForm.email.trim();

    if (!isValidEmail(email)) {
      showToast('error', 'Adresse email invalide. Exemple : sarah.benali@talent.tn');
      return;
    }

    if (telephone && !/^\d{8,15}$/.test(telephone)) {
      showToast('error', 'Le téléphone doit contenir entre 8 et 15 chiffres.');
      return;
    }

    setSavingInfo(true);
    try {
      const resProfile = await api.put('/auth/profile', { nom: editForm.nom, email });
      if (resProfile.data?.user) setUser(resProfile.data.user);

      if (monCv) {
        await api.put('/cv/contact', {
          telephoneExtrait: telephone,
          emailExtrait: email,
        });
      }

      await chargerMonCv();
      setEditingInfo(false);
      showToast('success', 'Informations mises à jour avec succès !');
    } catch (err) {
      showToast('error', err.response?.data?.message || 'Erreur lors de la mise à jour de vos informations');
    } finally {
      setSavingInfo(false);
    }
  };

  const postuler = async (offreId) => {
    setSubmittingId(offreId);

    try {
      await api.post('/candidatures', { offreId });
      showToast('success', 'Candidature envoyée avec succès !');
      chargerMesCandidatures();
    } catch (err) {
      if (err.response?.data?.noCv) {
        setTargetOffreId(offreId);
      } else {
        showToast('error', err.response?.data?.message || 'Erreur lors de la candidature');
      }
    } finally {
      setSubmittingId(null);
    }
  };

  const handleUploadCvAndApply = async (e) => {
    e.preventDefault();
    if (!cvFile || !targetOffreId) return;

    setUploadingCv(true);

    try {
      const formData = new FormData();
      formData.append('cv', cvFile);

      await api.post('/cv/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      await api.post('/candidatures', { offreId: targetOffreId });

      showToast('success', 'CV analysé par l\'IA et candidature transmise avec succès !');
      setTargetOffreId(null);
      setCvFile(null);
      chargerMesCandidatures();
      chargerMonCv();
    } catch (err) {
      showToast('error', err.response?.data?.message || 'Erreur lors de l\'envoi du CV');
    } finally {
      setUploadingCv(false);
    }
  };


  // Closes the confirmation modal and resets all its sub-states
  const closeConfirmModal = () => {
    setConfirmOffre(null);
    setEditingInfo(false);
    setReplacingCv(false);
    setNewCvFile(null);
  };

  // Replaces the candidate's active CV from within the confirmation modal
  const handleReplaceCv = async (e) => {
    e.preventDefault();
    if (!newCvFile) return;

    setUploadingNewCv(true);

    try {
      const formData = new FormData();
      formData.append('cv', newCvFile);

      await api.post('/cv/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      await chargerMonCv();
      setNewCvFile(null);
      setReplacingCv(false);
      showToast('success', 'Votre CV a été mis à jour avec succès !');
    } catch (err) {
      showToast('error', err.response?.data?.message || 'Erreur lors du remplacement du CV');
    } finally {
      setUploadingNewCv(false);
    }
  };


  return (
    <div className="page-offres">
      <div className="offres-hero">
        <div className="offres-hero-text">
          <h2>Offres d'emploi disponibles</h2>
          <p>Trouvez votre prochain poste et postulez en 1 clic - notre IA analyse votre CV et calcule votre score de matching automatiquement.</p>
        </div>
        <div className="offres-hero-stats">
          <span className="hero-stat"><strong>{offres.length}</strong> offre{offres.length !== 1 ? 's' : ''}</span>
          <span className="hero-stat hero-stat--open"><strong>{offres.filter(o => o.statut === 'ouverte').length}</strong> ouvertes</span>
        </div>
      </div>

      <ToastViewport />

      {/* Search & Filter bar */}
      <div className="offres-search-bar">
        <div className="offres-search-input-wrap">
          <span className="search-icon"><RiSearchAi2Line /></span>
          <input
            type="text"
            placeholder="Titre, entreprise, compétence..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="offres-search-input"
          />
          {search && (
            <button type="button" className="search-clear" onClick={() => setSearch('')}>✕</button>
          )}
        </div>

        <SearchableSelect
          icon={<RiUserLocationFill />}
          placeholder="Pays..."
          value={filterPays}
          onChange={setFilterPays}
          options={Array.from(new Set([
            ...COUNTRIES,
            ...offres.map((o) => o.pays).filter((p) => p && p !== 'Non précisé'),
          ])).sort((a, b) => a.localeCompare(b, 'fr'))}
        />

        <select className="offres-filter-select" value={filterContrat} onChange={(e) => setFilterContrat(e.target.value)}>
          <option value="tous">Tous contrats</option>
          <option value="CDI">CDI</option>
          <option value="CDD">CDD</option>
          <option value="Stage">Stage</option>
          <option value="Alternance">Alternance</option>
          <option value="Freelance">Freelance</option>
        </select>

        <select className="offres-filter-select" value={filterStatut} onChange={(e) => setFilterStatut(e.target.value)}>
          <option value="toutes">Toutes</option>
          <option value="ouverte"> Ouvertes</option>
          <option value="fermee">Fermées</option>
        </select>

        {(search || filterPays || filterContrat !== 'tous' || filterStatut !== 'toutes') && (
          <button type="button" className="offres-reset-btn" onClick={() => { setSearch(''); setFilterPays(''); setFilterContrat('tous'); setFilterStatut('toutes'); }}>
            <IoReloadOutline /> Réinitialiser
          </button>
        )}
      </div>

      {loading ? (
        <div className="loading-state">Chargement des offres...</div>
      ) : offresFiltrees.length === 0 ? (
        <div className="empty-state">
          {search || filterStatut !== 'toutes'
            ? `Aucune offre ne correspond à « ${search || filterStatut} ».`
            : "Aucune offre d'emploi disponible pour le moment."}
        </div>
      ) : (
        <>
          <p className="offres-result-count">{offresFiltrees.length} offre{offresFiltrees.length !== 1 ? 's' : ''} trouvée{offresFiltrees.length !== 1 ? 's' : ''}</p>
          <div className="offres-grid">
            {offresFiltrees.map((offre) => (
              <OffreCard
                key={offre.id}
                offre={offre}
                hasApplied={appliedOffreIds.has(offre.id)}
                isSubmitting={submittingId === offre.id}
                onPostuler={user?.role === 'CANDIDAT' ? handleDemandePostuler : null}
                onPostulerVisiteur={!user ? handlePostulerVisiteur : null}
                onContactRecruteur={user?.role === 'CANDIDAT' ? handleContactRecruteur : null}
              />
            ))}
          </div>
        </>
      )}
      {/* CV upload modal (candidate without a CV) */}
      {targetOffreId && (
        <div className="modal-overlay">
          <div className="modal-card">
            <div className="modal-header">
              <h3>Ajoutez votre CV pour postuler</h3>
              <button
                type="button"
                className="close-modal-btn"
                onClick={() => setTargetOffreId(null)}
              >
                X
              </button>
            </div>
            <p className="modal-desc">
              Pour postuler à cette offre, veuillez uploader votre CV (format PDF ou DOCX). Notre IA extraira vos compétences en quelques secondes.
            </p>

            <form onSubmit={handleUploadCvAndApply} className="modal-form">
              <div className="file-drop-area">
                <input
                  type="file"
                  accept=".pdf,.docx"
                  onChange={(e) => setCvFile(e.target.files[0])}
                  required
                />
                <div className="file-drop-message">
                  {cvFile ? ` ${cvFile.name}` : ' Cliquez pour sélectionner votre CV (PDF/DOCX)'}
                </div>
              </div>

              <div className="modal-actions">
                <button
                  type="button"
                  className="btn-cancel"
                  onClick={() => setTargetOffreId(null)}
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="btn-modal-submit"
                  disabled={uploadingCv || !cvFile}
                >
                  {uploadingCv ? 'Analyse IA en cours...' : 'Envoyer & Postuler '}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Application confirmation modal */}
      {confirmOffre && (
        <div className="modal-overlay" onClick={() => closeConfirmModal()}>
          <div className="modal-card login-prompt-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Confirmer votre candidature</h3>
              <button
                type="button"
                className="close-modal-btn"
                onClick={() => closeConfirmModal()}
              >
                X
              </button>
            </div>

            <div className="login-prompt-offre">
              <span className="login-prompt-offre-icon"><ImOffice /></span>
              <div className="login-prompt-offre-info">
                <h4>{confirmOffre.titre}</h4>
                {confirmOffre.entreprise && <p>{confirmOffre.entreprise}</p>}
                {confirmOffre.pays && confirmOffre.pays !== 'Non précisé' && (
                  <span className="login-prompt-pays">{confirmOffre.pays}</span>
                )}
              </div>
            </div>

            {monCv ? (
              <>
                <p className="modal-desc">
                  Voici les informations extraites de votre CV qui seront transmises au recruteur. Vérifiez qu'elles sont à jour avant d'envoyer votre candidature.
                </p>

                <div className="apply-cv-card">
                  <div className="apply-cv-info">
                    <span className="apply-cv-icon">📄</span>
                    <div className="apply-cv-details">
                      <span className="apply-cv-name">{monCv.nomFichier || 'Mon CV'}</span>
                      {monCv.fileUrl && (
                        <a
                          href={`${API_BASE}/api${monCv.fileUrl.startsWith('/api') ? monCv.fileUrl.slice('/api'.length) : monCv.fileUrl}`}
                          target="_blank"
                          rel="noreferrer"
                          className="apply-cv-view-link"
                        >
                          Voir le fichier
                        </a>
                      )}
                    </div>
                  </div>
                  {!replacingCv && (
                    <button type="button" className="link-btn" onClick={() => setReplacingCv(true)}>
                      Remplacer mon CV
                    </button>
                  )}
                </div>

                {replacingCv && (
                  <form onSubmit={handleReplaceCv} className="modal-form apply-cv-replace-form">
                    <div className="file-drop-area">
                      <input
                        type="file"
                        accept=".pdf,.docx"
                        onChange={(e) => setNewCvFile(e.target.files[0])}
                        required
                      />
                      <div className="file-drop-message">
                        {newCvFile ? ` ${newCvFile.name}` : ' Cliquez pour sélectionner un nouveau CV (PDF/DOCX)'}
                      </div>
                    </div>
                    <div className="modal-actions">
                      <button
                        type="button"
                        className="btn-cancel"
                        onClick={() => { setReplacingCv(false); setNewCvFile(null); }}
                        disabled={uploadingNewCv}
                      >
                        Annuler
                      </button>
                      <button type="submit" className="btn-modal-submit" disabled={uploadingNewCv || !newCvFile}>
                        {uploadingNewCv ? 'Analyse IA en cours...' : 'Mettre à jour mon CV'}
                      </button>
                    </div>
                  </form>
                )}

                {editingInfo ? (
                  <>
                    <div className="apply-confirm-fields apply-confirm-fields--edit">
                      <div className="form-group">
                        <label>Nom</label>
                        <input
                          value={editForm.nom}
                          onChange={(e) => setEditForm((f) => ({ ...f, nom: e.target.value }))}
                        />
                      </div>
                      <div className="form-group">
                        <label>Email</label>
                        <input
                          type="email"
                          pattern="[^ @]+@[^ @]+[.][^ @]+"
                          required
                          title="Format attendu : sarah.benali@talent.tn"
                          value={editForm.email}
                          onChange={(e) => setEditForm((f) => ({ ...f, email: e.target.value }))}
                        />
                      </div>
                      <div className="form-group">
                        <label>Téléphone</label>
                        <input
                          type="tel"
                          inputMode="numeric"
                          pattern="[0-9]{8,15}"
                          maxLength={15}
                          value={editForm.telephone}
                          onChange={(e) => setEditForm((f) => ({ ...f, telephone: normalizePhone(e.target.value) }))}
                          placeholder="Non renseigné"
                        />
                        <small className="field-hint">8 à 15 chiffres, sans espaces.</small>
                      </div>
                    </div>

                    <div className="modal-actions">
                      <button type="button" className="btn-cancel" onClick={() => setEditingInfo(false)} disabled={savingInfo}>
                        Annuler
                      </button>
                      <button
                        type="button"
                        className="btn-modal-submit"
                        onClick={handleSaveInfo}
                        disabled={savingInfo || Boolean(editForm.telephone && editForm.telephone.length < 8)}
                      >
                        {savingInfo ? 'Enregistrement...' : 'Enregistrer'}
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="apply-confirm-fields">
                      <div className="apply-confirm-field">
                        <span className="apply-confirm-label">Nom</span>
                        <span className="apply-confirm-value">{user?.nom || '—'}</span>
                      </div>
                      <div className="apply-confirm-field">
                        <span className="apply-confirm-label">Email</span>
                        <span className="apply-confirm-value">{monCv.emailExtrait || user?.email || '—'}</span>
                      </div>
                      <div className="apply-confirm-field">
                        <span className="apply-confirm-label">Téléphone</span>
                        <span className="apply-confirm-value">{monCv.telephoneExtrait || 'Non renseigné'}</span>
                      </div>
                    </div>

                    {monCv.skillsExtraites?.length > 0 && (
                      <div className="apply-confirm-skills">
                        {monCv.skillsExtraites.slice(0, 10).map((s) => (
                          <span key={s} className="mini-skill-badge">{s}</span>
                        ))}
                        {monCv.skillsExtraites.length > 10 && (
                          <span className="mini-skill-badge extra">+{monCv.skillsExtraites.length - 10}</span>
                        )}
                      </div>
                    )}

                    <div className="modal-actions">
                      <button
                        type="button"
                        className="btn-cancel"
                        onClick={() => setEditingInfo(true)}
                      >
                        Modifier mes informations
                      </button>
                      <button
                        type="button"
                        className="btn-modal-submit"
                        disabled={submittingId === confirmOffre.id}
                        onClick={async () => {
                          const offreId = confirmOffre.id;
                          closeConfirmModal();
                          await postuler(offreId);
                        }}
                      >
                        {submittingId === confirmOffre.id ? 'Envoi...' : 'Confirmer et postuler →'}
                      </button>
                    </div>
                  </>
                )}
              </>
            ) : (
              <>
                <p className="modal-desc">
                  Vous n'avez pas encore de CV enregistré. Ajoutez-en un pour que notre IA extraie vos informations et calcule votre score de matching avant l'envoi.
                </p>
                <div className="modal-actions">
                  <button type="button" className="btn-cancel" onClick={() => closeConfirmModal()}>
                    Annuler
                  </button>
                  <button
                    type="button"
                    className="btn-modal-submit"
                    onClick={() => {
                      const offreId = confirmOffre.id;
                      closeConfirmModal();
                      setTargetOffreId(offreId);
                    }}
                  >
                    Ajouter mon CV
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* "Login to apply" modal (unauthenticated visitor) */}
      {visiteurOffre && (
        <div className="modal-overlay" onClick={() => setVisiteurOffre(null)}>
          <div className="modal-card login-prompt-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Connectez-vous pour postuler</h3>
              <button
                type="button"
                className="close-modal-btn"
                onClick={() => setVisiteurOffre(null)}
              >
                X
              </button>
            </div>

            <div className="login-prompt-offre">
              <span className="login-prompt-offre-icon"><ImOffice /></span>
              <div className="login-prompt-offre-info">
                <h4>{visiteurOffre.titre}</h4>
                {visiteurOffre.entreprise && <p>{visiteurOffre.entreprise}</p>}
                {visiteurOffre.pays && visiteurOffre.pays !== 'Non précisé' && (
                  <span className="login-prompt-pays">{visiteurOffre.pays}</span>
                )}
              </div>
            </div>

            <p className="modal-desc">
              Pour envoyer votre candidature{visiteurOffre.entreprise ? ` à ${visiteurOffre.entreprise}` : ''}, connectez-vous d'abord à votre compte candidat. Vous reviendrez directement sur cette offre après connexion.
            </p>

            <div className="modal-actions">
              <button
                type="button"
                className="btn-cancel"
                onClick={() => setVisiteurOffre(null)}
              >
                Annuler
              </button>
              <button
                type="button"
                className="btn-modal-submit"
                onClick={confirmerConnexion}
              >
                Se connecter
              </button>
            </div>

            <p className="login-prompt-signup">
              Pas encore de compte ?{' '}
              <button
                type="button"
                className="login-prompt-link"
                onClick={() => {
                  if (visiteurOffre) {
                    localStorage.setItem('pendingOffreId', String(visiteurOffre.id));
                    navigate(`/login?tab=register&redirect=/offres&offreId=${visiteurOffre.id}`);
                  }
                }}
              >
                Inscrivez-vous
              </button>
            </p>
          </div>
        </div>
      )}
    </div>
  );
}