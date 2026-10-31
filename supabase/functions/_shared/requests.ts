// Student requests to the admins ("Taklif qutisi"). Used by the Mini App (request-admin)
// and by the bot, so both save and announce a request the same way.
import { admin } from './admin.ts';
import { sendMessage, tg } from './telegram.ts';
import { parseAdminIds } from './roles.ts';

export const REQUEST_KINDS = ['new_subject', 'questions', 'bug', 'other'] as const;
export type RequestKind = (typeof REQUEST_KINDS)[number];

const KIND_LABEL: Record<RequestKind, string> = {
  new_subject: 'Yangi fan so\'rovi',
  questions: 'Savollar / material',
  bug: 'Xato haqida',
  other: 'Boshqa',
};

export class TooManyRequests extends Error {}

const adminChatIds = () => [...parseAdminIds(Deno.env.get('ADMIN_TELEGRAM_IDS'))];

// Saves the request and tells every admin in the bot. Returns the new row id.
export async function submitRequest(
  userId: string,
  kind: RequestKind,
  text: string,
  fromChat?: { chatId: number; messageId: number } // original message, copied to admins (files, photos)
): Promise<number> {
  const clean = text.trim().slice(0, 4000);
  const { data, error } = await admin.from('suggestions').insert({ user_id: userId, kind, text: clean }).select('id').single();
  if (error) {
    // The daily-limit trigger raises "limit"; anything else is a real failure
    if (/limit/i.test(error.message)) throw new TooManyRequests();
    throw error;
  }

  const { data: who } = await admin.from('profiles').select('first_name, username').eq('id', userId).maybeSingle();
  const name = [who?.first_name, who?.username ? `@${who.username}` : null].filter(Boolean).join(' ') || 'Talaba';
  const note = `📩 ${KIND_LABEL[kind]} · ${name}\n\n${clean.slice(0, 600)}\n\nJavob berish: admin sayti → So'rovlar`;
  for (const id of adminChatIds()) {
    await sendMessage(id, note);
    if (fromChat) await tg('copyMessage', { chat_id: id, from_chat_id: fromChat.chatId, message_id: fromChat.messageId });
  }
  return data.id as number;
}
