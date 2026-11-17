import { describe, it, expect } from 'vitest';
import { directMessageBody, directMessageText, MAX_DIRECT_MESSAGE } from '../functions/_shared/directMessage';

describe('direct message from an admin', () => {
  it('sends trimmed text and refuses empty, missing or too long text', () => {
    expect(directMessageBody('  Salom!  ')).toBe('Salom!');
    expect(directMessageBody('   ')).toBeNull();
    expect(directMessageBody(undefined)).toBeNull();
    expect(directMessageBody(42)).toBeNull();
    expect(directMessageBody('a'.repeat(MAX_DIRECT_MESSAGE))).toHaveLength(MAX_DIRECT_MESSAGE);
    expect(directMessageBody('a'.repeat(MAX_DIRECT_MESSAGE + 1))).toBeNull();
  });

  it('puts a heading in the reader language and fits Telegram limit', () => {
    expect(directMessageText('uz', 'Salom')).toBe('💬 Administratordan xabar\n\nSalom');
    expect(directMessageText('ru', 'Привет')).toBe('💬 Сообщение от администратора\n\nПривет');
    expect(directMessageText('uz', 'a'.repeat(MAX_DIRECT_MESSAGE)).length).toBeLessThanOrEqual(4096);
  });
});
