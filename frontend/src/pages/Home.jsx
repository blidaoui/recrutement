import { Link } from 'react-router-dom';

export default function Home() {
  return (
    <div className="page-home">
      <h1>Trouvez le bon match, propulsé par l'IA</h1>
      <p>Notre plateforme analyse votre CV et le compare intelligemment aux offres disponibles.</p>
      <Link to="/offres" className="btn-primary">Voir les offres</Link>
    </div>
  );
}
