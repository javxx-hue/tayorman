// Sends the scheduled broadcast whose time has come. Run by pg_cron every minute (see README)
// with the x-cron-secret header; deploy with --no-verify-jwt.
// It also pings the bot so it stays warm.
// One broadcast per run keeps a run well inside the function time limit.
// Secrets: TELEGRAM_BOT_TOKEN, CRON_SECRET, APP_URL
import { admin } from '../_shared/admin.ts';
import { deliverBroadcast } from '../_shared/broadcast.ts';
import { sameSecret } from '../_shared/secrets.ts';

Deno.serve(async (req) => {
  if (!sameSecret(req.headers.get('x-cron-secret'), Deno.env.get('CRON_SECRET'))) {
    return new Response('forbidden', { status: 403 });
  }

  // Every minute is also a chance to keep the bot awake: an idle function needs a few seconds to start, which a
  // student feels as a slow first reply. The bot refuses this call (no Telegram secret) but is up afterwards.
  const base = Deno.env.get('SUPABASE_URL');
  if (base) fetch(`${base}/functions/v1/telegram-bot`, { signal: AbortSignal.timeout(5000) }).catch(() => {});

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
