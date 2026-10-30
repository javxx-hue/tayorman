// Mini App -> bot actions for the signed-in user:
//  { action: 'voice_answer', subjectId, questionId }  bot asks for a voice answer
//  { action: 'send_file', subjectId, materialId }     bot sends the original file back
// Secrets: TELEGRAM_BOT_TOKEN, ALLOWED_ORIGINS
import { corsHeaders, json } from '../_shared/cors.ts';
import { admin, requireUser } from '../_shared/admin.ts';
import { tg, sendMessage } from '../_shared/telegram.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders(req) });
  if (req.method !== 'POST') return json(req, { error: 'Method not allowed' }, 405);

  const user = await requireUser(req);
  if (!user) return json(req, { error: 'Not signed in' }, 401);
  const body = await req.json().catch(() => null);
  if (typeof body?.subjectId !== 'string') return json(req, { error: 'subjectId required' }, 400);

  const [{ data: profile }, { data: row }] = await Promise.all([
    admin.from('profiles').select('telegram_id, language').eq('id', user.id).single(),
    admin.from('subjects').select('data').eq('user_id', user.id).eq('id', body.subjectId).maybeSingle(),
  ]);
  if (!profile || !row) return json(req, { error: 'Not found (sync the subject first)' }, 404);
  const uz = profile.language === 'uz';

  if (body.action === 'voice_answer') {
    const question = row.data.questions?.find((q: { id: string }) => q.id === body.questionId);
    if (!question) return json(req, { error: 'Question not found' }, 404);
    await admin.from('bot_pending').upsert({
      user_id: user.id,
      kind: 'voice_answer',
      payload: { subjectId: body.subjectId, questionId: body.questionId },
      created_at: new Date().toISOString(),
    });
    const ok = await sendMessage(
      profile.telegram_id,
      uz
        ? `🎙 ${row.data.name}\n\n«${question.text}»\n\nJavobingizni ovozli xabar qilib yuboring. Imtihondagidek gapiring.`
        : `🎙 ${row.data.name}\n\n«${question.text}»\n\nОтправьте ответ голосовым сообщением. Говорите как на экзамене.`
    );
    return json(req, { ok });
  }

  if (body.action === 'send_file') {
    const material = row.data.materials?.find((m: { id: string }) => m.id === body.materialId);
    if (!material?.fileId) return json(req, { error: 'No original file' }, 404);
    const method = material.kind === 'image' ? 'sendPhoto' : 'sendDocument';
    const field = material.kind === 'image' ? 'photo' : 'document';
    const sent = await tg(method, { chat_id: profile.telegram_id, [field]: material.fileId, caption: material.name.slice(0, 200) });
    return json(req, { ok: sent !== null });
  }

  return json(req, { error: 'Unknown action' }, 400);
});
