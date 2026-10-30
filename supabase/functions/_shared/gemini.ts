import { admin } from './admin.ts';

const MODEL = Deno.env.get('GEMINI_MODEL') ?? 'gemini-3.8-flash';
export const DAILY_LIMIT = Number(Deno.env.get('AI_DAILY_LIMIT') ?? '30');

export type Part =
  | { text: string }
  | { inline_data: { mime_type: string; data: string } }
  | { file_data: { file_uri: string } };

export class QuotaError extends Error {}

// Counts one AI request against the user's daily limit
export async function consumeQuota(userId: string): Promise<void> {
  const { data, error } = await admin.rpc('consume_ai_quota', { p_user: userId, daily_limit: DAILY_LIMIT });
  if (error) throw error;
  if (!data) throw new QuotaError('Daily AI limit reached');
}

export async function callGemini(parts: Part[], opts: { json?: boolean; temperature?: number } = {}): Promise<string> {
  const apiKey = Deno.env.get('GEMINI_API_KEY');
  if (!apiKey) throw new Error('GEMINI_API_KEY is not set');
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
    body: JSON.stringify({
      contents: [{ parts }],
      generationConfig: { temperature: opts.temperature ?? 0.4, ...(opts.json ? { responseMimeType: 'application/json' } : {}) },
    }),
  });
  if (!res.ok) throw new Error(`Gemini ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const data = await res.json();
  return (data?.candidates?.[0]?.content?.parts ?? []).map((p: { text?: string }) => p.text ?? '').join('');
}

export function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  return btoa(binary);
}
