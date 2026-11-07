// Gemini proxy for the Mini App: the API key stays on the server and each
// student has a daily limit (set in the admin site: personal > group > everyone, default 30).
// Secrets: GEMINI_API_KEY, GEMINI_MODEL, ALLOWED_ORIGINS
import { corsHeaders, json } from '../_shared/cors.ts';
import { requireUser } from '../_shared/admin.ts';
import { callGemini, consumeQuota, GeminiUnavailable, QuotaError, refundQuota, type Part } from '../_shared/gemini.ts';
import { isAllowedInlineMime } from '../_shared/geminiParts.ts';

const MAX_BODY_BYTES = 8 * 1024 * 1024; // photos and voice answers are sent inline as base64

function validParts(parts: unknown): parts is Part[] {
  if (!Array.isArray(parts) || parts.length === 0 || parts.length > 10) return false;
  return parts.every((p) => {
    if (typeof p?.text === 'string') return true;
    if (typeof p?.inline_data?.data === 'string') return isAllowedInlineMime(p.inline_data.mime_type);
    return false;
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders(req) });
  if (req.method !== 'POST') return json(req, { error: 'Method not allowed' }, 405);
  if (Number(req.headers.get('content-length') ?? '0') > MAX_BODY_BYTES) return json(req, { error: 'Request too large' }, 413);

  const user = await requireUser(req);
  if (!user) return json(req, { error: 'Not signed in' }, 401);

  const body = await req.json().catch(() => null);
  if (!validParts(body?.parts)) return json(req, { error: 'Invalid parts' }, 400);

  try {
    await consumeQuota(user.id);
    const temperature = typeof body.temperature === 'number' ? Math.min(Math.max(body.temperature, 0), 1) : 0.4;
    const text = await callGemini(body.parts, { json: !!body.json, temperature, tier: body.tier === 'fast' ? 'fast' : 'smart' });
    return json(req, { text });
  } catch (e) {
    if (e instanceof QuotaError) return json(req, { error: 'Daily AI limit reached' }, 429);
    console.error('gemini failed', e);
    // No model could answer: that is not the student's try, so it is not counted
    if (e instanceof GeminiUnavailable) await refundQuota(user.id).catch((err) => console.warn('refund failed', err));
    return json(req, { error: 'AI request failed' }, 502);
  }
});
