import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/axios';
import OffreCard from '../components/OffreCard';
import { useAuth } from '../context/AuthContext';
import { RiSearchAi2Line } from "react-icons/ri";
import { RiUserLocationFill } from "react-icons/ri";
import { IoReloadOutline } from "react-icons/io5";

export default function Offres() {

  const [offres, setOffres] = useState([]);
  const [mesCandidatures, setMesCandidatures] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submittingId, setSubmittingId] = useState(null);
  const [notification, setNotification] = useState('');
  const [search, setSearch] = useState('');
  const [filterStatut, setFilterStatut] = useState('toutes');
  const [filterContrat, setFilterContrat] = useState('tous');
  const [filterPays, setFilterPays] = useState('');


  // Modale d'upload de CV (Candidat sans CV)
  const [targetOffreId, setTargetOffreId] = useState(null);
  const [cvFile, setCvFile] = useState(null);
  const [uploadingCv, setUploadingCv] = useState(false);

  const { user } = useAuth();
  const navigate = useNavigate();

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
      } catch (err) {
        console.error(err);
      }
    }
  };

  useEffect(() => {
    chargerOffres();
    chargerMesCandidatures();
  }, [user]);

  const appliedOffreIds = new Set(mesCandidatures.map((c) => c.offreId));

  const q = search.toLowerCase();
  const qPays = filterPays.toLowerCase();
  const offresFiltrees = offres.filter((o) => {
    const matchStatut = filterStatut === 'toutes' || o.statut === filterStatut;
    const matchContrat = filterContrat === 'tous' || o.typeContrat === filterContrat;
    const matchPays = !qPays || o.pays?.toLowerCase().includes(qPays);
    const matchSearch = !q ||
      o.titre?.toLowerCase().includes(q) ||
      o.entreprise?.toLowerCase().includes(q) ||
      o.description?.toLowerCase().includes(q) ||
      o.pays?.toLowerCase().includes(q) ||
      o.skillsRequises?.some((s) => s.toLowerCase().includes(q)) ||
      o.skillsObligatoires?.some((s) => s.toLowerCase().includes(q)) ||
      o.skillsSouhaitees?.some((s) => s.toLowerCase().includes(q));
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

  const postuler = async (offreId) => {
    setSubmittingId(offreId);
    setNotification('');

    try {
      await api.post('/candidatures', { offreId });
      setNotification(' Candidature envoyée avec succès !');
      chargerMesCandidatures();
    } catch (err) {
      if (err.response?.data?.noCv) {
        setTargetOffreId(offreId);
      } else {
        setNotification(` ${err.response?.data?.message || 'Erreur lors de la candidature'}`);
      }
    } finally {
      setSubmittingId(null);
    }
  };

  const handleUploadCvAndApply = async (e) => {
    e.preventDefault();
    if (!cvFile || !targetOffreId) return;

    setUploadingCv(true);
    setNotification('');

    try {
      const formData = new FormData();
      formData.append('cv', cvFile);

      await api.post('/cv/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      await api.post('/candidatures', { offreId: targetOffreId });

      setNotification('CV analysé par l\'IA et candidature transmise avec succès !');
      setTargetOffreId(null);
      setCvFile(null);
      chargerMesCandidatures();
    } catch (err) {
      alert(err.response?.data?.message || 'Erreur lors de l\'envoi du CV');
    } finally {
      setUploadingCv(false);
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

      {notification && (
        <div className="notification-banner">
          {notification}
          <button onClick={() => setNotification('')} className="close-banner">✕</button>
        </div>
      )}

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

        <div className="offres-search-input-wrap offres-search-input-wrap--sm">
          <span className="search-icon"><RiUserLocationFill /></span>
          <input
            type="text"
            list="pays-list"
            placeholder="Pays..."
            value={filterPays}
            onChange={(e) => setFilterPays(e.target.value)}
            className="offres-search-input"
          />
          {filterPays && (
            <button type="button" className="search-clear" onClick={() => setFilterPays('')}>✕</button>
          )}
          <datalist id="pays-list">
            {Array.from(new Set(offres.map((o) => o.pays).filter((p) => p && p !== 'Non précisé'))).map((p) => (
              <option key={p} value={p} />
            ))}
          </datalist>
        </div>

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
                onPostuler={user?.role === 'CANDIDAT' ? postuler : null}
                onContactRecruteur={user?.role === 'CANDIDAT' ? handleContactRecruteur : null}
              />
            ))}
          </div>
        </>
      )}
      {/* Modal d'Upload instantané du CV (Candidat) */}
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
    </div>
  );
}
