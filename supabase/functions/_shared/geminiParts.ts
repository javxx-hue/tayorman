// What the AI proxy lets a client send inline. Pure (no Deno or npm imports) so it can be unit tested.
//
// Photos (study notes, a handwritten answer) and short voice answers (WAV). Nothing else: no other
// audio or video, and no links for the model to fetch.

export const INLINE_MIME = /^(image\/[a-z0-9.+-]+|audio\/(wav|x-wav))$/i;

export const isAllowedInlineMime = (mime: unknown): boolean => typeof mime === 'string' && INLINE_MIME.test(mime);
