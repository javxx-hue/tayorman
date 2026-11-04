// Telegram bot webhook.
//  /start [c_<code>]  welcome + Mini App button, optional community join
//  /start a_<nonce>   admin site sign-in from a browser: shows a code and a Confirm button
//  admins and moderators also get an "Admin" menu button that opens the admin site inside Telegram
//  /reja              today's plan       /til      switch language
//  /eslatma           reminders on/off   /yordam   help
//  any other message  (text, file, photo) is passed to the admins as a request
//  voice message      graded as an answer to the question chosen in the Mini App
// Deploy with --no-verify-jwt; requests are checked against TELEGRAM_WEBHOOK_SECRET.
// Secrets: TELEGRAM_BOT_TOKEN, TELEGRAM_WEBHOOK_SECRET, APP_URL, AUTH_SECRET,
//          ADMIN_TELEGRAM_IDS, GEMINI_API_KEY, AI_DAILY_LIMIT
import { admin } from '../_shared/admin.ts';
import { ensureProfile, joinCommunity, type TelegramUser } from '../_shared/users.ts';
import { tg, sendMessage, openAppButton, downloadFile } from '../_shared/telegram.ts';
import { submitRequest, TooManyRequests } from '../_shared/requests.ts';
import { attachmentPath, MAX_FILE_BYTES, mimeForName, type Attachment } from '../_shared/attachments.ts';
import { nonceCode, nonceFromStart, nonceHash } from '../_shared/loginNonce.ts';
import { isStaffRole, menuButtonFor } from '../_shared/staff.ts';
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
  blocked: {
    uz: "Hisobingiz cheklangan. Savol bo'lsa, administratorga murojaat qiling.",
    ru: 'Ваш аккаунт ограничен. По вопросам обратитесь к администратору.',
  },
  expired: { uz: 'Bu so\'rov eskirgan. Ilovada savolni qayta oching.', ru: 'Запрос устарел. Откройте вопрос в приложении заново.' },
  sent: { uz: "✅ So'rovingiz adminga yuborildi. Javob shu chatga keladi.", ru: '✅ Запрос отправлен администратору. Ответ придёт в этот чат.' },
  tooMany: { uz: "Bugun juda ko'p so'rov yubordingiz. Ertaga yana yozing.", ru: 'Сегодня слишком много запросов. Напишите завтра.' },
  badFile: { uz: "Bu fayl turini qabul qila olmayman. PDF, Word, PowerPoint, TXT yoki rasm yuboring.", ru: 'Не могу принять этот тип файла. Пришлите PDF, Word, PowerPoint, TXT или фото.' },
  tooBig: { uz: 'Fayl 20 MB dan katta. Kichikroq fayl yuboring.', ru: 'Файл больше 20 МБ. Пришлите файл поменьше.' },
  noVoiceTask: {
    uz: 'Ovozli javob uchun ilovada savolni ochib, «Ovoz bilan javob berish» tugmasini bosing.',
    ru: 'Чтобы ответить голосом, откройте вопрос в приложении и нажмите «Ответить голосом».',
  },
  grading: { uz: '⏳ Javobingizni tinglayapman...', ru: '⏳ Слушаю ваш ответ...' },
  staffOnly: { uz: "Bu bo'lim faqat administratorlar uchun.", ru: 'Этот раздел только для администраторов.' },
  loginAsk: {
    uz: (code: string) => `🔐 Admin saytga kirish\n\nSaytda ko'rsatilgan kod: ${code}\nKod bir xil bo'lsa, tasdiqlang. Siz saytni ochmagan bo'lsangiz, tasdiqlamang.`,
    ru: (code: string) => `🔐 Вход на сайт администратора\n\nКод на сайте: ${code}\nЕсли код совпадает, подтвердите. Если вы не открывали сайт, не подтверждайте.`,
  },
  loginConfirm: { uz: '✅ Tasdiqlash', ru: '✅ Подтвердить' },
  loginDone: { uz: '✅ Tasdiqlandi. Saytga qayting, u o\'zi ochiladi.', ru: '✅ Подтверждено. Вернитесь на сайт, он откроется сам.' },
  openQuestion: { uz: 'Savolni ochish', ru: 'Открыть вопрос' },
};

const t = <K extends keyof typeof T>(key: K, lang: Lang) => T[key][lang];

async function profileOf(tgUser: TelegramUser) {
  const profile = await ensureProfile(tgUser);
  if (profile.blocked) throw new BlockedError();
  return profile;
}

const appKeyboard = (lang: Lang, path = '') => ({ reply_markup: { inline_keyboard: [[openAppButton(t('open', lang), path)]] } });

// Staff get the Admin button. Anyone else gets the normal menu back, but only when they start the bot:
// one call is enough to take the button from someone who is no longer staff, and students are not bothered each time.
async function syncMenuButton(chatId: number, role: string, isStart: boolean) {
  if (!isStaffRole(role) && !isStart) return;
  const button = menuButtonFor(role, Deno.env.get('ADMIN_URL'));
  if (button) await tg('setChatMenuButton', { chat_id: chatId, menu_button: button });
}

// The menu button is housekeeping: it runs next to the reply instead of before it, and a failure there never
// stops the reply (the reply's own failure still does).
async function alongside(housekeeping: Promise<void>, work: Promise<void>) {
  housekeeping.catch((e) => console.warn('menu button failed', e));
  await work;
  await housekeeping.catch(() => {}); // let it finish before the function may be stopped
}

// ---------------------------------------------------------------- commands
async function onCommand(chatId: number, text: string, user: TelegramUser) {
  const profile = await profileOf(user);
  const isStart = text.split(/\s+/, 1)[0].replace(/@\w+$/, '') === '/start';
  await alongside(syncMenuButton(chatId, profile.role, isStart), runCommand(chatId, text, user, profile));
}

async function runCommand(chatId: number, text: string, user: TelegramUser, profile: Awaited<ReturnType<typeof profileOf>>) {
  const lang = profile.language;
  const [command, arg] = text.split(/\s+/, 2);

  switch (command.replace(/@\w+$/, '')) {
    case '/start': {
      const nonce = nonceFromStart(arg);
      if (nonce) {
        // Only admins and moderators get a Confirm button; everyone else just sees a plain refusal
        if (!isStaffRole(profile.role)) return void (await sendMessage(chatId, t('staffOnly', lang)));
        return void (await sendMessage(chatId, t('loginAsk', lang)(nonceCode(nonce)), {
          reply_markup: { inline_keyboard: [[{ text: t('loginConfirm', lang), callback_data: `al:${nonce}` }]] },
        }));
      }
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
type Incoming = {
  message_id: number;
  text?: string;
  caption?: string;
  document?: { file_id: string; file_name?: string; mime_type?: string; file_size?: number };
  photo?: { file_id: string; file_size?: number }[];
};

// A file or photo from the chat is kept in the private bucket, so the admin can open it on the site
async function storeFile(userId: string, m: Incoming): Promise<Attachment | 'bad' | 'big' | 'failed'> {
  const best = m.photo?.[m.photo.length - 1]; // the largest size
  const fileId = m.document?.file_id ?? best?.file_id;
  if (!fileId) return 'failed';
  const name = m.document?.file_name ?? `photo-${m.message_id}.jpg`;
  const mime = m.document ? mimeForName(name) : 'image/jpeg';
  if (!mime) return 'bad';
  const size = m.document?.file_size ?? best?.file_size ?? 0;
  if (size > MAX_FILE_BYTES) return 'big';

  const bytes = await downloadFile(fileId);
  if (!bytes) return 'failed';
  const path = attachmentPath(userId, name);
  const { error } = await admin.storage.from('request-files').upload(path, bytes, { contentType: mime });
  return error ? 'failed' : { path, name, size: bytes.length, mime };
}

// Students cannot add content; whatever they send becomes a request for the admins
async function onRequest(chatId: number, user: TelegramUser, m: Incoming) {
  const profile = await profileOf(user);
  await alongside(syncMenuButton(chatId, profile.role, false), runRequest(chatId, profile, m));
}

async function runRequest(chatId: number, profile: Awaited<ReturnType<typeof profileOf>>, m: Incoming) {
  const lang = profile.language;
  const hasFile = !!(m.document || m.photo?.length);
  const label = m.document ? `📎 Fayl: ${m.document.file_name ?? 'file'}` : m.photo?.length ? '🖼 Rasm' : '';
  const text = [label, m.text ?? m.caption ?? ''].filter(Boolean).join(' — ');
  if (text.trim().length < 3) return void (await sendMessage(chatId, t('help', lang), appKeyboard(lang)));

  try {
    const attachments: Attachment[] = [];
    if (hasFile) {
      const stored = await storeFile(profile.id, m);
      if (stored === 'bad') return void (await sendMessage(chatId, t('badFile', lang)));
      if (stored === 'big') return void (await sendMessage(chatId, t('tooBig', lang)));
      if (stored === 'failed') return void (await sendMessage(chatId, t('failed', lang)));
      attachments.push(stored);
    }
    await submitRequest(profile.id, hasFile ? 'questions' : 'other', text, attachments);
    await sendMessage(chatId, t('sent', lang));
  } catch (e) {
    if (e instanceof TooManyRequests) return void (await sendMessage(chatId, t('tooMany', lang)));
    console.error('request failed', e);
    await sendMessage(chatId, t('failed', lang));
  }
}

// ---------------------------------------------------------------- admin site sign-in
async function onLoginConfirm(query: { id: string; data: string; from: TelegramUser; message?: { chat: { id: number }; message_id: number } }) {
  const profile = await profileOf(query.from);
  const lang = profile.language;
  await tg('answerCallbackQuery', { callback_query_id: query.id });
  const nonce = nonceFromStart(`a_${query.data.slice(3)}`);
  if (!nonce || !isStaffRole(profile.role)) return;

  await admin.from('admin_login_requests').upsert({ nonce_hash: await nonceHash(nonce), user_id: profile.id }, { onConflict: 'nonce_hash', ignoreDuplicates: true });
  // Old rows are of no use to anyone
  await admin.from('admin_login_requests').delete().lt('approved_at', new Date(Date.now() - 24 * 3600 * 1000).toISOString());

  const chatId = query.message?.chat.id ?? query.from.id;
  if (query.message) await tg('editMessageText', { chat_id: chatId, message_id: query.message.message_id, text: t('loginDone', lang) });
  else await sendMessage(chatId, t('loginDone', lang));
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
    if (typeof update?.callback_query?.data === 'string' && update.callback_query.data.startsWith('al:')) {
      await onLoginConfirm(update.callback_query);
    } else if (update?.message?.chat?.type === 'private' && update.message.from) {
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
