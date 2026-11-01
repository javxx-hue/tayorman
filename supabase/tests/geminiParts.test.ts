import { describe, it, expect } from 'vitest';
import { isAllowedInlineMime } from '../functions/_shared/geminiParts';

describe('isAllowedInlineMime', () => {
  it('lets photos and WAV voice answers through', () => {
    for (const ok of ['image/jpeg', 'image/png', 'image/webp', 'audio/wav', 'audio/x-wav', 'IMAGE/JPEG']) expect(isAllowedInlineMime(ok)).toBe(true);
  });

  it('keeps out everything else', () => {
    for (const bad of ['audio/mpeg', 'audio/webm', 'video/mp4', 'application/pdf', 'text/html', 'image/', 'audio/wav; codecs=1', '', 'audio/wavx']) {
      expect(isAllowedInlineMime(bad)).toBe(false);
    }
    for (const notText of [undefined, null, 42, {}]) expect(isAllowedInlineMime(notText)).toBe(false);
  });
});
