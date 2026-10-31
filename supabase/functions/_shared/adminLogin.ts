import { admin } from './admin.ts';
import { LOGIN_CODE_TTL_MS, newLoginCode, sha256Hex } from './roles.ts';

// Creates a one-time code for the admin site; returns the raw code (only its hash is stored)
export async function createLoginCode(userId: string): Promise<string> {
  const code = newLoginCode();
  const { error } = await admin.from('admin_login_tokens').insert({
    token_hash: await sha256Hex(code),
    user_id: userId,
    expires_at: new Date(Date.now() + LOGIN_CODE_TTL_MS).toISOString(),
  });
  if (error) throw error;
  // Housekeeping: forget codes that expired or were used more than a day ago
  await admin.from('admin_login_tokens').delete().lt('expires_at', new Date(Date.now() - 24 * 3600 * 1000).toISOString());
  return code;
}

// Spends a code: atomic, so a second attempt with the same code always fails
export async function redeemLoginCode(code: string): Promise<string | null> {
  const { data } = await admin
    .from('admin_login_tokens')
    .update({ used_at: new Date().toISOString() })
    .eq('token_hash', await sha256Hex(code))
    .is('used_at', null)
    .gt('expires_at', new Date().toISOString())
    .select('user_id');
  return data?.[0]?.user_id ?? null;
}
