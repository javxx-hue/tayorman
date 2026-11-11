// Every Edge Function and how it is deployed. One list, so none is forgotten and none is deployed with the wrong flag.
// verifyJwt false = Telegram, cron or the sign-in proof is the credential, not a Supabase login.
export const FUNCTIONS = [
  { name: 'telegram-auth', verifyJwt: true },
  { name: 'telegram-bot', verifyJwt: false }, // Telegram calls it with its own secret header
  { name: 'telegram-reminders', verifyJwt: false }, // cron, x-cron-secret
  { name: 'broadcast-due', verifyJwt: false }, // cron, x-cron-secret
  { name: 'admin-login', verifyJwt: false }, // Telegram's signed data or a bot confirmation
  { name: 'admin-accounts', verifyJwt: true }, // owner only: logins and passwords for admins
  { name: 'admin-broadcast', verifyJwt: true },
  { name: 'admin-reply', verifyJwt: true },
  { name: 'assignment-notify', verifyJwt: true },
  { name: 'duel-notify', verifyJwt: true },
  { name: 'request-admin', verifyJwt: true },
  { name: 'bot-action', verifyJwt: true },
  { name: 'gemini', verifyJwt: true },
];
