import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useEffect, useState } from 'react';
import api from '../api/axios';
import socket from '../api/socket';
import { AiOutlineWechatWork } from "react-icons/ai";

export default function Navbar() {
  const { user, logout } = useAuth();
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    if (!user) {
      if (socket.connected) socket.disconnect();
      setUnread(0);
      return;
    }

    api.get('/messages/unread-count').then(r => setUnread(r.data.count)).catch(() => {});

    if (!socket.connected) socket.connect();

    const onNotif = () => setUnread(n => n + 1);
    const onRead  = () => api.get('/messages/unread-count').then(r => setUnread(r.data.count)).catch(() => {});

    socket.on('notification', onNotif);
    socket.on('messages_read', onRead);

    return () => { socket.off('notification', onNotif); socket.off('messages_read', onRead); };
  }, [user]);

  return (
    <nav className="navbar">
      <Link to="/" className="navbar-logo">RecrutIA</Link>
      <div className="navbar-links">
        <Link to="/">Offres d'emploi</Link>
        {user ? (
          <div className="user-nav">
            <Link to="/messages" className="nav-messages-btn">
              <AiOutlineWechatWork />
              {unread > 0 && <span className="nav-unread-badge">{unread > 9 ? '9+' : unread}</span>}
            </Link>
            <Link to="/profile" className="user-badge user-badge--link">
              <span className="user-avatar">{user.nom?.charAt(0).toUpperCase()}</span>
              {user.nom || user.email}
            </Link>
            <Link to="/dashboard" className="nav-btn-dashboard">Mon espace</Link>
            <button onClick={logout} className="nav-btn-logout">Déconnexion</button>
          </div>
        ) : (
          <Link to="/login" className="nav-btn-login">Connexion / Inscription</Link>
        )}
      </div>
    </nav>
  );
}
