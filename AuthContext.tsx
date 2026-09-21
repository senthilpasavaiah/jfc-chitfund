import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import client, { setAccessToken } from '../api/client';
import type { User } from '../types';

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  loginAdmin: (username: string, password: string) => Promise<void>;
  checkAadhaar: (aadhaarLast4: string) => Promise<{ memberName: string; needsPasswordSetup: boolean }>;
  setPasswordAadhaar: (aadhaarLast4: string, password: string) => Promise<void>;
  loginAadhaar: (aadhaarLast4: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // On page load, try to silently refresh using the httpOnly cookie.
    (async () => {
      try {
        const res = await client.post('/auth/refresh');
        setAccessToken(res.data.data.accessToken);
        const me = await client.get('/auth/me');
        setUser(me.data.data);
      } catch {
        setUser(null);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  async function loginAdmin(identifier: string, password: string) {
    const res = await client.post('/auth/login-username', { identifier, password });
    setAccessToken(res.data.data.accessToken);
    setUser(res.data.data.user);
  }

  async function checkAadhaar(aadhaarLast4: string) {
    const res = await client.post('/auth/check-aadhaar', { aadhaarLast4 });
    return res.data.data as { memberName: string; needsPasswordSetup: boolean };
  }

  async function setPasswordAadhaar(aadhaarLast4: string, password: string) {
    const res = await client.post('/auth/set-password-aadhaar', { aadhaarLast4, password });
    setAccessToken(res.data.data.accessToken);
    setUser(res.data.data.user);
  }

  async function loginAadhaar(aadhaarLast4: string, password: string) {
    const res = await client.post('/auth/login-aadhaar', { aadhaarLast4, password });
    setAccessToken(res.data.data.accessToken);
    setUser(res.data.data.user);
  }

  async function logout() {
    await client.post('/auth/logout').catch(() => {});
    setAccessToken(null);
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, loading, loginAdmin, checkAadhaar, setPasswordAadhaar, loginAadhaar, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
