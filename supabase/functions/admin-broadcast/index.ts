// Admin sends a message through the bot to everyone or to chosen communities, now or at a set time.
// Body: { text, audienceAll: boolean, communityIds: string[], scheduledAt?: ISO string }
// Without scheduledAt it is delivered before this call returns; with it, broadcast-due sends it on time.
// Secrets: TELEGRAM_BOT_TOKEN, APP_URL, ALLOWED_ORIGINS
import { corsHeaders, json } from '../_shared/cors.ts';
import { admin, isAdmin, requireUser } from '../_shared/admin.ts';
import { deliverBroadcast } from '../_shared/broadcast.ts';
import { parseSchedule } from '../_shared/schedule.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders(req) });
  if (req.method !== 'POST') return json(req, { error: 'Method not allowed' }, 405);

  const user = await requireUser(req);
  if (!user || !(await isAdmin(user.id))) return json(req, { error: 'Admin only' }, 403);

  const body = await req.json().catch(() => null);
  const text = typeof body?.text === 'string' ? body.text.trim() : '';
  const audienceAll = body?.audienceAll !== false;
  const communityIds: string[] = Array.isArray(body?.communityIds) ? body.communityIds.filter((x: unknown) => typeof x === 'string') : [];
  const schedule = parseSchedule(body?.scheduledAt);
  if (!text || text.length > 4000) return json(req, { error: 'Text is required (max 4000)' }, 400);
  if (!audienceAll && !communityIds.length) return json(req, { error: 'Choose an audience' }, 400);
  if (!schedule.ok) return json(req, { error: 'Bad schedule time' }, 400);

  const { data: row, error } = await admin
    .from('broadcasts')
    .insert({
      text,
      audience_all: audienceAll,
      community_ids: audienceAll ? [] : communityIds,
      status: 'scheduled',
      scheduled_at: (schedule.at ?? new Date()).toISOString(),
      created_by: user.id,
    })
    .select('id')
    .single();
  if (error || !row) return json(req, { error: 'Could not save the broadcast' }, 500);

  if (schedule.at) return json(req, { id: row.id, scheduled: true });
  const result = await deliverBroadcast(row.id);
  return json(req, { id: row.id, ...(result ?? { sent: 0, failed: 0, total: 0, truncated: false }) });
});
