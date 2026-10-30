const token = () => {
  const t = Deno.env.get('TELEGRAM_BOT_TOKEN');
  if (!t) throw new Error('TELEGRAM_BOT_TOKEN is not set');
  return t;
};

export async function tg<T = unknown>(method: string, body: Record<string, unknown>): Promise<T | null> {
  const res = await fetch(`https://api.telegram.org/bot${token()}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => null);
  if (!json?.ok) {
    console.error(`Telegram ${method} failed`, res.status, JSON.stringify(json)?.slice(0, 300));
    return null;
  }
  return json.result as T;
}

export const appUrl = () => Deno.env.get('APP_URL') ?? '';

// Inline button that opens the Mini App (optionally at a path)
export function openAppButton(text: string, path = '') {
  return { text, web_app: { url: `${appUrl()}${path}` } };
}

export async function sendMessage(chatId: number, text: string, extra: Record<string, unknown> = {}): Promise<boolean> {
  return (await tg('sendMessage', { chat_id: chatId, text, disable_web_page_preview: true, ...extra })) !== null;
}

// Downloads a file the user sent to the bot (Bot API limit: 20 MB)
export async function downloadFile(fileId: string): Promise<Uint8Array | null> {
  const file = await tg<{ file_path?: string }>('getFile', { file_id: fileId });
  if (!file?.file_path) return null;
  const res = await fetch(`https://api.telegram.org/file/bot${token()}/${file.file_path}`);
  return res.ok ? new Uint8Array(await res.arrayBuffer()) : null;
}
