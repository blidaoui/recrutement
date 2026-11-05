import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useEffect, useState, useRef } from 'react';
import api from '../api/axios';
import socket from '../api/socket';
import Avatar from './Avatar';

function LogoMark() {
  return (
    <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
      <rect width="32" height="32" rx="10" fill="url(#lg)" />
      <circle cx="12" cy="16" r="5" fill="#fff" fillOpacity="0.9" />
      <circle cx="20" cy="16" r="5" fill="#F2B84B" fillOpacity="0.95" />
      <defs>
        <linearGradient id="lg" x1="0" y1="0" x2="32" y2="32" gradientUnits="userSpaceOnUse">
          <stop stopColor="#7c3aed" />
          <stop offset="1" stopColor="#4e2a68" />
        </linearGradient>
      </defs>
    </svg>
  );
}

export default function Navbar() {
  const { user, logout } = useAuth();
  const [unread, setUnread] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const dropdownRef = useRef(null);
  const location = useLocation();

  // Scroll shadow
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Unread messages + socket
  useEffect(() => {
    if (!user) {
      if (socket.connected) socket.disconnect();
      setUnread(0);
      return;
    }
    const refresh = () => api.get('/messages/unread-count').then(r => setUnread(r.data.count)).catch(() => {});
    refresh();
    socket.auth = { token: document.cookie.split(';').map(c => c.trim()).find(c => c.startsWith('token='))?.split('=')[1] };
    if (!socket.connected) socket.connect();
    const onNotif = () => refresh();
    const onRead  = () => refresh();
    const onVis   = () => { if (document.visibilityState === 'visible') refresh(); };
    socket.on('notification', onNotif);
    socket.on('messages_read', onRead);
    document.addEventListener('visibilitychange', onVis);
    return () => {
      socket.off('notification', onNotif);
      socket.off('messages_read', onRead);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [user]);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e) => { if (dropdownRef.current && !dropdownRef.current.contains(e.target)) setDropdownOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Body scroll lock on mobile menu
  useEffect(() => {
    document.body.style.overflow = menuOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [menuOpen]);

  // Close everything on route change
  useEffect(() => { setMenuOpen(false); setDropdownOpen(false); }, [location.pathname]);

  const isActive = (path) => location.pathname === path;

  return (
    <nav className={`nb ${scrolled ? 'nb--scrolled' : ''}`}>
      <div className="nb-inner">

        {/* Logo */}
        <Link to="/" className="nb-logo">
          <LogoMark />
          <span className="nb-logo-text">Recrut<span className="nb-logo-accent">IA</span></span>
        </Link>

        {/* Center nav links (desktop) */}
        <div className="nb-center">
          <Link to="/offres" className={`nb-link ${isActive('/offres') || isActive('/') && user ? 'nb-link--active' : ''}`}>
            Offres d'emploi
          </Link>
          {user && user.role !== 'ADMIN' && (
            <Link to="/messages" className={`nb-link nb-link--msg ${isActive('/messages') ? 'nb-link--active' : ''}`}>
              Messages
              {unread > 0 && <span className="nb-badge">{unread > 9 ? '9+' : unread}</span>}
            </Link>
          )}
          {user && (
            <Link to="/dashboard" className={`nb-link ${isActive('/dashboard') ? 'nb-link--active' : ''}`}>
              {user.role === 'ADMIN' ? 'Administration' : user.role === 'RECRUTEUR' ? 'Tableau de bord' : 'Mon espace'}
            </Link>
          )}
        </div>

        {/* Right side */}
        <div className="nb-right">
          {user ? (
            <div className="nb-user" ref={dropdownRef}>
              <button className="nb-user-btn" onClick={() => setDropdownOpen(o => !o)} aria-expanded={dropdownOpen}>
                <Avatar user={user} size="sm" />
                <span className="nb-user-name">{user.nom?.split(' ')[0]}</span>
                <svg className={`nb-chevron ${dropdownOpen ? 'nb-chevron--open' : ''}`} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="m6 9 6 6 6-6" />
                </svg>
              </button>

              {dropdownOpen && (
                <div className="nb-dropdown">
                  <div className="nb-dropdown-header">
                    <Avatar user={user} size="md" />
                    <div>
                      <div className="nb-dropdown-name">{user.nom}</div>
                      <div className="nb-dropdown-email">{user.email}</div>
                      <span className="nb-dropdown-role">{user.role}</span>
                    </div>
                  </div>
                  <div className="nb-dropdown-divider" />
                  <Link to="/dashboard" className="nb-dropdown-item">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>
                    Mon espace
                  </Link>
                  <Link to="/profile" className="nb-dropdown-item">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg>
                    Mon profil
                  </Link>
                  {user.role !== 'ADMIN' && (
                    <Link to="/messages" className="nb-dropdown-item">
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                      Messages
                      {unread > 0 && <span className="nb-dropdown-badge">{unread > 9 ? '9+' : unread}</span>}
                    </Link>
                  )}
                  <div className="nb-dropdown-divider" />
                  <button className="nb-dropdown-item nb-dropdown-item--danger" onClick={logout}>
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
                    Déconnexion
                  </button>
                </div>
              )}
            </div>
          ) : (
            <Link to="/login" className="nb-login-btn">Se connecter</Link>
          )}

          {/* Hamburger */}
          <button className={`nb-hamburger ${menuOpen ? 'nb-hamburger--open' : ''}`} onClick={() => setMenuOpen(o => !o)} aria-label="Menu">
            <span /><span /><span />
          </button>
        </div>
      </div>

      {/* Mobile drawer */}
      {menuOpen && (
        <>
          <div className="nb-drawer">
            <Link to="/offres" className={`nb-drawer-link ${isActive('/offres') ? 'nb-drawer-link--active' : ''}`}>Offres d'emploi</Link>
            {user && user.role !== 'ADMIN' && (
              <Link to="/messages" className={`nb-drawer-link ${isActive('/messages') ? 'nb-drawer-link--active' : ''}`}>
                Messages {unread > 0 && <span className="nb-badge">{unread > 9 ? '9+' : unread}</span>}
              </Link>
            )}
            {user && (
              <Link to="/dashboard" className={`nb-drawer-link ${isActive('/dashboard') ? 'nb-drawer-link--active' : ''}`}>
                {user.role === 'ADMIN' ? 'Administration' : user.role === 'RECRUTEUR' ? 'Tableau de bord' : 'Mon espace'}
              </Link>
            )}
            {user && <Link to="/profile" className="nb-drawer-link">Mon profil</Link>}
            <div className="nb-drawer-divider" />
            {user
              ? <button className="nb-drawer-logout" onClick={logout}>Déconnexion</button>
              : <Link to="/login" className="nb-drawer-login">Se connecter</Link>
            }
          </div>
          <div className="nb-overlay" onClick={() => setMenuOpen(false)} />
        </>
      )}
    </nav>
  );
}
