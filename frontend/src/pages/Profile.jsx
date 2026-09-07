import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../api/axios';

const ROLE_LABELS = { CANDIDAT: 'Candidat', RECRUTEUR: 'Recruteur', ADMIN: 'Administrateur' };
const ROLE_COLORS = { CANDIDAT: '#4361ee', RECRUTEUR: '#764090', ADMIN: '#dc2626' };

export default function Profile() {
  const { user, setUser, logout } = useAuth();
  const navigate = useNavigate();

  const [nom, setNom] = useState(user?.nom || '');
  const [email, setEmail] = useState(user?.email || '');
  const [motDePasse, setMotDePasse] = useState('');
  const [confirmMotDePasse, setConfirmMotDePasse] = useState('');
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState(null); // { type: 'success'|'error', msg }
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleSave = async (e) => {
    e.preventDefault();
    setFeedback(null);
    if (motDePasse && motDePasse !== confirmMotDePasse) {
      setFeedback({ type: 'error', msg: 'Les mots de passe ne correspondent pas.' });
      return;
    }
    setSaving(true);
    try {
      const body = { nom, email };
      if (motDePasse) body.motDePasse = motDePasse;
      const res = await api.put('/auth/profile', body);
      setUser(res.data.user);
      setMotDePasse('');
      setConfirmMotDePasse('');
      setFeedback({ type: 'success', msg: 'Profil mis à jour avec succès !' });
    } catch (err) {
      setFeedback({ type: 'error', msg: err.response?.data?.message || 'Erreur lors de la mise à jour.' });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await api.delete('/auth/profile');
      await logout();
      navigate('/login');
    } catch (err) {
      setFeedback({ type: 'error', msg: err.response?.data?.message || 'Erreur lors de la suppression.' });
      setShowDeleteConfirm(false);
      setDeleting(false);
    }
  };

  const isGoogleOnly = !user?.motDePasse && !!user?.googleId;

  return (
    <div className="profile-page">
      <div className="profile-card">

        {/* Avatar + identity */}
        <div className="profile-avatar-section">
          <div className="profile-avatar">
            {user?.nom?.charAt(0).toUpperCase()}
          </div>
          <div>
            <h2 className="profile-name">{user?.nom}</h2>
            <span className="profile-role-badge" style={{ background: ROLE_COLORS[user?.role] + '20', color: ROLE_COLORS[user?.role], border: `1px solid ${ROLE_COLORS[user?.role]}40` }}>
              {ROLE_LABELS[user?.role]}
            </span>
            {user?.googleId && (
              <span className="profile-google-badge"> Compte Google</span>
            )}
          </div>
        </div>

        {feedback && (
          <div className={`profile-feedback ${feedback.type === 'success' ? 'profile-feedback--success' : 'profile-feedback--error'}`}>
            {feedback.type === 'success' ? '✓' : '✕'} {feedback.msg}
          </div>
        )}

        {/* Edit form */}
        <form onSubmit={handleSave} className="profile-form">
          <h3 className="profile-section-title">Informations personnelles</h3>

          <div className="form-group">
            <label>Nom complet</label>
            <input value={nom} onChange={(e) => setNom(e.target.value)} required />
          </div>

          <div className="form-group">
            <label>Adresse email</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>

          {!isGoogleOnly && (
            <>
              <h3 className="profile-section-title" style={{ marginTop: '1.5rem' }}>Changer le mot de passe</h3>
              <p className="profile-hint">Laissez vide pour conserver le mot de passe actuel.</p>

              <div className="form-group">
                <label>Nouveau mot de passe</label>
                <div className="profile-password-wrap">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={motDePasse}
                    onChange={(e) => setMotDePasse(e.target.value)}
                    placeholder="Min. 6 caractères"
                    minLength={motDePasse ? 6 : undefined}
                  />
                  <button type="button" className="profile-eye-btn" onClick={() => setShowPassword(!showPassword)}>
                    {showPassword ? '🙈' : '👁️'}
                  </button>
                </div>
              </div>

              <div className="form-group">
                <label>Confirmer le mot de passe</label>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={confirmMotDePasse}
                  onChange={(e) => setConfirmMotDePasse(e.target.value)}
                  placeholder="Répétez le mot de passe"
                />
              </div>
            </>
          )}

          {isGoogleOnly && (
            <p className="profile-hint" style={{ marginTop: '0.5rem' }}>
               Votre compte est lié à Google — la connexion par mot de passe n'est pas disponible.
            </p>
          )}

          <button type="submit" className="btn-submit profile-save-btn" disabled={saving}>
            {saving ? 'Enregistrement...' : 'Enregistrer les modifications'}
          </button>
        </form>

        {/* Danger zone */}
        {user?.role !== 'ADMIN' && (
          <div className="profile-danger-zone">
            <h3 className="profile-danger-title"> Zone de danger</h3>
            <p>La suppression de votre compte est irréversible. Toutes vos données (CV, candidatures, offres) seront définitivement effacées.</p>
            <button type="button" className="btn-danger-outline" onClick={() => setShowDeleteConfirm(true)}>
               Supprimer mon compte
            </button>
          </div>
        )}
      </div>

      {/* Delete confirm modal */}
      {showDeleteConfirm && (
        <div className="modal-overlay">
          <div className="modal-box">
            <h3>Supprimer votre compte ?</h3>
            <p>Cette action est <strong>irréversible</strong>. Toutes vos données seront supprimées définitivement.</p>
            <div className="modal-actions">
              <button type="button" className="btn-danger" disabled={deleting} onClick={handleDelete}>
                {deleting ? 'Suppression...' : 'Oui, supprimer'}
              </button>
              <button type="button" className="btn-cancel" onClick={() => setShowDeleteConfirm(false)}>Annuler</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
