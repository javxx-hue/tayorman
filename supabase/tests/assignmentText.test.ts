import { describe, it, expect } from 'vitest';
import { assignmentMessage, formatDue } from '../functions/_shared/assignmentText';

describe('assignment bot message', () => {
  it('shows the deadline in Tashkent time (UTC+5)', () => {
    expect(formatDue('2026-11-05T13:30:00Z')).toBe('05.11.2026 18:30');
    expect(formatDue('2026-12-31T20:00:00Z')).toBe('01.01.2027 01:00'); // crosses midnight
  });

  it('writes title, note and deadline in the student language', () => {
    const a = { title: 'Iqtisodiyot: 1-oraliq', note: '  Hammasini yeching  ', dueAt: '2026-11-05T13:30:00Z' };
    expect(assignmentMessage('uz', a)).toBe('📝 Yangi topshiriq: Iqtisodiyot: 1-oraliq\n\nHammasini yeching\n\n⏰ Muddat: 05.11.2026 18:30');
    expect(assignmentMessage('ru', a)).toContain('Новое задание: Iqtisodiyot: 1-oraliq');
    expect(assignmentMessage('ru', a)).toContain('Срок: 05.11.2026 18:30');
  });

  it('leaves out the empty parts', () => {
    expect(assignmentMessage('uz', { title: 'Test' })).toBe('📝 Yangi topshiriq: Test');
    expect(assignmentMessage('uz', { title: 'Test', note: '   ', dueAt: null })).toBe('📝 Yangi topshiriq: Test');
  });
});
