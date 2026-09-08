import { useEffect, useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
  PieChart, Pie, Legend,
} from 'recharts';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import ProfileSection from './ProfileSection';

const ROLE_LABELS = { CANDIDAT: 'candidat', RECRUTEUR: 'recruteur', ADMIN: 'admin' };
const ROLE_COLORS = { CANDIDAT: '#3b82f6', RECRUTEUR: '#8b5cf6', ADMIN: '#ef4444' };
const STATUT_COLORS = { EN_ATTENTE: '#f59e0b', ACCEPTEE: '#22c55e', REFUSEE: '#ef4444' };

const PONDERATIONS = [
  { label: 'Compétences', value: '45%' },
  { label: 'Expérience', value: '20%' },
  { label: 'Formation', value: '15%' },
  { label: 'Sémantique', value: '20%' },
];

export default function AdminDashboard() {
  const { user } = useAuth();
  const [tab, setTab] = useState('dashboard');
  const [stats, setStats] = useState(null);
  const [users, setUsers] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('TOUS');
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [showStatutDetail, setShowStatutDetail] = useState(false);
  const [showTopOffres, setShowTopOffres] = useState(false);

  // Modal création de compte
  const [showAddModal, setShowAddModal] = useState(false);
  const [newNom, setNewNom] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newMotDePasse, setNewMotDePasse] = useState('');
  const [newRole, setNewRole] = useState('CANDIDAT');
  const [addLoading, setAddLoading] = useState(false);
  const [addError, setAddError] = useState('');
  const [addSuccess, setAddSuccess] = useState('');

  useEffect(() => {
    api.get('/stats')
      .then((res) => setStats(res.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const chargerUsers = async () => {
    setLoadingUsers(true);
    try {
      const params = {};
      if (search) params.search = search;
      if (roleFilter !== 'TOUS') params.role = roleFilter;
      const res = await api.get('/admin/users', { params });
      setUsers(res.data.users);
      setTotal(res.data.total);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingUsers(false);
    }
  };

  useEffect(() => { chargerUsers(); }, [search, roleFilter]);

  const resetAddForm = () => {
    setNewNom('');
    setNewEmail('');
    setNewMotDePasse('');
    setNewRole('CANDIDAT');
    setAddError('');
    setAddSuccess('');
  };

  const handleCreateUser = async (e) => {
    e.preventDefault();
    setAddError('');
    setAddSuccess('');
    setAddLoading(true);
    try {
      const res = await api.post('/admin/users', {
        nom: newNom,
        email: newEmail,
        motDePasse: newMotDePasse,
        role: newRole,
      });
      setAddSuccess(res.data.message || 'Compte créé avec succès');
      chargerUsers();
      api.get('/stats').then((resStats) => setStats(resStats.data)).catch(() => {});
      setTimeout(() => {
        setShowAddModal(false);
        resetAddForm();
      }, 1000);
    } catch (err) {
      setAddError(err.response?.data?.message || 'Erreur lors de la création du compte');
    } finally {
      setAddLoading(false);
    }
  };

  const handleToggle = async (id) => {
    try {
      await api.patch(`/admin/users/${id}/toggle`);
      chargerUsers();
    } catch (err) {
      alert(err.response?.data?.message || 'Erreur');
    }
  };

  const handleDelete = async (id) => {
    try {
      await api.delete(`/admin/users/${id}`);
      setConfirmDelete(null);
      chargerUsers();
    } catch (err) {
      alert(err.response?.data?.message || 'Erreur lors de la suppression');
    }
  };

  const statutsData = stats
    ? Object.entries(stats.statuts).map(([name, value]) => ({
        name: name === 'EN_ATTENTE' ? 'En attente' : name === 'ACCEPTEE' ? 'Acceptée' : 'Refusée',
        value, fill: STATUT_COLORS[name],
      }))
    : [];

  const topOffresData = stats?.admin?.topOffres || [];

  return (
    <div className="page-dashboard">
      <div className="dashboard-header">
        <h2>Tableau de bord</h2>
        <p>Bonjour {user?.nom}, voici l'état de votre activité.</p>
      </div>

      <div className="auth-tabs" style={{ marginBottom: '1.5rem' }}>
        <button type="button" className={`tab-btn ${tab === 'dashboard' ? 'active' : ''}`} onClick={() => setTab('dashboard')}>
          Tableau de bord
        </button>
        <button type="button" className={`tab-btn ${tab === 'profile' ? 'active' : ''}`} onClick={() => setTab('profile')}>
          Mon profil
        </button>
      </div>

      {tab === 'profile' && <ProfileSection />}

      {tab === 'dashboard' && (
      <>
      {/* KPI Cards */}
      {!loading && stats?.admin && (
        <div className="stats-kpi-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))' }}>
          <div className="kpi-card">
            <span className="kpi-value">{stats.admin.totalComptes}</span>
            <span className="kpi-label">comptes</span>
          </div>
          <div className="kpi-card">
            <span className="kpi-value">{stats.admin.totalCandidats}</span>
            <span className="kpi-label">candidats</span>
          </div>
          <div className="kpi-card">
            <span className="kpi-value">{stats.totalOffres}</span>
            <span className="kpi-label">offres au total</span>
          </div>
          <div className="kpi-card kpi-highlight">
            <span className="kpi-value">{stats.admin.totalCVs}</span>
            <span className="kpi-label">CV analysés</span>
          </div>
        </div>
      )}

      {/* Charts row */}
      {!loading && stats && (
        <div className="stats-charts-grid">
          {/* Candidatures par statut */}
          <div className="stats-card">
            <h3>Candidatures par statut</h3>
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie
                  data={statutsData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="45%"
                  outerRadius={85}
                  innerRadius={40}
                  labelLine={false}
                  label={({ cx, cy, midAngle, innerRadius, outerRadius, value }) => {
                    if (value === 0) return null;
                    const RADIAN = Math.PI / 180;
                    const r = innerRadius + (outerRadius - innerRadius) * 0.5;
                    const x = cx + r * Math.cos(-midAngle * RADIAN);
                    const y = cy + r * Math.sin(-midAngle * RADIAN);
                    return <text x={x} y={y} fill="white" textAnchor="middle" dominantBaseline="central" fontSize={13} fontWeight={700}>{value}</text>;
                  }}
                >
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
                      <td><span style={{ color: s.fill }}>●</span> {s.name}</td>
                      <td><strong>{s.value}</strong></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Offres les plus demandées */}
          <div className="stats-card">
            <h3>Offres les plus demandées</h3>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={topOffresData} layout="vertical" margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} />
                <YAxis type="category" dataKey="titre" width={130} tick={{ fontSize: 10 }} />
                <Tooltip formatter={(v) => [v, 'Candidatures']} />
                <Bar dataKey="nbCandidatures" fill="#6366f1" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
            <button type="button" className="btn-toggle-text" onClick={() => setShowTopOffres(!showTopOffres)}>
              {showTopOffres ? 'Masquer les données' : '› Voir les données'}
            </button>
            {showTopOffres && (
              <table className="mini-stats-table">
                <tbody>
                  {topOffresData.map((o) => (
                    <tr key={o.titre}>
                      <td>{o.titre}</td>
                      <td><strong>{o.nbCandidatures}</strong></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* Comptes */}
      <div className="stats-card stats-card-full">
        <div className="stats-card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h3 style={{ margin: 0 }}>Comptes ({total})</h3>
          <button
            type="button"
            className="btn-submit-offre"
            style={{ padding: '0.45rem 0.95rem', fontSize: '0.85rem', cursor: 'pointer' }}
            onClick={() => setShowAddModal(true)}
          >
            + Ajouter un compte
          </button>
        </div>
        <div className="admin-filters">
          <input type="text" placeholder="Rechercher par nom ou email..." value={search}
            onChange={(e) => setSearch(e.target.value)} className="admin-search-input" />
          <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)} className="admin-role-select">
            <option value="TOUS">Tous les rôles</option>
            <option value="CANDIDAT">Candidat</option>
            <option value="RECRUTEUR">Recruteur</option>
            <option value="ADMIN">Admin</option>
          </select>
        </div>

        {loadingUsers ? (
          <div className="loading-state">Chargement...</div>
        ) : (
          <table className="candidatures-table">
            <thead>
              <tr>
                <th>Utilisateur</th><th>Rôle</th><th>Offres</th><th>CV</th>
                <th>Candidatures</th><th>Inscrit le</th><th>État</th><th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => {
                const isAdmin = u.role === 'ADMIN';
                return (
                  <tr key={u.id} style={{ opacity: u.actif ? 1 : 0.55 }}>
                    <td>
                      <div className="candidat-info">
                        <span className="candidat-nom">{u.nom}</span>
                        <span className="candidat-email">{u.email}</span>
                      </div>
                    </td>
                    <td>
                      <span className="mini-skill-badge" style={{ background: ROLE_COLORS[u.role] + '22', color: ROLE_COLORS[u.role] }}>
                        {ROLE_LABELS[u.role]}
                      </span>
                    </td>
                    <td>{u._count.offres}</td>
                    <td>{u._count.cvs}</td>
                    <td>{u._count.candidatures}</td>
                    <td>{new Date(u.createdAt).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })}</td>
                    <td>
                      <span className={`statut-pill ${u.actif ? 'statut-acceptee' : 'statut-refusee'}`}>
                        {u.actif ? 'Actif' : 'Désactivé'}
                      </span>
                    </td>
                    <td>
                      {isAdmin ? (
                        <span className="text-muted" style={{ fontSize: '.8rem' }}>—</span>
                      ) : (
                        <div className="action-buttons-group">
                          <button type="button" className={`btn-action ${u.actif ? 'btn-reject' : 'btn-accept'}`}
                            onClick={() => handleToggle(u.id)}>
                            {u.actif ? 'Désactiver' : 'Activer'}
                          </button>
                          <button type="button" className="btn-action btn-reject"
                            onClick={() => setConfirmDelete(u)}>
                            Supprimer
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
              {users.length === 0 && (
                <tr><td colSpan={8} className="text-muted" style={{ textAlign: 'center', padding: '1rem' }}>Aucun utilisateur trouvé.</td></tr>
              )}
            </tbody>
          </table>
        )}
      </div>
      </>
      )}

      {/* Modal Ajouter un compte */}
      {showAddModal && (
        <div className="modal-overlay">
          <div className="modal-card" style={{ maxWidth: 460 }}>
            <div className="modal-header">
              <h3>Ajouter un compte</h3>
              <button
                type="button"
                className="close-modal-btn"
                onClick={() => {
                  setShowAddModal(false);
                  resetAddForm();
                }}
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleCreateUser} style={{ padding: '1.25rem' }}>
              {addError && <div className="form-feedback form-feedback-error" style={{ marginBottom: '1rem' }}>{addError}</div>}
              {addSuccess && <div className="form-feedback" style={{ marginBottom: '1rem' }}>{addSuccess}</div>}

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.9rem' }}>
                <div>
                  <label style={{ display: 'block', fontWeight: 600, fontSize: '0.85rem', color: '#334155', marginBottom: '0.3rem' }}>
                    Nom complet *
                  </label>
                  <input
                    type="text"
                    placeholder="Ex: Jean Dupont"
                    value={newNom}
                    onChange={(e) => setNewNom(e.target.value)}
                    required
                    style={{ width: '100%', padding: '0.65rem 0.85rem', borderRadius: 8, border: '1.5px solid #e2e8f0', fontSize: '0.9rem', outline: 'none', boxSizing: 'border-box' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontWeight: 600, fontSize: '0.85rem', color: '#334155', marginBottom: '0.3rem' }}>
                    Adresse Email *
                  </label>
                  <input
                    type="email"
                    placeholder="jean.dupont@example.com"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    required
                    style={{ width: '100%', padding: '0.65rem 0.85rem', borderRadius: 8, border: '1.5px solid #e2e8f0', fontSize: '0.9rem', outline: 'none', boxSizing: 'border-box' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontWeight: 600, fontSize: '0.85rem', color: '#334155', marginBottom: '0.3rem' }}>
                    Mot de passe *
                  </label>
                  <input
                    type="password"
                    placeholder="Au moins 6 caractères"
                    value={newMotDePasse}
                    onChange={(e) => setNewMotDePasse(e.target.value)}
                    required
                    minLength={6}
                    style={{ width: '100%', padding: '0.65rem 0.85rem', borderRadius: 8, border: '1.5px solid #e2e8f0', fontSize: '0.9rem', outline: 'none', boxSizing: 'border-box' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontWeight: 600, fontSize: '0.85rem', color: '#334155', marginBottom: '0.3rem' }}>
                    Rôle de l'utilisateur *
                  </label>
                  <select
                    value={newRole}
                    onChange={(e) => setNewRole(e.target.value)}
                    style={{ width: '100%', padding: '0.65rem 0.85rem', borderRadius: 8, border: '1.5px solid #e2e8f0', fontSize: '0.9rem', background: '#fff', outline: 'none', boxSizing: 'border-box' }}
                  >
                    <option value="CANDIDAT">Candidat</option>
                    <option value="RECRUTEUR">Recruteur</option>
                    <option value="ADMIN">Administrateur (Admin)</option>
                  </select>
                </div>
              </div>

              <div className="modal-actions" style={{ marginTop: '1.5rem' }}>
                <button
                  type="button"
                  className="btn-cancel"
                  onClick={() => {
                    setShowAddModal(false);
                    resetAddForm();
                  }}
                  disabled={addLoading}
                >
                  Annuler
                </button>
                <button type="submit" className="btn-modal-submit" disabled={addLoading}>
                  {addLoading ? 'Création...' : 'Créer le compte'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Confirm delete modal */}
      {confirmDelete && (
        <div className="modal-overlay">
          <div className="modal-card" style={{ maxWidth: 400 }}>
            <div className="modal-header">
              <h3>Confirmer la suppression</h3>
              <button type="button" className="close-modal-btn" onClick={() => setConfirmDelete(null)}>X</button>
            </div>
            <div style={{ padding: '1rem' }}>
              <p>Supprimer définitivement le compte de <strong>{confirmDelete.nom}</strong> ({confirmDelete.email}) ?</p>
              <p className="stats-card-subtitle">Cette action supprimera aussi ses CVs, candidatures et offres.</p>
            </div>
            <div className="modal-actions">
              <button type="button" className="btn-action btn-reject" onClick={() => handleDelete(confirmDelete.id)}>
                Confirmer la suppression
              </button>
              <button type="button" className="btn-cancel" onClick={() => setConfirmDelete(null)}>Annuler</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}