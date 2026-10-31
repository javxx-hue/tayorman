import { createClient, SupabaseClient } from 'npm:@supabase/supabase-js@2';

// Service-role client: bypasses RLS, so only use it after checking who is asking
export const admin: SupabaseClient = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  { auth: { persistSession: false, autoRefreshToken: false } }
);

// Client acting as the caller (their JWT), so RLS and auth.uid() apply
function userClient(req: Request): SupabaseClient {
  return createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export async function requireUser(req: Request): Promise<{ id: string } | null> {
  const { data } = await userClient(req).auth.getUser();
  return data.user ? { id: data.user.id } : null;
}

export async function isAdmin(userId: string): Promise<boolean> {
  const { data } = await admin.from('profiles').select('role').eq('id', userId).maybeSingle();
  return data?.role === 'admin';
}
