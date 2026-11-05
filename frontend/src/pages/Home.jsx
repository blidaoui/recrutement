import { Link, useNavigate } from 'react-router-dom';
import { useEffect } from 'react';
import { useAuth } from '../context/AuthContext';

export default function Home() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && user) navigate('/offres', { replace: true });
  }, [user, loading, navigate]);

  if (loading || user) return null;

  return (
    <div className="home-page">
      {/* Hero */}
      <section className="home-hero">
        <div className="home-hero-content">
          <div className="home-hero-badge">✨ Propulsé par l'IA</div>
          <h1 className="home-hero-title">
            Trouvez le bon match,<br />
            <span className="home-hero-gradient">propulsé par l'IA</span>
          </h1>
          <p className="home-hero-sub">
            Notre plateforme analyse votre CV et le compare intelligemment aux offres disponibles.
            Matching automatique, messagerie temps réel, tableau de bord analytique.
          </p>
          <div className="home-hero-actions">
            <Link to="/login" className="home-btn-primary">Commencer gratuitement</Link>
            <Link to="/offres" className="home-btn-secondary">Voir les offres →</Link>
          </div>
        </div>
        <div className="home-hero-visual">
          <div className="home-hero-card">
            <div className="home-hero-card-header">
              <span className="home-hero-card-dot home-hero-card-dot--green" />
              <span className="home-hero-card-label">Matching IA</span>
            </div>
            <div className="home-hero-card-score">94%</div>
            <div className="home-hero-card-sub">Score de compatibilité</div>
            <div className="home-hero-card-skills">
              {['React', 'Node.js', 'PostgreSQL', 'Docker', 'TypeScript'].map((s) => (
                <span key={s} className="home-hero-card-skill">{s}</span>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="home-features">
        {[
          { icon: '🤖', title: 'Extraction IA', desc: 'Gemini AI analyse votre CV et extrait automatiquement vos compétences sans référentiel limité.' },
          { icon: '🎯', title: 'Matching intelligent', desc: 'Score de compatibilité calculé en temps réel entre votre profil et chaque offre d\'emploi.' },
          { icon: '💬', title: 'Messagerie temps réel', desc: 'Échangez directement avec les recruteurs via notre chat intégré avec pièces jointes.' },
          { icon: '📊', title: 'Tableau de bord', desc: 'Suivez vos candidatures et visualisez vos statistiques avec des graphiques interactifs.' },
        ].map(({ icon, title, desc }) => (
          <div key={title} className="home-feature-card">
            <div className="home-feature-icon">{icon}</div>
            <h3 className="home-feature-title">{title}</h3>
            <p className="home-feature-desc">{desc}</p>
          </div>
        ))}
      </section>

      {/* CTA */}
      <section className="home-cta">
        <h2>Prêt à trouver votre prochain poste ?</h2>
        <p>Rejoignez la plateforme et laissez l'IA travailler pour vous.</p>
        <Link to="/login" className="home-btn-primary">Créer un compte</Link>
      </section>
    </div>
  );
}
