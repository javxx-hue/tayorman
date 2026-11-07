import { describe, it, expect } from 'vitest';

import { parseQuestionList, planSubject, scoreToGrade, setsOfSubject, subjectReadiness, daysUntil, todayOverview } from './prep';
import { buildMaterialContext, fitMaterials, officeXmlToText } from './materials';
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

describe('setsOfSubject', () => {
  const set = (over: Partial<StudySet>) => ({ type: 'quiz', ...over }) as StudySet;

  it('finds a student\'s own sets by the subject\'s local id', () => {
    expect(setsOfSubject(subject('2026-12-01', []), [set({ id: 'a', subjectId: 'sub1' }), set({ id: 'b', subjectId: 'other' })]).map((s) => s.id)).toEqual(['a']);
  });

  it('finds sets from the library through the admin\'s subject id the delivered subject remembers', () => {
    const s = { ...subject('2026-12-01', []), id: 'sub-local', libraryId: 'lib-1', librarySourceId: 'sub-lib-tarmoq' };
    const sets = [
      set({ id: 'quiz', libraryId: 'lib-2', subjectId: 'sub-lib-tarmoq' }),
      set({ id: 'cards', libraryId: 'lib-3', subjectId: 'sub-lib-tarmoq' }),
      set({ id: 'other-subject', libraryId: 'lib-4', subjectId: 'sub-lib-baza' }),
      set({ id: 'loose', libraryId: 'lib-5' }),
    ];
    expect(setsOfSubject(s, sets).map((x) => x.id)).toEqual(['quiz', 'cards']);
  });

  it('does not match when the subject has no library id, or the set did not come from the library', () => {
    const noSource = subject('2026-12-01', []);
    expect(setsOfSubject(noSource, [set({ id: 'x', libraryId: 'lib-2', subjectId: 'undefined' })])).toEqual([]);
    const withSource = { ...subject('2026-12-01', []), librarySourceId: 'sub-lib-x' };
    expect(setsOfSubject(withSource, [set({ id: 'y', subjectId: 'sub-lib-x' })])).toEqual([]);
  });

  it('counts library quizzes toward readiness', () => {
    const s = { ...subject('2026-12-01', [q('a', 100)]), id: 'sub-local', librarySourceId: 'sub-lib-x' };
    const quiz = set({ id: 'z', libraryId: 'lib-9', subjectId: 'sub-lib-x', lastScore: 50 });
    expect(subjectReadiness(s, [quiz])).toBe(Math.round((100 * 3 + 50) / 4));
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

describe('planSubject: the day\'s share', () => {
  const today = '2026-11-01';
  const answeredToday = (id: string, score: number): ExamQuestion => ({
    id,
    text: `Savol ${id}`,
    attempts: [{ at: new Date('2026-11-01T10:00:00').getTime(), answer: 'x', score, feedback: '', missing: [] }],
  });
  // 5 days left -> 4 study days; 8 questions still to learn -> 2 a day
  const base = () => Array.from({ length: 8 }, (_, i) => q(String(i)));

  it('counts questions answered today towards the share, so the day can be finished', () => {
    const qs = [answeredToday('0', 40), ...base().slice(1)];
    const plan = planSubject(subject('2026-11-06', qs), today);
    expect(plan.perDay).toBe(2);
    expect(plan.doneToday).toBe(1);
    expect(plan.today.map((x) => x.id)).toEqual(['1']); // one more to do, not the same one again
  });

  it('is finished when the share is answered, and offers more practice beyond it', () => {
    const qs = [answeredToday('0', 40), answeredToday('1', 50), ...base().slice(2)];
    const plan = planSubject(subject('2026-11-06', qs), today);
    expect(plan.today).toEqual([]);
    expect(plan.doneToday).toBe(2);
    expect(plan.more.map((x) => x.id)).toEqual(['2', '3', '4', '5', '6', '7']);
  });

  it('keeps the share steady when a question answered well today stops being pending', () => {
    const qs = [answeredToday('0', 90), ...base().slice(1)]; // learned today: 7 pending, but 8 were this morning
    const plan = planSubject(subject('2026-11-06', qs), today);
    expect(plan.perDay).toBe(2); // counted from the 8 of this morning, not from the 7 left
    expect(plan.doneToday).toBe(1);
    expect(plan.today).toHaveLength(1);
  });

  it('does not count answers from other days', () => {
    const yesterday = { ...answeredToday('0', 40), attempts: [{ ...answeredToday('0', 40).attempts[0], at: new Date('2026-10-31T10:00:00').getTime() }] };
    const plan = planSubject(subject('2026-11-06', [yesterday, ...base().slice(1)]), today);
    expect(plan.doneToday).toBe(0);
    expect(plan.today.map((x) => x.id)).toEqual(['1', '2']); // untouched ones come before the one answered badly yesterday
  });
});

describe('fitMaterials', () => {
  const m = (id: string, n: number) => ({ id, name: id, kind: 'text' as const, text: 'x'.repeat(n), createdAt: 0 });

  it('keeps whole files while they fit, cuts the one that crosses the limit, drops the rest', () => {
    const out = fitMaterials([m('a', 60), m('b', 60), m('c', 60)], 100);
    expect(out.map((x) => [x.id, x.text.length])).toEqual([['a', 60], ['b', 40]]);
  });

  it('does not touch anything that fits, and handles none', () => {
    const list = [m('a', 10), m('b', 10)];
    expect(fitMaterials(list, 100)).toEqual(list);
    expect(fitMaterials([], 100)).toEqual([]);
  });

  it('never gives the AI more than it reads anyway', () => {
    const total = fitMaterials([m('a', 500_000)]).reduce((n, x) => n + x.text.length, 0);
    expect(total).toBe(120_000);
  });
});
