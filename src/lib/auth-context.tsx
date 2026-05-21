'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

interface User {
  id: number;
  email: string;
  role: 'admin' | 'middle_supervisor' | 'high_supervisor' | 'middle_teacher' | 'high_teacher' | 'middle_counselor' | 'high_counselor' | 'middle_principal' | 'high_principal' | 'middle_monitor' | 'high_monitor' | 'middle_admin_staff' | 'high_admin_staff';
  school?: 'middle' | 'high';
  name?: string;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  login: (token: string, user: User) => void;
  logout: () => void;
  isLoading: boolean;
  selectedSchool: 'middle' | 'high' | 'all';
  setSelectedSchool: (s: 'middle' | 'high' | 'all') => void;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  token: null,
  login: () => {},
  logout: () => {},
  isLoading: true,
  selectedSchool: 'all',
  setSelectedSchool: () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedSchool, setSelectedSchool] = useState<'middle' | 'high' | 'all'>('all');

  useEffect(() => {
    const storedToken = localStorage.getItem('token');
    const storedUser = localStorage.getItem('user');

    if (storedToken && storedUser) {
      setToken(storedToken);
      try {
        const parsed = JSON.parse(storedUser);
        if (parsed && typeof parsed === 'object' && parsed.id && parsed.email && parsed.role) {
          setUser(parsed);
        } else {
          localStorage.removeItem('token');
          localStorage.removeItem('user');
        }
      } catch {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
      }
    }

    const saved = localStorage.getItem('selectedSchool') as 'middle' | 'high' | 'all' | null;
    if (saved) setSelectedSchool(saved);

    setIsLoading(false);
  }, []);

  const handleSetSelectedSchool = useCallback((s: 'middle' | 'high' | 'all') => {
    setSelectedSchool(s);
    localStorage.setItem('selectedSchool', s);
  }, []);

  const login = useCallback((newToken: string, newUser: User) => {
    setToken(newToken);
    setUser(newUser);
    localStorage.setItem('token', newToken);
    localStorage.setItem('user', JSON.stringify(newUser));
    localStorage.setItem('lastLogin', new Date().toISOString());
  }, []);

  const logout = useCallback(() => {
    setToken(null);
    setUser(null);
    setSelectedSchool('all');
    localStorage.removeItem('token');
    localStorage.removeItem('user');
  }, []);

  return (
    <AuthContext.Provider value={{ user, token, login, logout, isLoading, selectedSchool, setSelectedSchool: handleSetSelectedSchool }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
