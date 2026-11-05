import { useRef, useState } from 'react';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import Avatar from './Avatar';
import { MdOutlineCameraAlt, MdOutlineDelete } from 'react-icons/md';

export default function ProfilePhotoUpload() {
  const { user, setUser } = useAuth();
  const [preview, setPreview] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const fileInputRef = useRef(null);

  const choisirFichier = () => fileInputRef.current?.click();

  const onFichierChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError('');

    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setError('Format non supporté (JPG, PNG ou WEBP uniquement)');
      return;
    }
    if (file.size > 3 * 1024 * 1024) {
      setError('Image trop lourde (3 Mo max)');
      return;
    }

    // Show local preview immediately while uploading
    const localPreview = URL.createObjectURL(file);
    setPreview(localPreview);
    setUploading(true);

    try {
      const formData = new FormData();
      formData.append('photo', file);

      const res = await api.post('/profile/photo', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      setUser(res.data.user);
    } catch (err) {
      setError(err.response?.data?.message || 'Erreur lors de l\'envoi de la photo');
    } finally {
      setUploading(false);
      setPreview(null);
      URL.revokeObjectURL(localPreview);
    }
  };

  const supprimerPhoto = async () => {
    setError('');
    setUploading(true);
    try {
      const res = await api.delete('/profile/photo');
      setUser(res.data.user);
    } catch (err) {
      setError(err.response?.data?.message || 'Erreur lors de la suppression');
    } finally {
      setUploading(false);
    }
  };

  const displayedUser = preview ? { ...user, photoProfil: preview } : user;

  return (
    <div className="profile-photo-upload">
      <div className="profile-photo-preview-wrap" onClick={choisirFichier}>
        <Avatar user={preview ? { nom: user?.nom, photoProfil: preview } : user} size="lg" />
        <div className="profile-photo-overlay">
          <MdOutlineCameraAlt />
        </div>
        {uploading && <div className="profile-photo-uploading">Envoi...</div>}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        onChange={onFichierChange}
        style={{ display: 'none' }}
      />

      <div className="profile-photo-actions">
        <button type="button" className="btn-photo-change" onClick={choisirFichier} disabled={uploading}>
          <MdOutlineCameraAlt /> Changer la photo
        </button>
        {user?.photoProfil && (
          <button type="button" className="btn-photo-remove" onClick={supprimerPhoto} disabled={uploading}>
            <MdOutlineDelete /> Supprimer
          </button>
        )}
      </div>

      {error && <p className="profile-photo-error">{error}</p>}
    </div>
  );
}