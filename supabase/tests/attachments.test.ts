import { describe, it, expect } from 'vitest';
import { attachmentPath, MAX_FILE_BYTES, mimeForName, parseAttachments, safeFileName } from '../functions/_shared/attachments';

const ME = '00000000-0000-0000-0000-0000000000c1';
const file = (over: Record<string, unknown> = {}) => ({ path: `${ME}/1-lecture.pdf`, name: 'lecture.pdf', size: 1000, mime: 'application/pdf', ...over });

describe('attachment file names', () => {
  it('knows documents and images by extension, nothing else', () => {
    expect(mimeForName('Ma\'ruza.PDF')).toBe('application/pdf');
    expect(mimeForName('slides.pptx')).toContain('presentationml');
    expect(mimeForName('photo.JPEG')).toBe('image/jpeg');
    for (const bad of ['virus.exe', 'page.html', 'script.js', 'noext', 'archive.zip']) expect(mimeForName(bad)).toBeNull();
  });

  it('makes a name that cannot be a path', () => {
    expect(safeFileName('../../etc/passwd')).toBe('etc_passwd');
    expect(safeFileName('Ma\'ruza 1 (final).docx')).toBe('Ma_ruza_1_final_.docx');
    expect(safeFileName('Iqtisodiyot nazariyasi.pdf')).toBe('Iqtisodiyot_nazariyasi.pdf');
    expect(safeFileName('///')).toBe('file');
    expect(safeFileName('a'.repeat(300) + '.pdf').length).toBeLessThanOrEqual(84);
  });

  it('puts every file in the sender\'s own folder', () => {
    expect(attachmentPath(ME, 'My file.pdf', 123)).toBe(`${ME}/123-My_file.pdf`);
  });
});

describe('parseAttachments', () => {
  it('accepts none, or a list of own files', () => {
    expect(parseAttachments(undefined, ME)).toEqual([]);
    expect(parseAttachments(null, ME)).toEqual([]);
    expect(parseAttachments([file()], ME)).toEqual([file()]);
  });

  it('rejects someone else\'s folder, climbing out of it and bad shapes', () => {
    expect(parseAttachments([file({ path: '00000000-0000-0000-0000-0000000000c2/1-x.pdf' })], ME)).toBeNull();
    expect(parseAttachments([file({ path: `${ME}/../other/x.pdf` })], ME)).toBeNull();
    expect(parseAttachments('files', ME)).toBeNull();
    expect(parseAttachments([{ path: `${ME}/x.pdf` }], ME)).toBeNull();
    expect(parseAttachments([file({ size: 'big' })], ME)).toBeNull();
  });

  it('rejects too many, too big and unknown types', () => {
    expect(parseAttachments(Array.from({ length: 6 }, () => file()), ME)).toBeNull();
    expect(parseAttachments(Array.from({ length: 5 }, () => file()), ME)).toHaveLength(5);
    expect(parseAttachments([file({ size: MAX_FILE_BYTES + 1 })], ME)).toBeNull();
    expect(parseAttachments([file({ mime: 'text/html' })], ME)).toBeNull();
  });
});
