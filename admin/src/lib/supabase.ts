import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL || 'https://placeholder.supabase.co';
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'placeholder-key';

export const configured = !!import.meta.env.VITE_SUPABASE_URL && !!import.meta.env.VITE_SUPABASE_ANON_KEY;

// Fallback WebSocket constructor for Node environments (tests) if native is missing
const wsTransport = typeof WebSocket !== 'undefined' ? WebSocket : class MockWebSocket {};

// Own storage key: the admin session never mixes with the Mini App session
export const supabase = createClient(url, anonKey, {
  auth: { storageKey: 'tayyorman-admin-auth', persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
  realtime: {
    // @ts-expect-error fallback shim
    transport: wsTransport,
  },
});
