import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useEffect, useState } from 'react';
import api from '../api/axios';
import socket from '../api/socket';
import { AiOutlineWechatWork } from "react-icons/ai";
import Avatar from './Avatar';

function LogoMark() {
  return (
    <svg className="navbar-logo-mark" width="26" height="26" viewBox="0 0 26 26" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="10" cy="13" r="8" fill="#F2B84B" />
      <circle cx="17" cy="13" r="8" fill="#FFFFFF" fillOpacity="0.9" />
    </svg>
  );
}

export default function Navbar() {
  const { user, logout } = useAuth();
  const [unread, setUnread] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    if (!user) {
      // Utilisateur déconnecté : on coupe la connexion pour éviter de garder
      // un socket ouvert avec un token périmé.
      if (socket.connected) socket.disconnect();
      setUnread(0);
      return;
    }

    api.get('/messages/unread-count').then(r => setUnread(r.data.count)).catch(() => {});

    socket.auth = { token: document.cookie.split(';').map(c => c.trim()).find(c => c.startsWith('token='))?.split('=')[1] };
    if (!socket.connected) socket.connect();

    const onNotif = () => setUnread(n => n + 1);
    const onRead  = () => api.get('/messages/unread-count').then(r => setUnread(r.data.count)).catch(() => {});

    socket.on('notification', onNotif);
    socket.on('messages_read', onRead);

    return () => { socket.off('notification', onNotif); socket.off('messages_read', onRead); };
  }, [user]);

  // empêche le scroll du body quand le menu mobile est ouvert
  useEffect(() => {
    document.body.style.overflow = menuOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [menuOpen]);

  const closeMenu = () => setMenuOpen(false);

  return (
    <nav className="navbar">
      <div className="navbar-top">
        <Link to="/" className="navbar-logo" onClick={closeMenu}>
          <LogoMark />
          RecrutIA
        </Link>

        <button
          className={`navbar-toggle ${menuOpen ? 'is-open' : ''}`}
          onClick={() => setMenuOpen(o => !o)}
          aria-label={menuOpen ? "Fermer le menu" : "Ouvrir le menu"}
          aria-expanded={menuOpen}
        >
          <span></span>
          <span></span>
          <span></span>
        </button>
      </div>

      <div className={`navbar-links ${menuOpen ? 'open' : ''}`}>
        <Link to="/" onClick={closeMenu} style={{ '--i': 0 }}>Offres d'emploi</Link>

        {user ? (
          <div className="user-nav">
            {user.role !== 'ADMIN' && (
              <Link to="/messages" className="nav-messages-btn" onClick={closeMenu} style={{ '--i': 1 }}>
                <AiOutlineWechatWork />
                <span className="nav-messages-label">Messages</span>
                {unread > 0 && <span className="nav-unread-badge">{unread > 9 ? '9+' : unread}</span>}
              </Link>
            )}
            <Link to="/dashboard" className="nav-btn-dashboard" onClick={closeMenu} style={{ '--i': 2 }}>
              <Avatar user={user} size="sm" />
              Mon espace
            </Link>
            <button onClick={() => { logout(); closeMenu(); }} className="nav-btn-logout" style={{ '--i': 3 }}>Déconnexion</button>
          </div>
        ) : (
          <Link to="/login" className="nav-btn-login" onClick={closeMenu} style={{ '--i': 1 }}>Connexion</Link>
        )}
      </div>

      {menuOpen && <div className="navbar-overlay" onClick={closeMenu}></div>}
    </nav>
  );
}