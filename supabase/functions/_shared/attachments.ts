// Files attached to a student request. Pure (no Deno or npm imports) so it can be unit tested.
// The same limits are set on the storage bucket (migration 0004).

export interface Attachment {
  path: string; // "<user id>/<timestamp>-<name>" inside the private "request-files" bucket
  name: string;
  size: number;
  mime: string;
}

export const MAX_ATTACHMENTS = 5;
export const MAX_FILE_BYTES = 20 * 1024 * 1024;

const BY_EXTENSION: Record<string, string> = {
  pdf: 'application/pdf',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  txt: 'text/plain',
  md: 'text/markdown',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
};

// What the file really is is decided by its extension: browsers and Telegram often send a wrong or empty type
export function mimeForName(name: string): string | null {
  const ext = name.toLowerCase().split('.').pop() ?? '';
  return BY_EXTENSION[ext] ?? null;
}

// Letters, digits, dot, dash, underscore only; never a path
export function safeFileName(name: string): string {
  const cleaned = name.replace(/[^\p{L}\p{N}._-]+/gu, '_').replace(/^[._]+/, '');
  const ext = cleaned.includes('.') ? cleaned.slice(cleaned.lastIndexOf('.')) : '';
  const base = (ext ? cleaned.slice(0, -ext.length) : cleaned).slice(0, 80) || 'file';
  return `${base}${ext.slice(0, 10)}`;
}

export const attachmentPath = (userId: string, name: string, now = Date.now()) => `${userId}/${now}-${safeFileName(name)}`;

// What a client sends along with a request; anything unexpected rejects the whole list
export function parseAttachments(raw: unknown, userId: string): Attachment[] | null {
  if (raw === undefined || raw === null) return [];
  if (!Array.isArray(raw) || raw.length > MAX_ATTACHMENTS) return null;
  const out: Attachment[] = [];
  for (const a of raw) {
    if (typeof a?.path !== 'string' || typeof a?.name !== 'string' || typeof a?.mime !== 'string' || !Number.isFinite(a?.size)) return null;
    // Only the sender's own folder, and no way to climb out of it
    if (!a.path.startsWith(`${userId}/`) || a.path.includes('..') || a.path.length > 300) return null;
    if (a.size < 0 || a.size > MAX_FILE_BYTES || !Object.values(BY_EXTENSION).includes(a.mime)) return null;
    out.push({ path: a.path, name: a.name.slice(0, 200), size: a.size, mime: a.mime });
  }
  return out;
}
