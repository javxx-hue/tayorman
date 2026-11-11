import { describe, it, expect } from 'vitest';
import { isMistake, isMistakeDue, mergeProgress, overview, pickQuestions, recordAnswer, topicSummaries, MASTERED_BOX, type SetProgress } from './quizProgress';

const DAY = 86_400_000;
const T0 = new Date('2026-12-01T09:00:00').getTime();
const q = (id: string, topic?: number) => ({ id, topic });

describe('recordAnswer', () => {
  it('a right answer on a fresh question changes nothing about mistakes', () => {
    const s = recordAnswer(undefined, true, T0);
    expect(s).toMatchObject({ seen: 1, wrong: 0, right: true, at: T0 });
    expect(isMistake(s)).toBe(false);
  });

  it('a wrong answer makes it a mistake that comes back the next day', () => {
    const s = recordAnswer(undefined, false, T0);
    expect(s).toMatchObject({ seen: 1, wrong: 1, right: false, box: 0, due: T0 + DAY });
    expect(isMistake(s)).toBe(true);
    expect(isMistakeDue(s, T0)).toBe(false);
    expect(isMistakeDue(s, T0 + DAY)).toBe(true);
  });

  it('each later right answer pushes it further out, and the third overcomes it', () => {
    let s = recordAnswer(undefined, false, T0);
    s = recordAnswer(s, true, T0 + DAY);
    expect(s).toMatchObject({ box: 1, due: T0 + DAY + 3 * DAY, right: true });
    s = recordAnswer(s, true, T0 + 4 * DAY);
    expect(s).toMatchObject({ box: 2, due: T0 + 4 * DAY + 7 * DAY });
    s = recordAnswer(s, true, T0 + 11 * DAY);
    expect(s.box).toBe(MASTERED_BOX);
    expect(isMistake(s)).toBe(false);
    expect(s).toMatchObject({ seen: 4, wrong: 1 });
  });

  it('a wrong answer in between starts the climb again', () => {
    let s = recordAnswer(undefined, false, T0);
    s = recordAnswer(s, true, T0 + DAY);
    s = recordAnswer(s, false, T0 + 2 * DAY);
    expect(s).toMatchObject({ box: 0, wrong: 2, due: T0 + 3 * DAY });
  });

  it('an overcome question that is missed again is a mistake again', () => {
    let s: ReturnType<typeof recordAnswer> | undefined;
    s = recordAnswer(s, false, T0);
    for (const d of [1, 4, 11]) s = recordAnswer(s, true, T0 + d * DAY);
    expect(isMistake(s)).toBe(false);
    s = recordAnswer(s, false, T0 + 20 * DAY);
    expect(isMistake(s)).toBe(true);
  });
});

describe('pickQuestions', () => {
  const questions = ['a', 'b', 'c', 'd', 'e', 'f'].map((id, i) => q(id, i < 3 ? 1 : 2));
  const progress: SetProgress = {
    a: recordAnswer(undefined, true, T0 - 5 * DAY), // known
    b: recordAnswer(undefined, false, T0 - 3 * DAY), // mistake, due
    d: recordAnswer(undefined, false, T0), // mistake, due tomorrow
  };

  it('"mixed" is new questions first when no mistake is due, in deck order', () => {
    const fresh = { a: progress.a };
    expect(pickQuestions(questions, fresh, { mode: 'mixed', count: 3, now: T0 }).map((x) => x.id)).toEqual(['b', 'c', 'd']);
  });

  it('"mixed" falls back to mistakes and then known ones when little is new', () => {
    expect(pickQuestions(questions, progress, { mode: 'mixed', count: 6, now: T0 }).map((x) => x.id)).toEqual(['b', 'c', 'e', 'f', 'd', 'a']);
  });

  it('"mistakes" is only mistakes, the due ones first', () => {
    expect(pickQuestions(questions, progress, { mode: 'mistakes', count: 10, now: T0 }).map((x) => x.id)).toEqual(['b', 'd']);
    expect(pickQuestions(questions, {}, { mode: 'mistakes', count: 10, now: T0 })).toEqual([]);
  });

  it('"mixed" brings due mistakes back between the new questions', () => {
    const got = pickQuestions(questions, progress, { mode: 'mixed', count: 3, now: T0 }).map((x) => x.id);
    expect(got).toEqual(['b', 'c', 'e']);
  });

  it('stays inside one topic and never returns more than asked', () => {
    expect(pickQuestions(questions, progress, { mode: 'mixed', count: 10, topic: 2, now: T0 }).map((x) => x.id)).toEqual(['e', 'f', 'd']);
    expect(pickQuestions(questions, progress, { mode: 'mixed', count: 0, now: T0 })).toEqual([]);
  });
});

describe('topics and overview', () => {
  const topics = [{ no: 1, name: 'Bir' }, { no: 2, name: 'Ikki' }, { no: 3, name: 'Uch' }];
  const questions = [q('a', 1), q('b', 1), q('c', 1), q('d', 1), q('e', 2), q('f', 2), q('g', 3)];

  it('summarises each topic', () => {
    const p: SetProgress = {
      a: recordAnswer(undefined, true, T0),
      b: recordAnswer(undefined, false, T0),
      c: recordAnswer(undefined, false, T0),
      e: recordAnswer(undefined, true, T0),
    };
    const s = topicSummaries(questions, topics, p);
    expect(s[0]).toMatchObject({ no: 1, total: 4, seen: 3, mistakes: 2, accuracy: 33 });
    expect(s[1]).toMatchObject({ no: 2, total: 2, seen: 1, mistakes: 0, accuracy: 100 });
    expect(s[2]).toMatchObject({ no: 3, total: 1, seen: 0, accuracy: null });
  });

  it('counts today\'s answers, mistakes due and accuracy', () => {
    const p: SetProgress = { a: recordAnswer(undefined, true, T0), b: recordAnswer(undefined, false, T0 - 3 * DAY), c: recordAnswer(undefined, true, T0 - 3 * DAY) };
    expect(overview(questions, p, T0)).toEqual({ total: 7, seen: 3, mistakes: 1, dueMistakes: 1, accuracy: 67, answeredToday: 1 });
  });
});

describe('mergeProgress', () => {
  it('keeps the later answer and never lowers the counts', () => {
    const phone: SetProgress = { a: { seen: 3, wrong: 1, right: true, at: 200, box: 1, due: 900 } };
    const cloud: SetProgress = { a: { seen: 5, wrong: 2, right: false, at: 100, box: 0, due: 500 }, z: { seen: 1, wrong: 0, right: true, at: 50, box: 3, due: 0 } };
    const merged = mergeProgress(phone, cloud);
    expect(merged.a).toEqual({ seen: 5, wrong: 2, right: true, at: 200, box: 1, due: 900 });
    expect(merged.z.seen).toBe(1);
  });
});
