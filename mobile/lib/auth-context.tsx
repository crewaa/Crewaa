import React, { createContext, useContext, useEffect, useState } from 'react';
import { api } from './api';
import { clearTokens, getAccessToken, saveTokens } from './storage';
import { CurrentUser, Role } from '../types';

interface AuthContextValue {
  user: CurrentUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<CurrentUser>;
  signup: (email: string, password: string, role: Role) => Promise<CurrentUser>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [loading, setLoading] = useState(true);

  async function loadUser() {
    try {
      const token = await getAccessToken();
      if (!token) {
        setUser(null);
        return;
      }
      const res = await api.get<CurrentUser>('/users/me');
      setUser(res.data);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadUser();
  }, []);

  async function login(email: string, password: string): Promise<CurrentUser> {
    const res = await api.post<{ access_token: string; refresh_token?: string; role: Role }>(
      '/auth/login',
      { email, password }
    );
    await saveTokens(res.data.access_token, res.data.refresh_token);
    const userRes = await api.get<CurrentUser>('/users/me');
    setUser(userRes.data);
    return userRes.data;
  }

  async function signup(email: string, password: string, role: Role): Promise<CurrentUser> {
    const res = await api.post<{ access_token: string; refresh_token?: string; role: Role }>(
      '/auth/signup',
      { email, password, role }
    );
    await saveTokens(res.data.access_token, res.data.refresh_token);
    const userRes = await api.get<CurrentUser>('/users/me');
    setUser(userRes.data);
    return userRes.data;
  }

  async function logout(): Promise<void> {
    try {
      await api.post('/auth/logout');
    } catch {
      // Ignore network errors on logout
    } finally {
      await clearTokens();
      setUser(null);
    }
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        login,
        signup,
        logout,
        refreshUser: loadUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
