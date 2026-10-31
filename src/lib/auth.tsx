// Sign-in happens only through Telegram: the Mini App sends initData to the
// "telegram-auth" Edge Function and receives a normal Supabase session.
// In `npm run dev` outside Telegram the app runs local-only for development.
import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { supabase } from './supabase';
import { webApp, isTelegram } from './telegram';
import { Language } from './i18n';

export interface Profile {
  id: string;
  telegram_id: number;
  first_name: string | null;
  username: string | null;
  language: Language;
  university: string | null;
  role: 'student' | 'admin';
  reminders_enabled: boolean;
}

type Status = 'loading' | 'ready' | 'outside' | 'error';

interface AuthContextValue {
  status: Status;
  profile: Profile | null;
  lang: Language;
  isAdmin: boolean;
  online: boolean; // signed in to Supabase (false in local dev mode)
  joinedCommunity: string | null;
  updateProfile: (patch: Partial<Pick<Profile, 'language' | 'university' | 'reminders_enabled'>>) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);
const LANG_KEY = 'tayyorman_language';

function initialLang(): Language {
  const saved = localStorage.getItem(LANG_KEY);
  if (saved === 'uz' || saved === 'ru') return saved;
  return webApp?.initDataUnsafe.user?.language_code === 'ru' ? 'ru' : 'uz';
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [status, setStatus] = useState<Status>('loading');
  const [profile, setProfile] = useState<Profile | null>(null);
  const [lang, setLang] = useState<Language>(initialLang);
  const [joinedCommunity, setJoinedCommunity] = useState<string | null>(null);

  useEffect(() => {
    if (!isTelegram || !supabase) {
      // Opened in a normal browser or Supabase is not configured: only the dev build may continue
      setStatus(import.meta.env.DEV ? 'ready' : 'outside');
      return;
    }

    supabase.functions
      .invoke('telegram-auth', { body: { initData: webApp!.initData } })
      .then(async ({ data, error }) => {
        if (error || !data?.session) throw error ?? new Error('no session');
        await supabase!.auth.setSession(data.session);
        setProfile(data.profile);
        setLang(data.profile.language);
        localStorage.setItem(LANG_KEY, data.profile.language);
        setJoinedCommunity(data.joined ?? null);
        setStatus('ready');
      })
      .catch((e) => {
        console.error('Telegram sign-in failed', e);
        setStatus('error');
      });
  }, []);

  const updateProfile = useCallback<AuthContextValue['updateProfile']>(
    async (patch) => {
      if (patch.language) {
        setLang(patch.language);
        localStorage.setItem(LANG_KEY, patch.language);
      }
      setProfile((p) => (p ? { ...p, ...patch } : p));
      if (supabase && profile) {
        const { error } = await supabase.from('profiles').update(patch).eq('id', profile.id);
        if (error) throw error;
      }
    },
    [profile]
  );

  const value: AuthContextValue = {
    status,
    profile,
    lang,
    isAdmin: profile?.role === 'admin',
    online: !!profile,
    joinedCommunity,
    updateProfile,
  };
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
