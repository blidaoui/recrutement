// Construit l'URL absolue d'une photo stockée en chemin relatif (/uploads/photos/xxx.jpg)
// ⚠️ Adapte VITE_API_URL au nom réel de ta variable d'env / à la base URL de ton axios instance
const API_BASE = import.meta.env.VITE_API_URL || '';

function getInitiales(nom) {
  if (!nom) return '?';
  const parts = nom.trim().split(/\s+/);
  const first = parts[0]?.[0] || '';
  const last = parts.length > 1 ? parts[parts.length - 1][0] : '';
  return (first + last).toUpperCase();
}

// Couleur de fond stable générée à partir du nom, pour que chaque personne
// ait toujours la même couleur d'avatar par défaut
function getCouleur(nom) {
  const couleurs = ['#4f46e5', '#0ea5e9', '#059669', '#d97706', '#dc2626', '#7c3aed', '#db2777'];
  if (!nom) return couleurs[0];
  let hash = 0;
  for (let i = 0; i < nom.length; i++) hash = nom.charCodeAt(i) + ((hash << 5) - hash);
  return couleurs[Math.abs(hash) % couleurs.length];
}

/**
 * <Avatar user={{ nom, photoProfil }} size="sm" | "md" | "lg" />
 */
export default function Avatar({ user, size = 'md', className = '' }) {
  const photoUrl = user?.photoProfil
    ? (user.photoProfil.startsWith('http') ? user.photoProfil : `${API_BASE}${user.photoProfil}`)
    : null;

  return (
    <div
      className={`avatar avatar--${size} ${className}`}
      style={!photoUrl ? { backgroundColor: getCouleur(user?.nom) } : undefined}
      title={user?.nom || ''}
    >
      {photoUrl ? (
        <img src={photoUrl} alt={user?.nom || 'Avatar'} className="avatar-img" />
      ) : (
        <span className="avatar-initiales">{getInitiales(user?.nom)}</span>
      )}
    </div>
  );
}