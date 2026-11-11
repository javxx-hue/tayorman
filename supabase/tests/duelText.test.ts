import { describe, it, expect } from 'vitest';
import { duelChallengeMessage, duelResultMessage } from '../functions/_shared/duelText';

describe('duel bot messages', () => {
  it('tells the opponent who challenged them and the prizes', () => {
    const m = duelChallengeMessage('uz', 'Aziza', 5);
    expect(m).toContain('Aziza sizni duelga chaqirdi');
    expect(m).toContain('5 ta savol');
    expect(m).toContain('24 soat');
    expect(duelChallengeMessage('ru', 'Aziza', 5)).toContain('Aziza вызывает вас');
  });

  it('tells the challenger how the duel ended', () => {
    expect(duelResultMessage('uz', 'Bobur', 4, 2)).toBe("🏆 Bobur bilan duelda g'alaba! 4:2 · +50 XP");
    expect(duelResultMessage('uz', 'Bobur', 3, 3)).toContain('durang. 3:3 · +25 XP');
    expect(duelResultMessage('uz', 'Bobur', 1, 4)).toContain('1:4 · +10 XP');
    expect(duelResultMessage('ru', 'Bobur', 1, 4)).toContain('Попробуйте реванш');
  });
});
