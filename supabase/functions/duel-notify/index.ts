// Duel messages in the bot, each sent once:
// - the challenger has played: the opponent hears they were challenged;
// - the opponent has answered: the challenger hears the result.
// Body: { id }. Only a player of that duel may call it; the duel's state decides which message (if any) goes out.
// Secrets: TELEGRAM_BOT_TOKEN, APP_URL, ALLOWED_ORIGINS
import { corsHeaders, json } from '../_shared/cors.ts';
import { admin, requireUser } from '../_shared/admin.ts';
import { openAppButton, sendMessage } from '../_shared/telegram.ts';
import { duelChallengeMessage, duelResultMessage } from '../_shared/duelText.ts';

interface Player {
  telegram_id: number;
  first_name: string | null;
  language: string;
  blocked: boolean;
  reminders_enabled: boolean;
}

const player = async (id: string): Promise<Player | null> =>
  (await admin.from('profiles').select('telegram_id, first_name, language, blocked, reminders_enabled').eq('id', id).maybeSingle()).data;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders(req) });
  if (req.method !== 'POST') return json(req, { error: 'Method not allowed' }, 405);

  const user = await requireUser(req);
  if (!user) return json(req, { error: 'Unauthorized' }, 401);
  const body = await req.json().catch(() => null);
  const id = typeof body?.id === 'string' ? body.id : '';
  if (!id) return json(req, { error: 'Bad request' }, 400);

  const { data: d } = await admin
    .from('duels')
    .select('id, challenger, opponent, question_ids, challenger_score, opponent_score, created_at, notified_at, result_notified_at')
    .eq('id', id)
    .maybeSingle();
  if (!d || (user.id !== d.challenger && user.id !== d.opponent)) return json(req, { error: 'Not found' }, 404);

  const now = new Date().toISOString();
  const open = Date.now() - Date.parse(d.created_at) < 86_400_000;
  let to: string;
  let column: 'notified_at' | 'result_notified_at';
  if (d.challenger_score !== null && d.opponent_score === null && open && !d.notified_at) {
    to = d.opponent;
    column = 'notified_at';
  } else if (d.challenger_score !== null && d.opponent_score !== null && !d.result_notified_at) {
    to = d.challenger;
    column = 'result_notified_at';
  } else {
    return json(req, { sent: false });
  }

  // Claim it: of two parallel calls only one gets the row back, so nobody is messaged twice
  const { data: claimed } = await admin.from('duels').update({ [column]: now }).eq('id', id).is(column, null).select('id').maybeSingle();
  if (!claimed) return json(req, { sent: false });

  const [target, other] = await Promise.all([player(to), player(to === d.challenger ? d.opponent : d.challenger)]);
  // Students who turned the bot's messages off (or were blocked) get none
  if (!target || target.blocked || !target.reminders_enabled) return json(req, { sent: false });

  const lang = target.language === 'ru' ? 'ru' : 'uz';
  const name = other?.first_name || (lang === 'ru' ? 'Одногруппник' : 'Guruhdoshingiz');
  const text =
    column === 'notified_at'
      ? duelChallengeMessage(lang, name, d.question_ids.length)
      : duelResultMessage(lang, name, d.challenger_score, d.opponent_score);
  const button = column === 'notified_at' ? (lang === 'ru' ? '⚔️ Играть' : "⚔️ O'ynash") : lang === 'ru' ? '🏆 Соревнование' : '🏆 Musobaqa';
  const sent = await sendMessage(target.telegram_id, text, { reply_markup: { inline_keyboard: [[openAppButton(button, '/assignments')]] } });
  return json(req, { sent });
});
