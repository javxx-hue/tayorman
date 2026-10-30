/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_GEMINI_MODEL?: string;
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_ANON_KEY?: string;
  readonly VITE_TELEGRAM_BOT?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
