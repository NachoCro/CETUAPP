import type { Session } from '@supabase/supabase-js';
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';

import { queryClient } from './query';
import { supabase } from './supabase';
import type { AppRole, Profile } from './types';

type AuthState = {
  loading: boolean;
  session: Session | null;
  profile: Profile | null;
  roles: AppRole[];
  /** Alumno verificado: puede subir, votar, reclamar, pedir copias y consultar el padrón. */
  isVerified: boolean;
  isAdmin: boolean;
  hasRole: (role: AppRole) => boolean;
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [roles, setRoles] = useState<AppRole[]>([]);

  const loadUserData = useCallback(async (s: Session | null) => {
    if (!s) {
      setProfile(null);
      setRoles([]);
      return;
    }
    const [p, r] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', s.user.id).maybeSingle(),
      supabase.from('user_roles').select('role').eq('user_id', s.user.id),
    ]);
    setProfile((p.data as Profile | null) ?? null);
    setRoles(((r.data ?? []) as { role: AppRole }[]).map((x) => x.role));
  }, []);

  useEffect(() => {
    let active = true;

    supabase.auth
      .getSession()
      .then(async ({ data }) => {
        if (!active) return;
        setSession(data.session);
        await loadUserData(data.session);
      })
      .catch(() => {})
      .finally(() => active && setLoading(false));

    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      // Fuera del callback: Supabase recomienda no hacer queries dentro de él.
      setTimeout(() => void loadUserData(s), 0);
    });

    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, [loadUserData]);

  const hasRole = useCallback((role: AppRole) => roles.includes(role), [roles]);

  const value: AuthState = {
    loading,
    session,
    profile,
    roles,
    // Igual que is_verified() en la base: alumno con cuenta verificada.
    isVerified: profile?.verification_status === 'verificado' && profile.member_type === 'alumno',
    isAdmin: roles.includes('admin') || roles.includes('superadmin'),
    hasRole,
    refresh: () => loadUserData(session),
    signOut: async () => {
      await supabase.auth.signOut();
      queryClient.clear(); // que el próximo usuario no vea datos cacheados del anterior
    },
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth debe usarse dentro de <AuthProvider>');
  return ctx;
}
