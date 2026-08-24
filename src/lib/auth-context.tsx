'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

interface User {
  id: number;
  email: string;
  role: 'admin' | 'middle_supervisor' | 'high_supervisor' | 'middle_teacher' | 'high_teacher' | 'middle_counselor' | 'high_counselor' | 'middle_principal' | 'high_principal' | 'middle_monitor' | 'high_monitor' | 'middle_admin_staff' | 'high_admin_staff' | 'parent';
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

/** Stage lock for split deployments (set NEXT_PUBLIC_SCHOOL_STAGE in Vercel) */
export const FORCED_SCHOOL_STAGE: 'middle' | 'high' | null =
  process.env.NEXT_PUBLIC_SCHOOL_STAGE === 'middle' || process.env.NEXT_PUBLIC_SCHOOL_STAGE === 'high'
    ? (process.env.NEXT_PUBLIC_SCHOOL_STAGE as 'middle' | 'high')
    : null;

export type SchoolStage = 'middle' | 'high';

export const STAGE_LABELS: Record<SchoolStage, string> = {
  middle: 'المتوسطة',
  high: 'الثانوية',
};

/** Options for stage selectors — only the forced stage in split deployments */
export function stageOptions(): { value: SchoolStage; label: string }[] {
  if (FORCED_SCHOOL_STAGE) return [{ value: FORCED_SCHOOL_STAGE, label: STAGE_LABELS[FORCED_SCHOOL_STAGE] }];
  return [
    { value: 'middle', label: STAGE_LABELS.middle },
    { value: 'high', label: STAGE_LABELS.high },
  ];
}

/** Default stage value for selectors in split deployments */
export function defaultStage(fallback: SchoolStage = 'middle'): SchoolStage {
  return FORCED_SCHOOL_STAGE ?? fallback;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedSchool, setSelectedSchool] = useState<'middle' | 'high' | 'all'>(FORCED_SCHOOL_STAGE ?? 'all');

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

    const saved = !FORCED_SCHOOL_STAGE
      ? (localStorage.getItem('selectedSchool') as 'middle' | 'high' | 'all' | null)
      : null;
    if (saved) setSelectedSchool(saved);

    setIsLoading(false);
  }, []);

  const handleSetSelectedSchool = useCallback((s: 'middle' | 'high' | 'all') => {
    if (FORCED_SCHOOL_STAGE) return; // stage-locked deployment: switching disabled
    setSelectedSchool(s);
    localStorage.setItem('selectedSchool', s);
  }, []);

  const login = useCallback((newToken: string, newUser: User) => {
    setToken(newToken);
    setUser(newUser);
    setSelectedSchool(FORCED_SCHOOL_STAGE ?? 'all');
    localStorage.setItem('token', newToken);
    localStorage.setItem('user', JSON.stringify(newUser));
    localStorage.setItem('lastLogin', new Date().toISOString());
    localStorage.removeItem('selectedSchool');
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
