'use client';

import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react';
import { supabase } from '@/lib/supabase';
import type { Profile } from '@/lib/supabase';

export type AppRole = 'customer' | 'driver' | 'admin';

export interface AuthSession {
  role: AppRole;
  phone: string;
  driverId?: string;
  profileId?: string;
}

interface AuthContextValue {
  session: AuthSession | null;
  loading: boolean;
  signIn: (role: AppRole, phone: string, driverId?: string, profileId?: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue>({
  session: null,
  loading: true,
  signIn: async () => {},
  signOut: async () => {},
});

export function useAuth() {
  return useContext(AuthContext);
}

const SESSION_KEY = 'fon_auth_session';
const FON_USER_KEY = 'fon_user';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    const restore = async () => {
      // 1. Check localStorage for our app session
      const saved = localStorage.getItem(SESSION_KEY) || localStorage.getItem(FON_USER_KEY);
      if (saved) {
        try {
          const parsed = JSON.parse(saved) as AuthSession;
          if (mounted) {
            setSession(parsed);
            setLoading(false);
          }
          localStorage.setItem(SESSION_KEY, JSON.stringify(parsed));
          localStorage.setItem(FON_USER_KEY, JSON.stringify(parsed));
          return;
        } catch {
          // Fall through
        }
      }

      // 2. Check if Supabase has an admin session
      const { data: { session: supaSession } } = await supabase.auth.getSession();
      if (supaSession && mounted) {
        const { data: prof } = await supabase
          .from('profiles')
          .select('id, phone, role')
          .eq('user_id', supaSession.user.id)
          .maybeSingle();
        if (prof && prof.role === 'admin') {
          const restored: AuthSession = {
            role: 'admin',
            phone: prof.phone,
            profileId: prof.id,
          };
          localStorage.setItem(SESSION_KEY, JSON.stringify(restored));
          setSession(restored);
        }
      }
      if (mounted) setLoading(false);
    };

    restore();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, supaSession) => {
      (async () => {
        if (!supaSession) {
          const stillSaved = localStorage.getItem(SESSION_KEY) || localStorage.getItem(FON_USER_KEY);
          if (!stillSaved && mounted) {
            setSession(null);
          }
          return;
        }
        // For admin sessions, check profile
        const { data: prof } = await supabase
          .from('profiles')
          .select('id, phone, role')
          .eq('user_id', supaSession.user.id)
          .maybeSingle();
        if (prof && prof.role === 'admin') {
          const newSession: AuthSession = {
            role: 'admin',
            phone: prof.phone,
            profileId: prof.id,
          };
          localStorage.setItem(SESSION_KEY, JSON.stringify(newSession));
          localStorage.setItem(FON_USER_KEY, JSON.stringify(newSession));
          if (mounted) setSession(newSession);
        }
      })();
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const signIn = useCallback(async (role: AppRole, phone: string, driverId?: string, profileId?: string) => {
    const newSession: AuthSession = { role, phone, driverId, profileId };
    localStorage.setItem(SESSION_KEY, JSON.stringify(newSession));
    localStorage.setItem(FON_USER_KEY, JSON.stringify(newSession));
    setSession(newSession);
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    localStorage.removeItem(SESSION_KEY);
    localStorage.removeItem(FON_USER_KEY);
    localStorage.removeItem('fon_customer_phone');
    localStorage.removeItem('fon_driver');
    localStorage.removeItem('fon_role');
    setSession(null);
  }, []);

  return (
    <AuthContext.Provider value={{ session, loading, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export async function getOrCreateProfile(phone: string, role: AppRole): Promise<Profile | null> {
  const { data: existing } = await supabase
    .from('profiles')
    .select('*')
    .eq('phone', phone)
    .maybeSingle();

  if (existing) {
    // Update role if needed
    if (existing.role !== role) {
      await supabase
        .from('profiles')
        .update({ role, updated_at: new Date().toISOString() })
        .eq('id', existing.id);
    }
    return existing as Profile;
  }

  const { data: created, error } = await supabase
    .from('profiles')
    .insert({
      phone,
      role,
      rating: 5.0,
      total_rides: 0,
    })
    .select()
    .maybeSingle();

  if (error || !created) return null;
  return created as Profile;
}
