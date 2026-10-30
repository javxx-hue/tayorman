import { describe, it, expect, vi } from 'vitest';

import { parseQuestionList, planSubject, scoreToGrade, subjectReadiness, daysUntil, todayOverview } from './prep';
import { buildMaterialContext, officeXmlToText } from './materials';
import { ExamQuestion, Subject, StudySet } from '../types';

const q = (id: string, score?: number): ExamQuestion => ({
  id,
  text: `Savol ${id}`,
  attempts: score === undefined ? [] : [{ at: 0, answer: 'x', score, feedback: '', missing: [] }],
});

const subject = (examDate: string, questions: ExamQuestion[]): Subject => ({
  id: 'sub1',
  name: 'Iqtisodiyot nazariyasi',
  examDate,
  examFormat: 'oral',
  createdAt: 0,
  updatedAt: 0,
  materials: [],
  questions,
});

describe('parseQuestionList', () => {
  it('parses numbered lists in common formats and joins wrapped lines', () => {
    const raw = `1. Bozor iqtisodiyoti nima?
2) Talab qonuni va unga ta'sir
etuvchi omillar.
№3 Inflyatsiya turlari
4-savol. Pul massasi`;
    expect(parseQuestionList(raw)).toEqual([
      'Bozor iqtisodiyoti nima?',
      "Talab qonuni va unga ta'sir etuvchi omillar.",
      'Inflyatsiya turlari',
      'Pul massasi',
    ]);
  });

  it('treats each line as a question when there is no numbering', () => {
    expect(parseQuestionList('- Birinchi savol\n• Ikkinchi savol\n\nUchinchi savol')).toEqual([
      'Birinchi savol',
      'Ikkinchi savol',
      'Uchinchi savol',
    ]);
  });

  it('keeps numbers that are part of the question text', () => {
    expect(parseQuestionList('1. 1991 yil voqealari\n2. XX asr')).toEqual(['1991 yil voqealari', 'XX asr']);
  });
});

describe('scoreToGrade', () => {
  it('maps to the 5-point scale', () => {
    expect([100, 86, 85, 71, 70, 56, 55, 0].map(scoreToGrade)).toEqual([5, 5, 4, 4, 3, 3, 2, 2]);
  });
});

describe('planSubject', () => {
  const today = '2026-11-01';

  it('spreads weak questions over the days left, keeping the last day for review', () => {
    const qs = Array.from({ length: 10 }, (_, i) => q(String(i)));
    const plan = planSubject(subject('2026-11-06', qs), today); // 5 days left -> 4 study days
    expect(plan.daysLeft).toBe(5);
    expect(plan.perDay).toBe(3);
    expect(plan.today.map((x) => x.id)).toEqual(['0', '1', '2']);
  });

  it('puts the weakest questions first and skips learned ones', () => {
    const plan = planSubject(subject('2026-11-11', [q('a', 90), q('b', 60), q('c'), q('d', 30)]), today);
    expect(plan.remaining).toBe(3);
    expect(plan.today[0].id).toBe('c');
    expect(plan.today.map((x) => x.id)).not.toContain('a');
  });

  it('turns the day before the exam into a full review of what is left', () => {
    const plan = planSubject(subject('2026-11-02', [q('a', 90), q('b', 10), q('c')]), today);
    expect(plan.isReviewDay).toBe(true);
    expect(plan.today.map((x) => x.id)).toEqual(['c', 'b']);
  });

  it('plans nothing on or after the exam day', () => {
    expect(planSubject(subject('2026-11-01', [q('a')]), today).today).toEqual([]);
    expect(daysUntil('2026-10-30', today)).toBe(-2);
  });
});

describe('subjectReadiness', () => {
  it('weights the question list 3:1 against quiz results', () => {
    const s = subject('2026-12-01', [q('a', 100), q('b', 0)]); // 50
    const quiz = { id: 'x', subjectId: 'sub1', type: 'quiz', lastScore: 90 } as StudySet;
    expect(subjectReadiness(s, [quiz])).toBe(Math.round((50 * 3 + 90) / 4));
  });

  it('is 0 with nothing done yet', () => {
    expect(subjectReadiness(subject('2026-12-01', []), [])).toBe(0);
  });
});

describe('todayOverview', () => {
  it('lists upcoming exams soonest first and drops past ones', () => {
    const a = { ...subject('2026-11-20', [q('1')]), id: 'later' };
    const b = { ...subject('2026-11-05', [q('1')]), id: 'sooner' };
    const c = { ...subject('2026-10-01', [q('1')]), id: 'past' };
    const o = todayOverview([a, b, c], [], new Date(2026, 10, 1, 12));
    expect(o.tasks.map((t) => t.subject.id)).toEqual(['sooner', 'later']);
  });
});

describe('materials helpers', () => {
  it('extracts slide text by paragraph and decodes entities', () => {
    const xml =
      '<p:sp><a:p><a:r><a:t>Talab &amp; taklif</a:t></a:r></a:p><a:p><a:r><a:t>Narx </a:t></a:r><a:r><a:t xml:lang="uz">shakllanishi</a:t></a:r></a:p></p:sp>';
    expect(officeXmlToText(xml, 'a:t', 'a:p')).toBe('Talab & taklif\nNarx shakllanishi');
  });

  it('labels each material and trims the context to the limit', () => {
    const mats = [
      { id: '1', name: 'A.pdf', kind: 'pdf' as const, text: 'aaaa', createdAt: 0 },
      { id: '2', name: 'B.pdf', kind: 'pdf' as const, text: 'b'.repeat(100), createdAt: 0 },
    ];
    const ctx = buildMaterialContext(mats, 40);
    expect(ctx.startsWith('=== A.pdf ===\naaaa')).toBe(true);
    expect(ctx.length).toBeLessThanOrEqual(40);
  });
});
