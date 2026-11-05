import { useEffect, useState } from 'react';
import api from '../api/axios';
import CVUpload from '../components/CVUpload';
import ProfileSection from './ProfileSection';
import CandidatureList from '../components/CandidatureList';


export default function CandidatDashboard() {
  const [activeTab, setActiveTab] = useState('dashboard');

  return (
    <div className="page-espace-candidat">
      <div className="espace-tabs">
        <button
          className={`espace-tab ${activeTab === 'dashboard' ? 'active' : ''}`}
          onClick={() => setActiveTab('dashboard')}
        >
          Tableau de bord
        </button>
        <button
          className={`espace-tab ${activeTab === 'profile' ? 'active' : ''}`}
          onClick={() => setActiveTab('profile')}
        >
          Mon profil
        </button>
      </div>

      {activeTab === 'dashboard' ? <DashboardTab /> : <ProfileSection />}
    </div>
  );
}

/* ===================== Onglet Tableau de bord ===================== */
function DashboardTab() {
  const [candidatures, setCandidatures] = useState([]);
  const [cvList, setCvList] = useState([]);
  const [loading, setLoading] = useState(true);

  const chargerMesCV = async () => {
    try {
      const res = await api.get('/cv/mes-cv');
      setCvList(res.data.cvs || []);
    } catch (err) {
      console.error('Erreur chargement CV:', err);
    }
  };

  const chargerCandidatures = async () => {
    try {
      const res = await api.get('/candidatures/mes-candidatures');
      setCandidatures(res.data.candidatures || []);
    } catch (err) {
      console.error('Erreur chargement candidatures:', err);
    }
  };

  useEffect(() => {
    Promise.all([chargerMesCV(), chargerCandidatures()]).finally(() => setLoading(false));
  }, []);

  const handleCvUploaded = () => {
    chargerMesCV();
    chargerCandidatures();
  };

  const activeCv = cvList.length > 0 ? cvList[0] : null;

  const accepted = candidatures.filter(c => c.statut === 'ACCEPTEE').length;
  const pending  = candidatures.filter(c => c.statut === 'EN_ATTENTE').length;
  const avgScore = candidatures.length
    ? Math.round(candidatures.reduce((s, c) => s + (c.scoreMatching || 0), 0) / candidatures.length)
    : 0;

  return (
    <div className="cd-page">
      {/* Hero header */}
      <div className="cd-hero">
        <div className="cd-hero-text">
          <div className="cd-hero-badge">Mon Espace</div>
          <h2 className="cd-hero-title">Tableau de bord</h2>
          <p className="cd-hero-sub">Gérez votre CV, vos compétences IA et suivez vos candidatures.</p>
        </div>
        <div className="cd-kpis">
          <div className="cd-kpi">
            <span className="cd-kpi-val">{candidatures.length}</span>
            <span className="cd-kpi-label">Candidatures</span>
          </div>
          <div className="cd-kpi cd-kpi--green">
            <span className="cd-kpi-val">{accepted}</span>
            <span className="cd-kpi-label">Acceptées</span>
          </div>
          <div className="cd-kpi">
            <span className="cd-kpi-val">{pending}</span>
            <span className="cd-kpi-label">En attente</span>
          </div>
          <div className="cd-kpi cd-kpi--purple">
            <span className="cd-kpi-val">{avgScore}%</span>
            <span className="cd-kpi-label">Score moyen</span>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="loading-state">Chargement de votre espace...</div>
      ) : (
        <div className="cd-grid">
          <section className="cd-section">
            <div className="cd-section-title">
              <span className="cd-section-icon">📄</span>
              Mon CV & Compétences IA
            </div>
            <CVUpload activeCv={activeCv} onUploaded={handleCvUploaded} />
          </section>

          <section className="cd-section">
            <div className="cd-section-title">
              <span className="cd-section-icon">🎯</span>
              Mes Candidatures
              <span className="cd-section-count">{candidatures.length}</span>
            </div>
            <CandidatureList candidatures={candidatures} />
          </section>
        </div>
      )}
    </div>
  );
}