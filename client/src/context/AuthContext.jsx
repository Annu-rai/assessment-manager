import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import api from '../api/client.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [organization, setOrganization] = useState(null);
  const [loading, setLoading] = useState(true);

  // On first load, if we have a token, validate it by fetching the profile.
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      setLoading(false);
      return;
    }
    api
      .get('/auth/me')
      .then((res) => {
        setUser(res.data.user);
        setOrganization(res.data.organization || null);
      })
      .catch(() => localStorage.removeItem('token'))
      .finally(() => setLoading(false));
  }, []);

  const persist = (data) => {
    localStorage.setItem('token', data.token);
    setUser(data.user);
    if (data.organization) setOrganization(data.organization);
  };

  const login = useCallback(async (email, password) => {
    const { data } = await api.post('/auth/login', { email, password });
    persist(data);
  }, []);

  const register = useCallback(async (name, email, password, organizationName) => {
    const { data } = await api.post('/auth/register', {
      name,
      email,
      password,
      organizationName,
    });
    persist(data);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('token');
    setUser(null);
    setOrganization(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, organization, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}
