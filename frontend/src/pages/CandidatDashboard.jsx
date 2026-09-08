import { useEffect, useState } from 'react';
import api from '../api/axios';
import CVUpload from '../components/CVUpload';
import CandidatureList from '../components/CandidatureList';
import ProfileSection from './ProfileSection';


export default function CondidatDashboard() {
  const [activeTab, setActiveTab] = useState('dashboard'); // 'dashboard' | 'profile'

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

  return (
    <div className="page-dashboard">
      <div className="dashboard-header">
        <h2>Mon Espace Candidat</h2>
        <p>Gérez votre CV, visualisez vos compétences détectées et suivez vos candidatures.</p>
      </div>

      {loading ? (
        <div className="loading-state">Chargement de votre espace...</div>
      ) : (
        <>
          <section className="dashboard-section">
            <h3>Mon CV & Compétences IA</h3>
            <CVUpload activeCv={activeCv} onUploaded={handleCvUploaded} />
          </section>

          <section className="dashboard-section">
            <h3>Mes Candidatures en cours ({candidatures.length})</h3>
            <CandidatureList candidatures={candidatures} />
          </section>
        </>
      )}
    </div>
  );
}