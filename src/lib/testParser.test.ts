import { describe, it, expect } from 'vitest';
import { parseExamQuestionsFromText } from './testParser';

describe('parseExamQuestionsFromText', () => {
  it('parses standard Hemis format with + for the correct answer', () => {
    const raw = `
1. Axborot xavfsizligining asosiy tarkibiy qismlari qaysilar?
+Maxfiylik, butunlik, foydalana olishlik
Faqat maxfiylik va butunlik
Faqat identifikatsiya
Faqat autentifikatsiya

2. Algoritmning asosiy xossasi nima?
Cheksizlik
+Diskretlik, tushunarlilik, ommaviylik
Faqat murakkablik
Faqat tezlik
`;
    const { questions: qs, skipped } = parseExamQuestionsFromText(raw);
    expect(skipped).toBe(0);
    expect(qs).toHaveLength(2);

    expect(qs[0].question).toBe('Axborot xavfsizligining asosiy tarkibiy qismlari qaysilar?');
    expect(qs[0].options).toHaveLength(4);
    expect(qs[0].correctAnswer).toBe(0);
    expect(qs[0].options[0]).toBe('Maxfiylik, butunlik, foydalana olishlik');

    expect(qs[1].question).toBe('Algoritmning asosiy xossasi nima?');
    expect(qs[1].correctAnswer).toBe(1);
    expect(qs[1].options[1]).toBe('Diskretlik, tushunarlilik, ommaviylik');
  });

  it('parses lettered options with "Javob: X" and a +A) marker, split by ====', () => {
    const raw = `
O'zbekiston Respublikasi poytaxti qaysi shahar?
A) Samarqand
B) Buxoro
C) Toshkent
D) Xiva
Javob: C
====
CPU nima?
+A) Markaziy protsessor
B) Tezkor xotira
C) Qattiq disk
D) Videokarta
`;
    const { questions: qs } = parseExamQuestionsFromText(raw);
    expect(qs).toHaveLength(2);
    expect(qs[0].correctAnswer).toBe(2);
    expect(qs[0].options[2]).toBe('Toshkent');
    expect(qs[1].correctAnswer).toBe(0);
    expect(qs[1].options[0]).toBe('Markaziy protsessor');
  });

  it('never guesses: a question with no marked answer is skipped and counted', () => {
    const raw = `
Birinchi savol?
A) bir
B) ikki
C) uch
D) to'rt

Ikkinchi savol?
+A) to'g'ri
B) noto'g'ri
`;
    const { questions, skipped } = parseExamQuestionsFromText(raw);
    expect(skipped).toBe(1);
    expect(questions).toHaveLength(1);
    expect(questions[0].question).toBe('Ikkinchi savol?');
    expect(questions[0].correctAnswer).toBe(0);
  });

  it('handles empty input safely', () => {
    expect(parseExamQuestionsFromText('')).toEqual({ questions: [], skipped: 0 });
    expect(parseExamQuestionsFromText('   ')).toEqual({ questions: [], skipped: 0 });
  });
});
