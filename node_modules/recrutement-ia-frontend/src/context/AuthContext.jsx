import React, { createContext, useContext, useEffect, useState } from 'react';
import api from '../api/axios';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get('/auth/me')
      .then((res) => setUser(res.data.user))
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  const login = async (email, motDePasse) => {
    const res = await api.post('/auth/login', { email, motDePasse });
    setUser(res.data.user);
    return res.data;
  };

  const register = async ({ nom, email, motDePasse, role }) => {
    const res = await api.post('/auth/register', { nom, email, motDePasse, role });
    setUser(res.data.user);
    return res.data;
  };

  const logout = async () => {
    try {
      await api.post('/auth/logout');
    } catch (err) {
      // On loggue l'erreur mais on ne bloque jamais la déconnexion côté client
      // pour ça : même si l'appel API échoue (cookie déjà expiré, réseau...),
      // l'utilisateur doit quand même être déconnecté visuellement.
      console.error('Logout failed', err);
    } finally {
      setUser(null);
      // window.location.href (et non navigate()) pour forcer un vrai rechargement
      // complet de la page : ça vide aussi tout état résiduel ailleurs dans l'app
      // (dashboard, socket, listes en cache, etc.), pas seulement la route.
      window.location.href = '/';
    }
  };

  return (
    <AuthContext.Provider value={{ user, setUser, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}