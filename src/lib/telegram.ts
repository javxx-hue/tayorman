// Thin wrapper over the Telegram Mini App SDK (telegram-web-app.js in index.html).
// Outside Telegram every helper is a safe no-op.
import { useEffect } from 'react';

type WebApp = {
  initData: string;
  initDataUnsafe: {
    start_param?: string;
    user?: {
      id?: number;
      first_name?: string;
      last_name?: string;
      username?: string;
      language_code?: string;
    };
  };
  platform?: string;
  colorScheme: 'light' | 'dark';
  ready(): void;
  expand(): void;
  close(): void;
  setHeaderColor(color: string): void;
  setBackgroundColor(color: string): void;
  enableClosingConfirmation(): void;
  disableClosingConfirmation(): void;
  openTelegramLink(url: string): void;
  showConfirm(message: string, callback: (ok: boolean) => void): void;
  BackButton: { show(): void; hide(): void; onClick(cb: () => void): void; offClick(cb: () => void): void };
  HapticFeedback: {
    impactOccurred(style: 'light' | 'medium' | 'heavy'): void;
    notificationOccurred(type: 'error' | 'success' | 'warning'): void;
    selectionChanged(): void;
  };
  onEvent(event: string, cb: () => void): void;
  offEvent(event: string, cb: () => void): void;
  isVersionAtLeast(version: string): boolean;
};

declare global {
  interface Window {
    Telegram?: { WebApp?: WebApp };
  }
}

export const webApp: WebApp | undefined =
  typeof window !== 'undefined' && window.Telegram?.WebApp ? window.Telegram.WebApp : undefined;

export function checkIsTelegram(): boolean {
  if (typeof window === 'undefined') return false;
  const wa = window.Telegram?.WebApp;
  if (!wa) return false;
  if (wa.initData && wa.initData.length > 0) return true;
  if (window.location.hash.includes('tgWebAppData')) return true;
  if (wa.platform && wa.platform !== 'unknown') return true;
  return false;
}

export const isTelegram = checkIsTelegram();
export const BOT_USERNAME = import.meta.env.VITE_TELEGRAM_BOT ?? '';
export const ADMIN_URL = import.meta.env.VITE_ADMIN_URL ?? '';

export function startTelegram(): void {
  if (!webApp) return;
  webApp.ready();
  webApp.expand();
}

// Follow Telegram's light/dark setting and paint the native header to match the app
export function applyTelegramTheme(onScheme: (scheme: 'light' | 'dark') => void): () => void {
  if (!webApp) return () => {};
  const apply = () => {
    const dark = webApp.colorScheme === 'dark';
    onScheme(webApp.colorScheme);
    const bg = dark ? '#1c1917' : '#faf7ee';
    try {
      webApp.setHeaderColor(bg);
      webApp.setBackgroundColor(bg);
    } catch {
      /* older clients */
    }
  };
  apply();
  webApp.onEvent('themeChanged', apply);
  return () => webApp.offEvent('themeChanged', apply);
}

// Shows Telegram's native back button while `visible`
export function useTelegramBackButton(visible: boolean, onBack: () => void): void {
  useEffect(() => {
    if (!webApp) return;
    if (!visible) {
      webApp.BackButton.hide();
      return;
    }
    webApp.BackButton.show();
    webApp.BackButton.onClick(onBack);
    return () => webApp.BackButton.offClick(onBack);
  }, [visible, onBack]);
}

export const haptic = {
  tap: () => webApp?.HapticFeedback.impactOccurred('light'),
  success: () => webApp?.HapticFeedback.notificationOccurred('success'),
  error: () => webApp?.HapticFeedback.notificationOccurred('error'),
};

// Leave the Mini App and land in the bot chat (e.g. to record a voice answer)
export function openBotChat(): void {
  if (!BOT_USERNAME) return;
  if (webApp) {
    webApp.openTelegramLink(`https://t.me/${BOT_USERNAME}`);
    webApp.close();
  } else {
    window.open(`https://t.me/${BOT_USERNAME}`, '_blank');
  }
}

export const inviteLink = (code: string) => `https://t.me/${BOT_USERNAME}?start=c_${code}`;
