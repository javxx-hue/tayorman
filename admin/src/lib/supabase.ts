import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const configured = !!url && !!anonKey;

// Own storage key: the admin session never mixes with the Mini App session
export const supabase = createClient(url ?? 'http://localhost:1', anonKey ?? 'missing', {
  auth: { storageKey: 'tayyorman-admin-auth', persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
});
