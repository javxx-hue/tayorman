import { describe, it, expect } from 'vitest';
import { pickVoice } from './speech';

const voices = (...langs: string[]) => langs.map((lang) => ({ lang, name: lang }));

describe('pickVoice', () => {
  it('Uzbek prefers an Uzbek voice, then a Turkish one', () => {
    expect(pickVoice(voices('en-US', 'tr-TR', 'uz-UZ'), 'uz')?.lang).toBe('uz-UZ');
    expect(pickVoice(voices('en-US', 'tr-TR'), 'uz')?.lang).toBe('tr-TR');
  });

  it('Russian needs a Russian voice', () => {
    expect(pickVoice(voices('en-US', 'ru-RU'), 'ru')?.lang).toBe('ru-RU');
    expect(pickVoice(voices('en-US', 'tr-TR'), 'ru')).toBeNull(); // a Turkish voice must not read Russian
  });

  it('gives nothing when the phone has no suitable voice, so no button is shown', () => {
    expect(pickVoice([], 'uz')).toBeNull();
    expect(pickVoice(voices('en-US', 'de-DE'), 'uz')).toBeNull();
  });

  it('understands both spellings of a language tag', () => {
    expect(pickVoice(voices('ru_RU'), 'ru')?.lang).toBe('ru_RU');
    expect(pickVoice(voices('TR-tr'), 'uz')?.lang).toBe('TR-tr');
  });

  it('does not mix up codes that merely start alike', () => {
    expect(pickVoice(voices('tl-PH', 'rue'), 'uz')).toBeNull(); // not 'tr', not 'ru'
  });
});
