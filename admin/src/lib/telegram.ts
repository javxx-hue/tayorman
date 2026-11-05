// The admin site can be opened from the bot's "Admin" menu button; then Telegram hands it signed data about
// who is looking (initData). In a normal browser there is none and the bot-confirmation sign-in is used.
type WebApp = { initData?: string; ready: () => void; expand: () => void; close: () => void };

const webApp = (): WebApp | undefined => (window as unknown as { Telegram?: { WebApp?: WebApp } }).Telegram?.WebApp;

export const telegramInitData = (): string | null => webApp()?.initData || null;

export function prepareTelegram(): void {
  const app = webApp();
  if (!app?.initData) return;
  app.ready();
  app.expand();
}

// After signing out inside Telegram there is nothing to show, so the window closes
export function closeTelegram(): void {
  if (telegramInitData()) webApp()?.close();
}
