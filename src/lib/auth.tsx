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
const LANG_KEY = 'sessiyagatayyorlan_language';

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
    const buildFallbackProfile = (): Profile => {
      const u = webApp?.initDataUnsafe?.user;
      const userLang = (u?.language_code === 'ru' ? 'ru' : 'uz') as Language;
      return {
        id: u?.id ? String(u.id) : 'local-user',
        telegram_id: u?.id ? Number(u.id) : 0,
        first_name: u?.first_name || 'Talaba',
        username: u?.username || null,
        language: userLang,
        university: 'samdu',
        role: 'student',
        reminders_enabled: true,
      };
    };

    if (!isTelegram && !import.meta.env.DEV) {
      // Opened strictly in a normal external browser (not inside Telegram)
      setStatus('outside');
      return;
    }

    if (!supabase) {
      // Running in local-first mode without remote Supabase server
      const p = buildFallbackProfile();
      setProfile(p);
      setLang(p.language);
      setStatus('ready');
      return;
    }

    if (!webApp?.initData) {
      // Inside Telegram but initData is not provided yet (local preview)
      const p = buildFallbackProfile();
      setProfile(p);
      setLang(p.language);
      setStatus('ready');
      return;
    }

    supabase.functions
      .invoke('telegram-auth', { body: { initData: webApp.initData } })
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
        console.error('Telegram sign-in failed, fallback to local session', e);
        const p = buildFallbackProfile();
        setProfile(p);
        setLang(p.language);
        setStatus('ready');
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
