import { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const API_BASE = import.meta.env?.VITE_API_URL || 'http://localhost:5000';

// Page reached via the reset link sent by email: /reset-password/:token
export default function ResetPassword() {
  const { token } = useParams();
  const navigate = useNavigate();
  const { setUser } = useAuth();

  const [motDePasse, setMotDePasse] = useState('');
  const [confirmMotDePasse, setConfirmMotDePasse] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (motDePasse.length < 6) {
      setError('Le mot de passe doit contenir au moins 6 caractères');
      return;
    }
    if (motDePasse !== confirmMotDePasse) {
      setError('Les mots de passe ne correspondent pas');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/auth/reset-password/${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ motDePasse }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Erreur lors de la réinitialisation');

      // Backend already set the auth cookie at this point;
      // update context immediately so the app reflects the login without a reload.
      if (data.user) setUser(data.user);

      setSuccess(true);
      setTimeout(() => navigate('/offres'), 2000);
    } catch (err) {
      setError(err.message || 'Lien invalide ou expiré');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-card">
        <div className="auth-icon-badge">
          <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="8" cy="15" r="4" />
            <path d="M10.5 12.5 20 3M17 6l2.5 2.5M14 9l2 2" />
          </svg>
        </div>
        <div className="auth-header">
          <h2>Réinitialiser le mot de passe</h2>
          <p>Choisissez un nouveau mot de passe</p>
        </div>

        {error && <div className="auth-error-alert">{error}</div>}

        {success ? (
          <div className="auth-success-alert">
            <div className="auth-icon-badge auth-icon-badge--success">
              <svg viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 6 9 17l-5-5" />
              </svg>
            </div>
            <p>Mot de passe réinitialisé avec succès.</p>
            <p style={{ color: '#94a3b8', fontSize: '0.82rem' }}>Redirection en cours...</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="auth-form">
            <div className="form-group">
              <label htmlFor="reset-password">Nouveau mot de passe (min. 6 caractères)</label>
              <div className="profile-password-wrap">
                <input
                  id="reset-password"
                  type={showPassword ? 'text' : 'password'}
                  value={motDePasse}
                  onChange={(e) => setMotDePasse(e.target.value)}
                  minLength={6}
                  required
                />
                <button type="button" className="profile-eye-btn" onClick={() => setShowPassword(!showPassword)}>
                  {showPassword ? '🙈' : '👁️'}
                </button>
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="reset-confirm-password">Confirmer le mot de passe</label>
              <input
                id="reset-confirm-password"
                type={showPassword ? 'text' : 'password'}
                value={confirmMotDePasse}
                onChange={(e) => setConfirmMotDePasse(e.target.value)}
                minLength={6}
                required
              />
            </div>

            <button type="submit" className="btn-submit" disabled={loading}>
              {loading ? 'Réinitialisation en cours...' : 'Réinitialiser le mot de passe'}
            </button>

            <Link to="/login" className="link-btn back-to-login-link">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="m12 19-7-7 7-7" />
                <path d="M19 12H5" />
              </svg>
              Retour à la connexion
            </Link>
          </form>
        )}
      </div>
    </div>
  );
}