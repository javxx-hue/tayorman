// Plain types shared by Edge Functions; no Deno or npm imports so tests can load it
export interface TelegramUser {
  id: number;
  first_name?: string;
  last_name?: string;
  username?: string;
  language_code?: string;
}
