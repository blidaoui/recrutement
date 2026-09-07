import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Login() {
  const [activeTab, setActiveTab] = useState('login'); 
  const { login, register } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // Form states
  const [email, setEmail] = useState('');
  const [motDePasse, setMotDePasse] = useState('');
  const [nom, setNom] = useState('');
  const [role, setRole] = useState('CANDIDAT');

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

  return (
    <div className="auth-container">
      <div className="auth-card">
        <div className="auth-header">
          <h2>Plateforme IA Recrutement</h2>
          <p>Choisissez votre mode d'accès</p>
        </div>

        {/* 3 Choix d'authentification */}
        <div className="auth-tabs">
          <button
            type="button"
            className={`tab-btn ${activeTab === 'login' ? 'active' : ''}`}
            onClick={() => { setActiveTab('login'); setError(''); }}
          >
            Se connecter
          </button>
          <button
            type="button"
            className={`tab-btn ${activeTab === 'register' ? 'active' : ''}`}
            onClick={() => { setActiveTab('register'); setError(''); }}
          >
            Créer un compte
          </button>
        </div>

        {error && <div className="auth-error-alert">{error}</div>}

        {activeTab === 'login' ? (
          /* Choix 1: Connexion par Email / Mot de passe */
          <form onSubmit={handleLogin} className="auth-form">
            <div className="form-group">
              <label htmlFor="login-email">Adresse Email</label>
              <input
                id="login-email"
                type="email"
                placeholder="votre.email@exemple.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
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
                  required
                />
                <button type="button" className="profile-eye-btn" onClick={() => setShowPassword(!showPassword)}>
                  {showPassword ? '🙈' : '👁️'}
                </button>
              </div>
            </div>

            <button type="submit" className="btn-submit" disabled={loading}>
              {loading ? 'Connexion en cours...' : 'Se connecter'}
            </button>
          </form>
        ) : (
          /* Choix 2: Inscription classique */
          <form onSubmit={handleRegister} className="auth-form">
            <div className="form-group">
              <label htmlFor="register-nom">Nom complet</label>
              <input
                id="register-nom"
                type="text"
                placeholder="Jean Dupont"
                value={nom}
                onChange={(e) => setNom(e.target.value)}
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

        <div className="auth-divider">
          <span>OU</span>
        </div>

        {/* Choix 3: Google OAuth */}
        <a href="http://localhost:5000/api/auth/google" className="btn-google-oauth">
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
      </div>
    </div>
  );
}
