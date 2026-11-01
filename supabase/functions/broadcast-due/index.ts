// Sends the scheduled broadcast whose time has come. Run by pg_cron every minute (see README)
// with the x-cron-secret header; deploy with --no-verify-jwt.
// One broadcast per run keeps a run well inside the function time limit.
// Secrets: TELEGRAM_BOT_TOKEN, CRON_SECRET, APP_URL
import { admin } from '../_shared/admin.ts';
import { deliverBroadcast } from '../_shared/broadcast.ts';

Deno.serve(async (req) => {
  if (req.headers.get('x-cron-secret') !== Deno.env.get('CRON_SECRET')) {
    return new Response('forbidden', { status: 403 });
  }

  const { data: due, error } = await admin
    .from('broadcasts')
    .select('id')
    .eq('status', 'scheduled')
    .lte('scheduled_at', new Date().toISOString())
    .order('scheduled_at')
    .limit(1)
    .maybeSingle();
  if (error) return new Response(error.message, { status: 500 });
  if (!due) return new Response(JSON.stringify({ due: 0 }), { headers: { 'Content-Type': 'application/json' } });

  const result = await deliverBroadcast(due.id);
  return new Response(JSON.stringify({ due: 1, id: due.id, ...result }), { headers: { 'Content-Type': 'application/json' } });
});
