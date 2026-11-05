import { admin } from './admin.ts';
import { ATTEMPT_TIMEOUT_MS, Fatal, HEDGE_DELAY_MS, modelChain, raceStaggered, shouldTryNext, type Tier } from './geminiModels.ts';

export type Part = { text: string } | { inline_data: { mime_type: string; data: string } };

export class QuotaError extends Error {}
// The AI refused the request itself (bad input, bad key): trying again would fail the same way
export class GeminiRejected extends Error {}
// None of the models could answer in time or at all: not the student's doing
export class GeminiUnavailable extends Error {}

// Counts one AI request against the user's daily limit (set in the admin panel; blocked users never pass)
export async function consumeQuota(userId: string): Promise<void> {
  const { data, error } = await admin.rpc('consume_ai_quota_auto', { p_user: userId });
  if (error) throw error;
  if (!data) throw new QuotaError('Daily AI limit reached');
}

interface Options {
  json?: boolean;
  temperature?: number;
  tier?: Tier; // 'fast': grading and reading speech or handwriting; 'smart' (default): writing tests and answers
}

// Gives back the try that consumeQuota counted, when the failure was ours and not the student's
export async function refundQuota(userId: string): Promise<void> {
  const { error } = await admin.rpc('refund_ai_quota', { p_user: userId });
  if (error) throw error;
}

// Asks several models, staggered (see geminiModels.ts): the first good answer wins. One request is counted
// against the user's limit however many models were asked.
export async function callGemini(parts: Part[], opts: Options = {}): Promise<string> {
  const apiKey = Deno.env.get('GEMINI_API_KEY');
  if (!apiKey) throw new Error('GEMINI_API_KEY is not set');
  const body = JSON.stringify({
    contents: [{ parts }],
    generationConfig: { temperature: opts.temperature ?? 0.4, ...(opts.json ? { responseMimeType: 'application/json' } : {}) },
  });

  const attempt = (model: string) => async (cancel: AbortSignal): Promise<string> => {
    let res: Response;
    try {
      res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
        body,
        signal: AbortSignal.any([cancel, AbortSignal.timeout(ATTEMPT_TIMEOUT_MS)]),
      });
    } catch (e) {
      if (e instanceof DOMException && (e.name === 'TimeoutError' || e.name === 'AbortError')) throw new Error(`${model} gave no answer in time`);
      throw e;
    }
    if (!res.ok) {
      const message = `${model} ${res.status}: ${(await res.text()).slice(0, 200)}`;
      console.warn('Gemini attempt failed:', message);
      throw shouldTryNext(res.status) ? new Error(message) : new Fatal(message);
    }
    const data = await res.json();
    return (data?.candidates?.[0]?.content?.parts ?? []).map((p: { text?: string }) => p.text ?? '').join('');
  };

  try {
    return await raceStaggered(modelChain(Deno.env.get('GEMINI_MODEL'), opts.tier).map(attempt), HEDGE_DELAY_MS);
  } catch (e) {
    const message = `Gemini failed: ${e instanceof Error ? e.message : String(e)}`;
    throw e instanceof Fatal ? new GeminiRejected(message) : new GeminiUnavailable(message);
  }
}

export function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  return btoa(binary);
}
