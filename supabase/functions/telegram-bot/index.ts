// Telegram bot webhook.
//  /start [c_<code>]  welcome + Mini App button, optional community join
//  /reja              today's plan       /til      switch language
//  /eslatma           reminders on/off   /yordam   help
//  any other message  (text, file, photo) is passed to the admins as a request
//  voice message      graded as an answer to the question chosen in the Mini App
// Deploy with --no-verify-jwt; requests are checked against TELEGRAM_WEBHOOK_SECRET.
// Secrets: TELEGRAM_BOT_TOKEN, TELEGRAM_WEBHOOK_SECRET, APP_URL, AUTH_SECRET,
//          ADMIN_TELEGRAM_IDS, GEMINI_API_KEY, AI_DAILY_LIMIT
import { admin } from '../_shared/admin.ts';
import { ensureUser, joinCommunity, type TelegramUser } from '../_shared/users.ts';
import { tg, sendMessage, openAppButton, downloadFile } from '../_shared/telegram.ts';
import { submitRequest, TooManyRequests } from '../_shared/requests.ts';
import { planLines } from '../_shared/plan.ts';
import { bytesToBase64, callGemini, consumeQuota, QuotaError } from '../_shared/gemini.ts';

class BlockedError extends Error {}

type Lang = 'uz' | 'ru';

const T = {
  welcome: {
    uz: (name: string) =>
      `Salom, ${name}! 👋\n\n«Tayyorman» sessiya va oraliq nazoratlarga tayyorlanishga yordam beradi:\n• fanlar va imtihon sanalari\n• tayyor testlar va kartalar\n• imtihon savollariga javoblar va AI baholash\n• har kuni ertalab bugungi reja\n\nBoshlash uchun pastdagi tugmani bosing. Fan, savol yoki material kerak bo'lsa, shu chatga yozing: so'rovingiz adminga boradi.`,
    ru: (name: string) =>
      `Привет, ${name}! 👋\n\n«Tayyorman» помогает готовиться к сессии и промежуточному контролю:\n• предметы и даты экзаменов\n• готовые тесты и карточки\n• ответы на экзаменационные вопросы и оценка ИИ\n• каждое утро план на день\n\nНажмите кнопку ниже, чтобы начать. Нужен предмет, вопросы или материалы — напишите сюда, запрос уйдёт администратору.`,
  },
  open: { uz: '📚 Ochish', ru: '📚 Открыть' },
  joined: { uz: (n: string) => `✅ Siz «${n}» guruhiga qo'shildingiz.`, ru: (n: string) => `✅ Вы присоединились к группе «${n}».` },
  badCode: { uz: 'Taklif havolasi eskirgan yoki noto\'g\'ri.', ru: 'Ссылка-приглашение устарела или неверна.' },
  planTitle: { uz: '📚 Bugungi reja', ru: '📚 План на сегодня' },
  planEmpty: {
    uz: 'Hozircha reja yo\'q. Ilovada fan va imtihon sanasini qo\'shing.',
    ru: 'Плана пока нет. Предметы назначает администратор.',
  },
  lang: { uz: 'Til: o\'zbekcha 🇺🇿', ru: 'Язык: русский 🇷🇺' },
  remindersOn: { uz: '🔔 Har kunlik eslatmalar yoqildi (08:00).', ru: '🔔 Ежедневные напоминания включены (08:00).' },
  remindersOff: { uz: '🔕 Eslatmalar o\'chirildi.', ru: '🔕 Напоминания выключены.' },
  help: {
    uz: "/reja — bugungi reja\\n/til — tilni almashtirish\\n/eslatma — eslatmalarni yoqish/o'chirish\\n\\nFan, savol, material yoki xato haqida shu chatga yozing (fayl yoki rasm ham mumkin): so'rovingiz adminga yuboriladi.",
    ru: "/reja — план на сегодня\\n/til — сменить язык\\n/eslatma — вкл/выкл напоминания\\n\\nНапишите сюда о предмете, вопросах, материалах или ошибке (можно файл или фото): запрос уйдёт администратору.",
  },
  badFile: {
    uz: 'Bu fayl turini o\'qiy olmayman. PDF, PPTX, DOCX, TXT yoki rasm yuboring.',
    ru: 'Не могу прочитать этот тип файла. Пришлите PDF, PPTX, DOCX, TXT или фото.',
  },
  limit: { uz: 'Bugungi AI limiti tugadi. Ertaga yana urinib ko\'ring.', ru: 'Дневной лимит ИИ исчерпан. Попробуйте завтра.' },
  failed: { uz: 'Xatolik yuz berdi, keyinroq urinib ko\'ring.', ru: 'Произошла ошибка, попробуйте позже.' },
  noSubjects: {
    uz: 'Avval ilovada fan yarating, keyin faylni qayta yuboring.',
    ru: 'Сначала создайте предмет в приложении, затем пришлите файл снова.',
  },
  blocked: {
    uz: "Hisobingiz cheklangan. Savol bo'lsa, administratorga murojaat qiling.",
    ru: 'Ваш аккаунт ограничен. По вопросам обратитесь к администратору.',
  },
  expired: { uz: 'Bu so\'rov eskirgan. Faylni qayta yuboring.', ru: 'Запрос устарел. Пришлите файл снова.' },
  noVoiceTask: {
    uz: 'Ovozli javob uchun ilovada savolni ochib, «Ovoz bilan javob berish» tugmasini bosing.',
    ru: 'Чтобы ответить голосом, откройте вопрос в приложении и нажмите «Ответить голосом».',
  },
  grading: { uz: '⏳ Javobingizni tinglayapman...', ru: '⏳ Слушаю ваш ответ...' },
  openQuestion: { uz: 'Savolni ochish', ru: 'Открыть вопрос' },
};

const t = <K extends keyof typeof T>(key: K, lang: Lang) => T[key][lang];

async function profileOf(tgUser: TelegramUser): Promise<{ id: string; language: Lang; reminders_enabled: boolean; role: string }> {
  const id = await ensureUser(tgUser);
  const { data } = await admin.from('profiles').select('id, language, reminders_enabled, role, blocked').eq('id', id).single();
  if (data?.blocked) throw new BlockedError();
  return data as { id: string; language: Lang; reminders_enabled: boolean; role: string };
}

const appKeyboard = (lang: Lang, path = '') => ({ reply_markup: { inline_keyboard: [[openAppButton(t('open', lang), path)]] } });

// ---------------------------------------------------------------- commands
async function onCommand(chatId: number, text: string, user: TelegramUser) {
  const profile = await profileOf(user);
  const lang = profile.language;
  const [command, arg] = text.split(/\s+/, 2);

  switch (command.replace(/@\w+$/, '')) {
    case '/start': {
      await sendMessage(chatId, t('welcome', lang)(user.first_name ?? ''), appKeyboard(lang));
      const code = arg?.match(/^c_([a-f0-9]{12})$/)?.[1];
      if (code) {
        const name = await joinCommunity(profile.id, code);
        await sendMessage(chatId, name ? t('joined', lang)(name) : t('badCode', lang));
      }
      return;
    }
    case '/reja': {
      const lines = await planLines(profile.id, lang);
      await sendMessage(chatId, lines.length ? `${t('planTitle', lang)}\n\n${lines.join('\n')}` : t('planEmpty', lang), appKeyboard(lang));
      return;
    }
    case '/til': {
      const next: Lang = lang === 'uz' ? 'ru' : 'uz';
      await admin.from('profiles').update({ language: next }).eq('id', profile.id);
      await sendMessage(chatId, t('lang', next));
      return;
    }
    case '/eslatma': {
      const enabled = !profile.reminders_enabled;
      await admin.from('profiles').update({ reminders_enabled: enabled }).eq('id', profile.id);
      await sendMessage(chatId, enabled ? t('remindersOn', lang) : t('remindersOff', lang));
      return;
    }
    default:
      await sendMessage(chatId, t('help', lang), appKeyboard(lang));
  }
}

// ---------------------------------------------------------------- requests
// Students cannot add content; whatever they send becomes a request for the admins
async function onRequest(chatId: number, user: TelegramUser, m: { message_id: number; text?: string; caption?: string; document?: { file_name?: string }; photo?: unknown[] }) {
  const profile = await profileOf(user);
  const lang = profile.language;
  const label = m.document ? `📎 Fayl: ${m.document.file_name ?? 'file'}` : m.photo ? '🖼 Rasm' : '';
  const text = [label, m.text ?? m.caption ?? ''].filter(Boolean).join(' — ');
  if (text.trim().length < 3) return void (await sendMessage(chatId, t('help', lang), appKeyboard(lang)));
  try {
    await submitRequest(profile.id, m.document || m.photo ? 'questions' : 'other', text, m.document || m.photo ? { chatId, messageId: m.message_id } : undefined);
    await sendMessage(chatId, t('sent', lang));
  } catch (e) {
    if (e instanceof TooManyRequests) return void (await sendMessage(chatId, t('tooMany', lang)));
    console.error('request failed', e);
    await sendMessage(chatId, t('failed', lang));
  }
}

// ---------------------------------------------------------------- voice answers
async function onVoice(chatId: number, user: TelegramUser, fileId: string, mime: string) {
  const profile = await profileOf(user);
  const lang = profile.language;
  const { data: pending } = await admin.from('bot_pending').select('kind, payload').eq('user_id', profile.id).maybeSingle();
  if (pending?.kind !== 'voice_answer') return void (await sendMessage(chatId, t('noVoiceTask', lang)));

  const { subjectId, questionId } = pending.payload as { subjectId: string; questionId: string };
  const { data: row } = await admin.from('subjects').select('data').eq('user_id', profile.id).eq('id', subjectId).maybeSingle();
  const question = row?.data.questions?.find((q: { id: string }) => q.id === questionId);
  if (!row || !question) return void (await sendMessage(chatId, t('expired', lang)));

  await sendMessage(chatId, t('grading', lang));
  try {
    await consumeQuota(profile.id);
    const audio = await downloadFile(fileId);
    if (!audio) throw new Error('download failed');

    const reference = question.modelAnswer
      ? `Reference answer:\n${question.modelAnswer.summary}\nExpected points:\n- ${(question.modelAnswer.keyPoints ?? []).join('\n- ')}`
      : `Lecture materials:\n${(row.data.materials ?? []).map((m: { name: string; text: string }) => `=== ${m.name} ===\n${m.text}`).join('\n\n').slice(0, 60_000)}`;
    const prompt = `
You are a fair but demanding university examiner for "${row.data.name}". This is an oral exam answer recorded as audio.
First transcribe the student's answer, then grade it against the reference. Judge content, not pronunciation.
Write feedback in ${lang === 'uz' ? "Uzbek (o'zbek tili, lotin yozuvi)" : 'Russian'}, addressing the student directly, 2-4 sentences.

Exam question: ${question.text}

${reference}

Return strict JSON: { "transcript": "...", "score": 0-100 integer, "feedback": "...", "missing": ["..."] }`;

    const raw = await callGemini([{ text: prompt }, { inline_data: { mime_type: mime || 'audio/ogg', data: bytesToBase64(audio) } }], {
      json: true,
      temperature: 0.1,
    });
    const parsed = JSON.parse(raw);
    const score = Math.round(Number(parsed.score));
    if (!Number.isFinite(score) || score < 0 || score > 100) throw new Error('bad score');

    const attempt = {
      at: Date.now(),
      answer: String(parsed.transcript ?? '').trim(),
      score,
      feedback: String(parsed.feedback ?? '').trim(),
      missing: Array.isArray(parsed.missing) ? parsed.missing.filter((m: unknown) => typeof m === 'string') : [],
    };
    const questions = row.data.questions.map((q: { id: string; attempts?: unknown[] }) =>
      q.id === questionId ? { ...q, attempts: [...(q.attempts ?? []), attempt] } : q
    );
    await admin
      .from('subjects')
      .update({ data: { ...row.data, questions, updatedAt: Date.now() }, updated_at: new Date().toISOString() })
      .eq('user_id', profile.id)
      .eq('id', subjectId);
    await admin.from('bot_pending').delete().eq('user_id', profile.id);

    const grade = score >= 86 ? 5 : score >= 71 ? 4 : score >= 56 ? 3 : 2;
    const missing = attempt.missing.length ? `\n\n${lang === 'uz' ? 'Yetishmagan:' : 'Упущено:'}\n• ${attempt.missing.join('\n• ')}` : '';
    await sendMessage(chatId, `${lang === 'uz' ? 'Baho' : 'Оценка'}: ${grade} (${score}%)\n\n${attempt.feedback}${missing}`, {
      reply_markup: { inline_keyboard: [[openAppButton(t('openQuestion', lang), `/subjects/${subjectId}/q/${questionId}`)]] },
    });
  } catch (e) {
    console.error('voice failed', e);
    await sendMessage(chatId, e instanceof QuotaError ? t('limit', lang) : t('failed', lang));
  }
}

// ---------------------------------------------------------------- entry
Deno.serve(async (req) => {
  if (req.headers.get('x-telegram-bot-api-secret-token') !== Deno.env.get('TELEGRAM_WEBHOOK_SECRET')) {
    return new Response('forbidden', { status: 403 });
  }
  const update = await req.json().catch(() => null);

  try {
    if (update?.message?.chat?.type === 'private' && update.message.from) {
      const m = update.message;
      const chatId: number = m.chat.id;
      if (typeof m.text === 'string' && m.text.startsWith('/')) await onCommand(chatId, m.text, m.from);
      else if (m.voice) await onVoice(chatId, m.from, m.voice.file_id, m.voice.mime_type ?? 'audio/ogg');
      else if (m.audio) await onVoice(chatId, m.from, m.audio.file_id, m.audio.mime_type ?? 'audio/mpeg');
      else await onRequest(chatId, m.from, m);
    }
  } catch (e) {
    // Always 200 so Telegram does not retry the same update forever
    if (e instanceof BlockedError) {
      const who = update?.message?.from ?? update?.callback_query?.from;
      const lang: Lang = who?.language_code === 'ru' ? 'ru' : 'uz';
      if (who?.id) await sendMessage(who.id, t('blocked', lang));
    } else {
      console.error('update failed', e);
    }
  }
  return new Response('ok');
});
