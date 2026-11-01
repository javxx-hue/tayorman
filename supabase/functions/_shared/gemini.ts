import { admin } from './admin.ts';
import { ATTEMPT_TIMEOUT_MS, modelChain, shouldTryNext } from './geminiModels.ts';

export type Part = { text: string } | { inline_data: { mime_type: string; data: string } };

export class QuotaError extends Error {}

// Counts one AI request against the user's daily limit (set in the admin panel; blocked users never pass)
export async function consumeQuota(userId: string): Promise<void> {
  const { data, error } = await admin.rpc('consume_ai_quota_auto', { p_user: userId });
  if (error) throw error;
  if (!data) throw new QuotaError('Daily AI limit reached');
}

// Tries the configured model, then the fast backup, when one is slow, overloaded or failing
export async function callGemini(parts: Part[], opts: { json?: boolean; temperature?: number } = {}): Promise<string> {
  const apiKey = Deno.env.get('GEMINI_API_KEY');
  if (!apiKey) throw new Error('GEMINI_API_KEY is not set');
  const body = JSON.stringify({
    contents: [{ parts }],
    generationConfig: { temperature: opts.temperature ?? 0.4, ...(opts.json ? { responseMimeType: 'application/json' } : {}) },
  });

  let lastError = 'no model tried';
  for (const model of modelChain(Deno.env.get('GEMINI_MODEL'))) {
    let status: number | 'timeout';
    try {
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
        body,
        signal: AbortSignal.timeout(ATTEMPT_TIMEOUT_MS),
      });
      if (res.ok) {
        const data = await res.json();
        return (data?.candidates?.[0]?.content?.parts ?? []).map((p: { text?: string }) => p.text ?? '').join('');
      }
      status = res.status;
      lastError = `${model} ${res.status}: ${(await res.text()).slice(0, 200)}`;
    } catch (e) {
      if (!(e instanceof DOMException) || (e.name !== 'TimeoutError' && e.name !== 'AbortError')) throw e;
      status = 'timeout';
      lastError = `${model} gave no answer in ${ATTEMPT_TIMEOUT_MS / 1000}s`;
    }
    console.warn('Gemini attempt failed:', lastError);
    if (!shouldTryNext(status)) break;
  }
  throw new Error(`Gemini failed: ${lastError}`);
}

export function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  return btoa(binary);
}
