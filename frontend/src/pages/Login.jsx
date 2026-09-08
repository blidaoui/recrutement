import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const API_BASE = import.meta.env?.VITE_API_URL || 'http://localhost:5000';

export default function Login() {
  const [activeTab, setActiveTab] = useState('login'); // 'login' | 'register' | 'forgot'
  const { login, register } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // Form states
  const [email, setEmail] = useState('');
  const [motDePasse, setMotDePasse] = useState('');
  const [nom, setNom] = useState('');
  const [role, setRole] = useState('CANDIDAT');

  // Forgot-password states
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotSent, setForgotSent] = useState(false);

  // Status states
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get('error') === 'google_failed') {
      setError('Échec de la connexion avec Google. Assurez-vous d\'avoir configuré la clé GOOGLE_CLIENT_SECRET valide dans le fichier .env.');
    } else if (params.get('error') === 'email_exists') {
      setError('Un compte avec cet email existe déjà. Veuillez vous connecter avec votre mot de passe.');
    }
  }, [location.search]);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await login(email, motDePasse);
      navigate('/offres');
    } catch (err) {
      setError(err.response?.data?.message || 'Erreur lors de la connexion');
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await register({ nom, email, motDePasse, role });
      navigate('/offres');
    } catch (err) {
      setError(err.response?.data?.message || 'Erreur lors de l\'inscription');
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch(`${API_BASE}/api/auth/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: forgotEmail }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Erreur lors de la demande');
      setForgotSent(true);
    } catch (err) {
      setError(err.message || 'Erreur lors de la demande de réinitialisation');
    } finally {
      setLoading(false);
    }
  };

  // ✅ Reset fields when arriving on /login
  useEffect(() => {
    if (location.pathname === '/login') {
      setEmail('');
      setMotDePasse('');
      setNom('');
      setRole('CANDIDAT');
      setForgotEmail('');
      setForgotSent(false);
    }
  }, [location.pathname]);

  // ✅ Optional: force remount when route changes
  const formKey = location.pathname + activeTab;
  return (
    <div className="auth-container">
      <div className="auth-card">
        <div className="auth-header">
          <h2>Plateforme IA Recrutement</h2>
          <p>Choisissez votre mode d'accès</p>
        </div>

        {/* 3 Choix d'authentification */}
        {activeTab !== 'forgot' && (
          <div className="auth-tabs">
            <button
              type="button"
              className={`tab-btn ${activeTab === 'login' ? 'active' : ''}`}
              onClick={() => { setActiveTab('login'); setError(''); setEmail(''); setMotDePasse(''); setNom(''); }}
            >
              Se connecter
            </button>
            <button
              type="button"
              className={`tab-btn ${activeTab === 'register' ? 'active' : ''}`}
              onClick={() => { setActiveTab('register'); setError(''); setEmail(''); setMotDePasse(''); setNom(''); }}
            >
              Créer un compte
            </button>
          </div>
        )}

        {error && <div className="auth-error-alert">{error}</div>}

        {activeTab === 'login' && (
          /* Choix 1: Connexion par Email / Mot de passe */
          <form onSubmit={handleLogin} autoComplete="off" className="auth-form">
            <div className="form-group">
              <label htmlFor="login-email">Adresse Email</label>
              <input
                id="login-email"
                type="email"
                placeholder="votre.email@exemple.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="new-email"
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="login-password">Mot de passe</label>
              <div className="profile-password-wrap">
                <input
                  id="login-password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder=""
                  value={motDePasse}
                  onChange={(e) => setMotDePasse(e.target.value)}
                  autoComplete="new-password"
                  required
                />
                <button type="button" className="profile-eye-btn" onClick={() => setShowPassword(!showPassword)}>
                  {showPassword ? '🙈' : '👁️'}
                </button>
              </div>
              <div className="forgot-password-row">
                <button
                  type="button"
                  className="link-btn"
                  onClick={() => { setActiveTab('forgot'); setError(''); setForgotSent(false); setForgotEmail(email); }}
                >
                  Mot de passe oublié ?
                </button>
              </div>
            </div>

            <button type="submit" className="btn-submit" disabled={loading}>
              {loading ? 'Connexion en cours...' : 'Se connecter'}
            </button>
          </form>
        )}

        {activeTab === 'register' && (
          /* Choix 2: Inscription classique */
          <form onSubmit={handleRegister} autoComplete="off" className="auth-form">
            <div className="form-group">
              <label htmlFor="register-nom">Nom complet</label>
              <input
                id="register-nom"
                type="text"
                placeholder="Jean Dupont"
                value={nom}
                onChange={(e) => setNom(e.target.value)}
                autoComplete="off"
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="register-email">Adresse Email</label>
              <input
                id="register-email"
                type="email"
                placeholder="votre.email@exemple.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="new-email"
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="register-password">Mot de passe (min. 6 caractères)</label>
              <div className="profile-password-wrap">
                <input
                  id="register-password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder=""
                  value={motDePasse}
                  onChange={(e) => setMotDePasse(e.target.value)}
                  minLength={6}
                  autoComplete="new-password"
                  required
                />
                <button type="button" className="profile-eye-btn" onClick={() => setShowPassword(!showPassword)}>
                  {showPassword ? '🙈' : '👁️'}
                </button>
              </div>
            </div>

            <div className="form-group">
              <label>Type de compte :</label>
              <div className="role-selector">
                <button
                  type="button"
                  className={`role-btn ${role === 'CANDIDAT' ? 'selected' : ''}`}
                  onClick={() => setRole('CANDIDAT')}
                >
                  Candidat
                </button>
                <button
                  type="button"
                  className={`role-btn ${role === 'RECRUTEUR' ? 'selected' : ''}`}
                  onClick={() => setRole('RECRUTEUR')}
                >
                   Recruteur
                </button>
              </div>
            </div>

            <button type="submit" className="btn-submit" disabled={loading}>
              {loading ? 'Création en cours...' : 'Créer mon compte'}
            </button>
          </form>
        )}

        {activeTab === 'forgot' && (
          /* Choix 3: Mot de passe oublié */
          <div className="auth-form">
            {!forgotSent ? (
              <form onSubmit={handleForgotPassword}>
                <div className="auth-icon-badge">
                  <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="5" width="18" height="14" rx="2.5" />
                    <path d="m3.5 6.5 8.5 6.5 8.5-6.5" />
                  </svg>
                </div>
                <p className="auth-subtext">
                  Saisissez votre adresse email, nous vous enverrons un lien pour réinitialiser votre mot de passe.
                </p>
                <div className="form-group">
                  <label htmlFor="forgot-email">Adresse Email</label>
                  <input
                    id="forgot-email"
                    type="email"
                    placeholder="votre.email@exemple.com"
                    value={forgotEmail}
                    onChange={(e) => setForgotEmail(e.target.value)}
                    required
                  />
                </div>

                <button type="submit" className="btn-submit" disabled={loading}>
                  {loading ? 'Envoi en cours...' : 'Envoyer le lien de réinitialisation'}
                </button>

                <button
                  type="button"
                  className="link-btn back-to-login-link"
                  onClick={() => { setActiveTab('login'); setError(''); }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="m12 19-7-7 7-7" />
                    <path d="M19 12H5" />
                  </svg>
                  Retour à la connexion
                </button>
              </form>
            ) : (
              <div className="auth-success-alert">
                <div className="auth-icon-badge auth-icon-badge--success">
                  <svg viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M20 6 9 17l-5-5" />
                  </svg>
                </div>
                <p>
                  Si un compte existe avec l'adresse <strong>{forgotEmail}</strong>, un email contenant
                  un lien de réinitialisation vient de vous être envoyé.
                </p>
                <p style={{ color: '#94a3b8', fontSize: '0.82rem' }}>Pensez à vérifier vos spams.</p>
                <button
                  type="button"
                  className="link-btn back-to-login-link"
                  onClick={() => { setActiveTab('login'); setForgotSent(false); }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="m12 19-7-7 7-7" />
                    <path d="M19 12H5" />
                  </svg>
                  Retour à la connexion
                </button>
              </div>
            )}
          </div>
        )}

        {activeTab !== 'forgot' && (
          <>
            <div className="auth-divider">
              <span>OU</span>
            </div>

            {/* Choix 3: Google OAuth */}
            <a href={`${API_BASE}/api/auth/google`} className="btn-google-oauth">
              <svg className="google-icon" viewBox="0 0 24 24" width="20" height="20">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                />
              </svg>
              Continuer avec Google
            </a>
          </>
        )}
      </div>
    </div>
  );
}