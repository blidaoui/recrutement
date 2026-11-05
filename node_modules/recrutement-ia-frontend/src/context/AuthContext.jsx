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
      .catch((err) => {
        if (err.response?.status !== 401) {
          console.error('Auth check failed:', err);
        }
        setUser(null);
      })
      .finally(() => setLoading(false));
  }, []);

  const login = async (email, motDePasse) => {
    const res = await api.post('/auth/login', { email, motDePasse });
    setUser(res.data.user);
    return res.data;
  };

  const register = async ({ nom, email, motDePasse }) => {
    const res = await api.post('/auth/register', { nom, email, motDePasse });
    setUser(res.data.user);
    return res.data;
  };

  const logout = async () => {
    try {
      await api.post('/auth/logout');
    } catch (err) {
      // Always clear the session client-side even if the API call fails
      console.error('Logout failed', err);
    } finally {
      setUser(null);
      // Hard redirect (not navigate()) to flush all in-memory state: socket, caches, etc.
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