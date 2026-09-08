import { useEffect, useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
  PieChart, Pie, Legend,
} from 'recharts';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import CandidatureList from '../components/CandidatureList';
import PublierOffreForm from '../components/PublierOffreForm';
import ProfileSection from './ProfileSection';
import { TbPointFilled } from "react-icons/tb";
import { PiStudentFill } from "react-icons/pi";
import { CiTimer } from "react-icons/ci";
import { MdOutlinePriceCheck } from "react-icons/md";

const SCORE_COLORS = ['#ef4444', '#f97316', '#3b82f6', '#22c55e'];
const STATUT_COLORS = { EN_ATTENTE: '#f59e0b', ACCEPTEE: '#22c55e', REFUSEE: '#ef4444' };

export default function RecruteurDashboard() {
  const { user } = useAuth();
  const [tab, setTab] = useState('offres');

  const [offres, setOffres] = useState([]);
  const [offreSelectionnee, setOffreSelectionnee] = useState(null);
  const [candidatures, setCandidatures] = useState([]);
  const [loadingCandidatures, setLoadingCandidatures] = useState(false);
  const [showPublishForm, setShowPublishForm] = useState(false);
  const [offreEnEdition, setOffreEnEdition] = useState(null);
  const [offreASupprimer, setOffreASupprimer] = useState(null);

  const [stats, setStats] = useState(null);
  const [loadingStats, setLoadingStats] = useState(false);
  const [showStatutDetail, setShowStatutDetail] = useState(false);
  const [showPerfChart, setShowPerfChart] = useState(false);

  const chargerOffres = () => {
    api.get('/offres').then((res) => {
      const toutesLesOffres = res.data.offres || [];
      // '/offres' est l'endpoint public partagé avec la page Offres (visible par tous les rôles).
      // Ici, sur le tableau de bord recruteur, on ne garde que les offres du recruteur connecté.
      const mesOffres = toutesLesOffres.filter((o) => o.recruteurId === user?.id);
      setOffres(mesOffres);
    });
  };

  useEffect(() => { chargerOffres(); }, [user]);

  useEffect(() => {
    if (tab === 'stats' && !stats) {
      setLoadingStats(true);
      api.get('/stats')
        .then((res) => setStats(res.data))
        .catch(console.error)
        .finally(() => setLoadingStats(false));
    }
  }, [tab]);

  const voirCandidatures = async (offreId) => {
    setOffreSelectionnee(offreId);
    setLoadingCandidatures(true);
    try {
      const res = await api.get(`/candidatures/offre/${offreId}`);
      setCandidatures(res.data.candidatures);
    } catch (err) { console.error(err); }
    finally { setLoadingCandidatures(false); }
  };

  const changerStatut = async (candidatureId, nouveauStatut) => {
    try {
      await api.patch(`/candidatures/${candidatureId}/statut`, { statut: nouveauStatut });
      if (offreSelectionnee) voirCandidatures(offreSelectionnee);
    } catch (err) { alert(err.response?.data?.message || 'Erreur lors du changement de statut'); }
  };

  const offreActuelle = offres.find((o) => o.id === offreSelectionnee);

  const ouvrirEdition = (e, offre) => {
    e.stopPropagation();
    setOffreEnEdition(offre);
    setShowPublishForm(true);
  };

  const fermerFormulaire = () => {
    setShowPublishForm(false);
    setOffreEnEdition(null);
  };

  const confirmerSuppression = async () => {
    try {
      await api.delete(`/offres/${offreASupprimer.id}`);
      setOffreASupprimer(null);
      if (offreSelectionnee === offreASupprimer.id) setOffreSelectionnee(null);
      chargerOffres();
    } catch (err) { alert(err.response?.data?.message || 'Erreur lors de la suppression'); }
  };

  const tranchesData = stats
    ? Object.entries(stats.tranches).map(([label, value], i) => ({ label, value, color: SCORE_COLORS[i] }))
    : [];

  const statutsData = stats
    ? Object.entries(stats.statuts).map(([name, value]) => ({
        name: name === 'EN_ATTENTE' ? 'En attente' : name === 'ACCEPTEE' ? 'Acceptée' : 'Refusée',
        value, fill: STATUT_COLORS[name],
      }))
    : [];

  return (
    <div className="page-dashboard">
      <div className="dashboard-header">
        <h2>Tableau de bord</h2>
        <p>Bonjour {user?.nom}, voici l'état de votre activité.</p>
      </div>

      <div className="auth-tabs" style={{ marginBottom: '1.5rem' }}>
        <button type="button" className={`tab-btn ${tab === 'offres' ? 'active' : ''}`} onClick={() => setTab('offres')}>
          Mes offres
        </button>
        <button type="button" className={`tab-btn ${tab === 'stats' ? 'active' : ''}`} onClick={() => setTab('stats')}>
          Statistiques
        </button>
        <button type="button" className={`tab-btn ${tab === 'profile' ? 'active' : ''}`} onClick={() => setTab('profile')}>
          Mon profil
        </button>
      </div>

      {/* ── OFFRES TAB ── */}
      {tab === 'offres' && (
        <>
          {showPublishForm ? (
            <div className="dashboard-card" style={{ marginBottom: '1.5rem' }}>
              <div className="stats-card-header">
                <h3>{offreEnEdition ? 'Modifier l\'offre' : 'Publier une offre'}</h3>
                <button type="button" className="btn-cancel-sm" onClick={fermerFormulaire}>✕ Fermer</button>
              </div>
              <PublierOffreForm
                offre={offreEnEdition}
                onPublished={() => { chargerOffres(); fermerFormulaire(); }}
                onCancel={fermerFormulaire}
              />
            </div>
          ) : (
            <div style={{ marginBottom: '1.25rem' }}>
              <button type="button" className="btn-submit-offre" onClick={() => { setOffreEnEdition(null); setShowPublishForm(true); }}>
                + Publier une nouvelle offre
              </button>
            </div>
          )}

          <section className="dashboard-card list-card">
            <h3>Mes offres d'emploi publiées ({offres.length})</h3>
            {offres.length === 0 ? (
              <div className="empty-state">Vous n'avez publié aucune offre pour l'instant.</div>
            ) : (
              <div className="offres-recruteur-list">
                {offres.map((offre) => {
                  const nbCandidats = offre.candidatures?.length || 0;
                  const isSelected = offre.id === offreSelectionnee;
                  return (
                    <div key={offre.id} className={`offre-recruteur-item ${isSelected ? 'active' : ''}`}
                      onClick={() => voirCandidatures(offre.id)}>
                      <div className="item-header">
                        <div>
                          <h4 className="item-title">{offre.titre}</h4>
                          {offre.entreprise && <span className="offre-entreprise">{offre.entreprise}</span>}
                        </div>
                        <span className="candidat-count-badge">{nbCandidats} candidature{nbCandidats > 1 ? 's' : ''}</span>
                      </div>
                      <div className="offre-meta-row">
                        {offre.experienceMin > 0 && <span className="offre-meta-tag"><CiTimer />{offre.experienceMin} ans exp.</span>}
                        {offre.niveauEtude && offre.niveauEtude !== 'Non précisé' && <span className="offre-meta-tag"><PiStudentFill /> {offre.niveauEtude}</span>}
                        {offre.salaire && <span className="offre-meta-tag"><MdOutlinePriceCheck /> {offre.salaire} DT</span>}
                        {offre.pays && offre.pays !== 'Non précisé' && <span className="offre-meta-tag"> {offre.pays}</span>}
                        {offre.typeContrat && offre.typeContrat !== 'Non précisé' && <span className="offre-meta-tag">{offre.typeContrat}</span>}
                        <span className={`statut-pill ${offre.statut === 'ouverte' ? 'statut-acceptee' : 'statut-refusee'}`}>{offre.statut}</span>
                      </div>
                      <div className="offre-skills">
                        {offre.skillsObligatoires?.slice(0, 4).map((sk) => (
                          <span key={sk} className="skill-badge skill-required">{sk}</span>
                        ))}
                        {offre.skillsSouhaitees?.slice(0, 3).map((sk) => (
                          <span key={sk} className="skill-badge">{sk}</span>
                        ))}
                      </div>
                      <div className="offre-card-actions">
                        <button type="button" className="btn-voir-candidats"
                          onClick={(e) => { e.stopPropagation(); voirCandidatures(offre.id); }}>
                          {isSelected ? 'Candidatures sélectionnées ' : 'Inspecter les candidatures'  }
                        </button>
                        <button type="button" className="btn-card-edit"
                          onClick={(e) => ouvrirEdition(e, offre)}>
                           Modifier
                        </button>
                        <button type="button" className="btn-card-delete"
                          onClick={(e) => { e.stopPropagation(); setOffreASupprimer(offre); }}>
                           Supprimer
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {offreSelectionnee && (
            <section className="dashboard-card candidatures-inspector" style={{ marginTop: '1.5rem' }}>
              <div className="inspector-header">
                <h3>Classement IA — {offreActuelle?.titre || 'Offre'}</h3>
                <p>Candidats triés par score de matching CV / Offre.</p>
              </div>
              {loadingCandidatures ? (
                <div className="loading-state">Chargement des candidatures...</div>
              ) : (
                <CandidatureList candidatures={candidatures} onUpdateStatut={changerStatut} />
              )}
            </section>
          )}
        </>
      )}

      {/* ── STATS TAB ── */}
      {tab === 'stats' && (
        <>
          {loadingStats ? (
            <div className="loading-state">Chargement des statistiques...</div>
          ) : !stats ? (
            <div className="loading-state">Erreur de chargement.</div>
          ) : (
            <>
              <div className="stats-kpi-grid">
                <div className="kpi-card"><span className="kpi-value">{stats.totalOffres}</span><span className="kpi-label">offres publiées</span></div>
                <div className="kpi-card"><span className="kpi-value">{stats.offresOuvertes}</span><span className="kpi-label">offres ouvertes</span></div>
                <div className="kpi-card"><span className="kpi-value">{stats.totalCandidatures}</span><span className="kpi-label">candidatures reçues</span></div>
                <div className="kpi-card kpi-highlight"><span className="kpi-value">{stats.profilsHautScore}</span><span className="kpi-label">profils à 70% ou plus</span></div>
              </div>

              <div className="stats-charts-grid">
                <div className="stats-card">
                  <h3>Répartition des scores</h3>
                  <p className="stats-card-subtitle">Tranches de score des candidatures reçues, toutes offres confondues.</p>
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={tranchesData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                      <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                      <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                      <Tooltip formatter={(v) => [v, 'Candidatures']} />
                      <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                        {tranchesData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                <div className="stats-card">
                  <h3>Avancement des dossiers</h3>
                  <ResponsiveContainer width="100%" height={260}>
                    <PieChart>
                      <Pie data={statutsData} dataKey="value" nameKey="name"
                        cx="50%" cy="45%" outerRadius={85} innerRadius={40} labelLine={false}
                        label={({ cx, cy, midAngle, innerRadius, outerRadius, value }) => {
                          if (value === 0) return null;
                          const RADIAN = Math.PI / 180;
                          const r = innerRadius + (outerRadius - innerRadius) * 0.5;
                          const x = cx + r * Math.cos(-midAngle * RADIAN);
                          const y = cy + r * Math.sin(-midAngle * RADIAN);
                          return <text x={x} y={y} fill="white" textAnchor="middle" dominantBaseline="central" fontSize={13} fontWeight={700}>{value}</text>;
                        }}>
                        {statutsData.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
                      </Pie>
                      <Legend verticalAlign="bottom" height={36} />
                      <Tooltip formatter={(v, name) => [v, name]} />
                    </PieChart>
                  </ResponsiveContainer>
                  <button type="button" className="btn-toggle-text" onClick={() => setShowStatutDetail(!showStatutDetail)}>
                    {showStatutDetail ? 'Masquer les données' : '› Voir les données'}
                  </button>
                  {showStatutDetail && (
                    <table className="mini-stats-table">
                      <tbody>
                        {statutsData.map((s) => (
                          <tr key={s.name}>
                            <td><span style={{ color: s.fill }}><TbPointFilled /></span> {s.name}</td>
                            <td><strong>{s.value}</strong></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>

              <div className="stats-card stats-card-full">
                <div className="stats-card-header">
                  <h3>Performance par offre</h3>
                  <button type="button" className="btn-toggle-text" onClick={() => setShowPerfChart(!showPerfChart)}>
                    {showPerfChart ? 'Masquer le graphique' : '› Voir les données'}
                  </button>
                </div>
                <table className="candidatures-table">
                  <thead>
                    <tr><th>Offre</th><th>Statut</th><th>Candidatures</th><th>Score moyen</th><th>Meilleur score</th></tr>
                  </thead>
                  <tbody>
                    {stats.performanceParOffre.map((o) => (
                      <tr key={o.id}>
                        <td>{o.titre}</td>
                        <td><span className="statut-pill statut-acceptee">{o.statut}</span></td>
                        <td>{o.nbCandidatures}</td>
                        <td>{o.scoreMoyen}%</td>
                        <td><span className="score-badge score-haut">{o.meilleurScore}%</span></td>
                      </tr>
                    ))}
                    {stats.performanceParOffre.length === 0 && (
                      <tr><td colSpan={5} className="text-muted">Aucune offre publiée.</td></tr>
                    )}
                  </tbody>
                </table>
                {showPerfChart && (
                  <div style={{ marginTop: '1.5rem' }}>
                    <ResponsiveContainer width="100%" height={200}>
                      <BarChart data={stats.performanceParOffre} margin={{ top: 5, right: 10, left: -10, bottom: 40 }}>
                        <XAxis dataKey="titre" tick={{ fontSize: 10 }} angle={-20} textAnchor="end" interval={0} />
                        <YAxis domain={[0, 100]} tick={{ fontSize: 12 }} />
                        <Tooltip formatter={(v, name) => [`${v}%`, name === 'scoreMoyen' ? 'Score moyen' : 'Meilleur score']} />
                        <Bar dataKey="scoreMoyen" fill="#3b82f6" radius={[4, 4, 0, 0]} name="scoreMoyen" />
                        <Bar dataKey="meilleurScore" fill="#22c55e" radius={[4, 4, 0, 0]} name="meilleurScore" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>
            </>
          )}
        </>
      )}

      {/* ── PROFILE TAB ── */}
      {tab === 'profile' && <ProfileSection />}

      {offreASupprimer && (
        <div className="modal-overlay">
          <div className="modal-box">
            <h3>Supprimer l'offre ?</h3>
            <p>L'offre <strong>{offreASupprimer.titre}</strong> et toutes ses candidatures seront supprimées définitivement.</p>
            <div className="modal-actions">
              <button type="button" className="btn-danger" onClick={confirmerSuppression}>Supprimer</button>
              <button type="button" className="btn-cancel" onClick={() => setOffreASupprimer(null)}>Annuler</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}