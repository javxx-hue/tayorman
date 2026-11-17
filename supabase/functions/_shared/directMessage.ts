// A message an admin writes to one person from the admin site. Pure (no Deno or npm imports) so it can be unit tested.

export const MAX_DIRECT_MESSAGE = 3500; // Telegram allows 4096 characters; room is left for the heading

// The text after trimming, or null when there is nothing to send or it is too long
export function directMessageBody(text: unknown): string | null {
  if (typeof text !== 'string') return null;
  const body = text.trim();
  return body.length > 0 && body.length <= MAX_DIRECT_MESSAGE ? body : null;
}

// What the person sees in the bot
export function directMessageText(lang: 'uz' | 'ru', body: string): string {
  return `${lang === 'ru' ? '💬 Сообщение от администратора' : '💬 Administratordan xabar'}\n\n${body}`;
}
