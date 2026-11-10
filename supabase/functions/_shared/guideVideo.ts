// The how-to video of the bot. An admin sends the video to the bot once with the caption "/video";
// the bot keeps Telegram's file id (in app_settings) and sends the same video to anyone who asks.
// Pure (no Deno or npm imports) so it can be unit tested.

export const GUIDE_VIDEO_KEY = 'guide_video';

export type VideoMessage = {
  caption?: string;
  video?: { file_id: string; file_unique_id?: string };
  document?: { file_id: string; file_unique_id?: string; mime_type?: string };
};

// The video an admin is uploading as the guide: a video (or a video sent as a file) captioned "/video"
export function uploadedGuideVideo(m: VideoMessage): { fileId: string; uniqueId: string | null } | null {
  const command = (m.caption ?? '').trim().split(/\s+/, 1)[0].replace(/@\w+$/, '');
  if (command !== '/video') return null;
  const file = m.video ?? (m.document?.mime_type?.startsWith('video/') ? m.document : undefined);
  return file?.file_id ? { fileId: file.file_id, uniqueId: file.file_unique_id ?? null } : null;
}

// What app_settings holds for the key; anything unexpected means "no video"
export function storedGuideVideo(value: unknown): string | null {
  const id = (value as { file_id?: unknown } | null)?.file_id;
  return typeof id === 'string' && id.length > 0 ? id : null;
}
