// Two ways in, both through the admin-login function and for admins and moderators only:
//  - opened from the bot's "Admin" menu button: Telegram's own signed data identifies the person, no steps
//  - opened in a normal browser: the site opens t.me/<bot>?start=a_<nonce>, the admin confirms there
import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { configured, supabase } from './supabase';
import { closeTelegram, prepareTelegram, telegramInitData } from './telegram';

export type StaffRole = 'admin' | 'moderator';
export interface Me {
  id: string;
  first_name: string | null;
  role: StaffRole;
}
type Status = 'loading' | 'signed-out' | 'ready';

// A session lasts 8 hours from the moment of sign-in, however often it refreshes
export const MAX_SESSION_MS = 8 * 60 * 60 * 1000;
const LOGIN_AT_KEY = 'tayyorman-admin-login-at';

export const isExpired = (loginAt: number | null, now = Date.now()) => loginAt === null || now - loginAt > MAX_SESSION_MS;
const storedLoginAt = (): number | null => {
  const n = Number(localStorage.getItem(LOGIN_AT_KEY));
  return Number.isFinite(n) && n > 0 ? n : null;
};

export type SignInResult = 'ok' | 'pending' | 'denied' | 'gone' | 'error';

interface AuthValue {
  status: Status;
  me: Me | null;
  error: string | null;
  signInWithNonce: (nonce: string) => Promise<SignInResult>;
  signOut: () => Promise<void>;
}
const AuthContext = createContext<AuthValue | null>(null);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [status, setStatus] = useState<Status>('loading');
  const [me, setMe] = useState<Me | null>(null);
  const [error, setError] = useState<string | null>(null);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut().catch(() => {});
    localStorage.removeItem(LOGIN_AT_KEY);
    setMe(null);
    setStatus('signed-out');
    closeTelegram();
  }, []);

  const exchange = useCallback(async (body: { nonce: string } | { initData: string }): Promise<SignInResult> => {
    const { data, error: fnError } = await supabase.functions.invoke('admin-login', { body });
    if (fnError) {
      const status = (fnError as { context?: Response }).context?.status;
      return status === 403 ? 'denied' : status === 410 ? 'gone' : 'error';
    }
    if (!data?.session) return 'pending';
    await supabase.auth.setSession(data.session);
    localStorage.setItem(LOGIN_AT_KEY, String(Date.now()));
    setError(null);
    setMe(data.profile as Me);
    setStatus('ready');
    return 'ok';
  }, []);

  const signInWithNonce = useCallback((nonce: string) => exchange({ nonce }), [exchange]);

  useEffect(() => {
    let cancelled = false;
    const done = (next: Status, who: Me | null = null, message: string | null = null) => {
      if (cancelled) return;
      setMe(who);
      setError(message);
      setStatus(next);
    };

    const init = async () => {
      if (!configured) return done('signed-out', null, 'Sayt sozlanmagan: VITE_SUPABASE_URL va VITE_SUPABASE_ANON_KEY yo\'q.');

      // Opened from the bot: Telegram has already said who this is, so sign in right away
      prepareTelegram();
      const initData = telegramInitData();
      if (initData) {
        const result = await exchange({ initData });
        if (result === 'ok') return;
        return done('signed-out', null, result === 'denied' ? "Bu Telegram hisobi uchun admin huquqi yo'q." : "Kirib bo'lmadi. Botdagi «Admin» tugmasini qayta bosing.");
      }

      // An existing session that is still inside its 8 hours
      const { data: sessionData } = await supabase.auth.getSession();
      const session = sessionData.session;
      if (!session) return done('signed-out');
      if (isExpired(storedLoginAt())) {
        await supabase.auth.signOut().catch(() => {});
        localStorage.removeItem(LOGIN_AT_KEY);
        return done('signed-out', null, 'Sessiya tugadi (8 soat). Qayta kiring.');
      }
      const { data: profile } = await supabase.from('profiles').select('id, first_name, role, blocked').eq('id', session.user.id).maybeSingle();
      if (!profile || profile.blocked || !['admin', 'moderator'].includes(profile.role)) {
        await supabase.auth.signOut().catch(() => {});
        return done('signed-out', null, 'Bu hisobda admin huquqi yo\'q.');
      }
      done('ready', { id: profile.id, first_name: profile.first_name, role: profile.role });
    };

    init();

    return () => {
      cancelled = true;
    };
  }, []);

  // Sign out by itself when the 8 hours run out, even if the tab stays open
  useEffect(() => {
    if (status !== 'ready') return;
    const timer = setInterval(() => {
      if (isExpired(storedLoginAt())) signOut();
    }, 60_000);
    return () => clearInterval(timer);
  }, [status, signOut]);

  return <AuthContext.Provider value={{ status, me, error, signInWithNonce, signOut }}>{children}</AuthContext.Provider>;
};

export function useAuth(): AuthValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
