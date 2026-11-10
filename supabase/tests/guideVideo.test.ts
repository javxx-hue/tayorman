import { describe, it, expect } from 'vitest';
import { storedGuideVideo, uploadedGuideVideo } from '../functions/_shared/guideVideo';

describe('uploadedGuideVideo', () => {
  it('takes a video sent with the /video caption', () => {
    expect(uploadedGuideVideo({ caption: '/video', video: { file_id: 'F1', file_unique_id: 'U1' } })).toEqual({ fileId: 'F1', uniqueId: 'U1' });
    expect(uploadedGuideVideo({ caption: ' /video@tayormanbot  qo\'llanma', video: { file_id: 'F2' } })).toEqual({ fileId: 'F2', uniqueId: null });
  });

  it('takes a video that was sent as a file, but not other files', () => {
    expect(uploadedGuideVideo({ caption: '/video', document: { file_id: 'D1', mime_type: 'video/mp4' } })?.fileId).toBe('D1');
    expect(uploadedGuideVideo({ caption: '/video', document: { file_id: 'D2', mime_type: 'application/pdf' } })).toBeNull();
  });

  it('ignores a video without the caption, or with another one', () => {
    expect(uploadedGuideVideo({ video: { file_id: 'F' } })).toBeNull();
    expect(uploadedGuideVideo({ caption: 'mana video', video: { file_id: 'F' } })).toBeNull();
    expect(uploadedGuideVideo({ caption: '/videos', video: { file_id: 'F' } })).toBeNull();
  });

  it('ignores the caption without a video', () => {
    expect(uploadedGuideVideo({ caption: '/video' })).toBeNull();
  });
});

describe('storedGuideVideo', () => {
  it('reads the file id', () => {
    expect(storedGuideVideo({ file_id: 'abc', unique_id: 'u' })).toBe('abc');
  });

  it('treats anything else as no video', () => {
    for (const v of [null, undefined, {}, { file_id: '' }, { file_id: 5 }, 'x']) expect(storedGuideVideo(v)).toBeNull();
  });
});
