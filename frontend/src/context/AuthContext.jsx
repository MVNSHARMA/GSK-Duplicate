import React, { createContext, useState, useContext, useEffect } from 'react';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('gsk_token') || null);
  const [loading, setLoading] = useState(true);

  // On mount, if we have a token, verify it
  useEffect(() => {
    // Global fetch interceptor to catch 401s on protected API calls without forcing a hard page reload
    const originalFetch = window.fetch;
    window.fetch = async (...args) => {
      try {
        const response = await originalFetch(...args);
        if (response.status === 401) {
          const requestUrl = typeof args[0] === 'string' ? args[0] : (args[0]?.url || '');
          const isAuthCheckOrLogin =
            requestUrl.includes('/auth/login') ||
            requestUrl.includes('/auth/register') ||
            requestUrl.includes('/auth/me');
          if (!isAuthCheckOrLogin && window.location.pathname !== '/login') {
            localStorage.removeItem('gsk_token');
            setToken(null);
            setUser(null);
          }
        }
        return response;
      } catch (error) {
        throw error;
      }
    };

    const verifyToken = async () => {
      const storedToken = localStorage.getItem('gsk_token');
      if (!storedToken) {
        setLoading(false);
        return;
      }

      try {
        const response = await fetch(`${import.meta.env.VITE_API_URL}/auth/me`, {
          headers: { Authorization: `Bearer ${storedToken}` },
        });
        
        // If it's a 401 or 403, the token is definitively invalid
        if (response.status === 401 || response.status === 403) {
          localStorage.removeItem('gsk_token');
          setToken(null);
          setUser(null);
          return;
        }

        const data = await response.json();
        
        if (response.ok && data.success) {
          setUser(data.user);
          setToken(storedToken);
        } else if (response.status < 500) {
          // Client error, wipe token
          localStorage.removeItem('gsk_token');
          setToken(null);
          setUser(null);
        }
      } catch (error) {
        // Network error or 5xx error (JSON parse failure).
        // DO NOT wipe the token. The server might just be down/cold-starting.
        console.error("Auth verification failed (network/server error):", error);
      } finally {
        setLoading(false);
      }
    };

    verifyToken();

    return () => {
      window.fetch = originalFetch;
    };
  }, []);

  const login = async (email, password) => {
    const response = await fetch(`${import.meta.env.VITE_API_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    const data = await response.json();

    if (!response.ok || !data.success) {
      throw new Error(data.details ? `${data.error}: ${data.details}` : (data.error || 'Login failed'));
    }

    localStorage.setItem('gsk_token', data.token);
    setToken(data.token);
    setUser(data.user);
    return data;
  };

  const register = async (name, email, password) => {
    const response = await fetch(`${import.meta.env.VITE_API_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, password }),
    });
    const data = await response.json();

    if (!response.ok || !data.success) {
      throw new Error(data.error || 'Registration failed');
    }

    localStorage.setItem('gsk_token', data.token);
    setToken(data.token);
    setUser(data.user);
    return data;
  };

  const logout = () => {
    localStorage.removeItem('gsk_token');
    setToken(null);
    setUser(null);
  };

  const refreshUser = async () => {
    if (!token) return null;
    const response = await fetch(`${import.meta.env.VITE_API_URL}/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await response.json();
    if (!response.ok || !data.success) throw new Error(data.error || 'Unable to refresh user');
    setUser(data.user);
    return data.user;
  };

  const isAuthenticated = !!token && !!user;

  return (
    <AuthContext.Provider value={{ user, token, loading, login, register, logout, refreshUser, isAuthenticated }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export default AuthContext;
