import { describe, it, expect } from 'vitest';
import { PRIVACY_KEY, markPrivacySeen, privacySeen, privacyText } from './privacy';

const memory = () => {
  const data = new Map<string, string>();
  return { getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => void data.set(k, v) };
};

describe('privacy notice memory', () => {
  it('is unseen at first, seen after the student accepted', () => {
    const store = memory();
    expect(privacySeen(store)).toBe(false);
    markPrivacySeen(store);
    expect(privacySeen(store)).toBe(true);
    expect(store.getItem(PRIVACY_KEY)).toBe('1');
  });

  it('survives blocked or missing storage (it is just shown again)', () => {
    const broken = {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('blocked');
      },
    };
    expect(privacySeen(broken)).toBe(false);
    expect(() => markPrivacySeen(broken)).not.toThrow();
    expect(privacySeen(null)).toBe(false);
    expect(() => markPrivacySeen(null)).not.toThrow();
  });
});

describe('privacy text', () => {
  it('says the same things in both languages', () => {
    const uz = privacyText('uz');
    const ru = privacyText('ru');
    expect(uz.points).toHaveLength(ru.points.length);
    expect(uz.points.length).toBeGreaterThanOrEqual(4);
    for (const t of [uz, ru]) {
      expect(t.title.length).toBeGreaterThan(3);
      expect(t.accept.length).toBeGreaterThan(3);
      for (const p of t.points) expect(p.length).toBeGreaterThan(20);
    }
  });

  it('is honest about the AI service and about what is not kept', () => {
    for (const lang of ['uz', 'ru'] as const) {
      const all = privacyText(lang).points.join(' ');
      expect(all).toContain('Google Gemini'); // where voice and photos go
      expect(all).toContain('/eslatma'); // how to stop reminders
    }
  });
});
