export const BOT = import.meta.env.VITE_TELEGRAM_BOT || 'sessiyagatayyorlanbot';

// The link a student opens to join a group: the bot reads "c_<code>" on /start
export const inviteLink = (bot: string, code: string) => `https://t.me/${bot}?start=c_${code}`;
