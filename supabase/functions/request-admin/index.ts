// A student sends a request to the admins (new subject, files/questions, a mistake, anything else).
// Students cannot create content themselves; this is their only way to ask for it.
// Secrets: TELEGRAM_BOT_TOKEN, ADMIN_TELEGRAM_IDS
import { corsHeaders, json } from '../_shared/cors.ts';
import { admin, requireUser } from '../_shared/admin.ts';
import { parseAttachments } from '../_shared/attachments.ts';
import { REQUEST_KINDS, submitRequest, TooManyRequests, type RequestKind } from '../_shared/requests.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders(req) });
  if (req.method !== 'POST') return json(req, { error: 'Method not allowed' }, 405);

  const user = await requireUser(req);
  if (!user) return json(req, { error: 'Unauthorized' }, 401);
  const { data: profile } = await admin.from('profiles').select('blocked').eq('id', user.id).maybeSingle();
  if (!profile || profile.blocked) return json(req, { error: 'Forbidden' }, 403);

  const body = await req.json().catch(() => null);
  const kind = body?.kind as RequestKind;
  const text = typeof body?.text === 'string' ? body.text.trim() : '';
  const attachments = parseAttachments(body?.attachments, user.id);
  if (!REQUEST_KINDS.includes(kind) || text.length < 3 || !attachments) return json(req, { error: 'Bad request' }, 400);

  try {
    const id = await submitRequest(user.id, kind, text, attachments);
    return json(req, { id });
  } catch (e) {
    if (e instanceof TooManyRequests) return json(req, { error: 'Too many requests today' }, 429);
    console.error('request-admin failed', e);
    return json(req, { error: 'Failed' }, 500);
  }
});
