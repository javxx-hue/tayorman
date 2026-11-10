import { describe, it, expect } from 'vitest';
import { allocate, type Need } from './budget';

const need = (id: string, over: Partial<Need> = {}): Need => ({ id, questions: 0, tests: 0, mistakes: 0, newCards: 0, reviews: 0, ...over });

describe('allocate', () => {
  it('gives everything when it fits', () => {
    const got = allocate([need('a', { questions: 2, tests: 10, newCards: 4 })], 45); // 8 + 10 + 2 = 20 min
    expect(got.a).toMatchObject({ questions: 2, tests: 10, newCards: 4, minutes: 20 });
  });

  it('keeps what is due and cuts the rest by the same share in every subject', () => {
    const got = allocate(
      [need('near', { questions: 10, tests: 20, reviews: 10 }), need('far', { questions: 5, tests: 10, mistakes: 3 })],
      45
    );
    // due: 10 reviews * 0.3 + 3 mistakes = 6 min; flexible 60 + 30 = 90 min into 39 min -> factor 0.433
    expect(got.near).toMatchObject({ reviews: 10, questions: 4, tests: 8 });
    expect(got.far).toMatchObject({ mistakes: 3, questions: 2, tests: 4 });
    const total = got.near.minutes + got.far.minutes;
    expect(total).toBeLessThanOrEqual(46);
  });

  it('a subject asking more per day (exam nearer) keeps more', () => {
    const got = allocate([need('near', { questions: 12 }), need('far', { questions: 3 })], 30);
    expect(got.near.questions).toBeGreaterThan(got.far.questions);
  });

  it('keeps at least one of each kind while there is any room', () => {
    const got = allocate([need('a', { questions: 30, tests: 1, newCards: 1 })], 10);
    expect(got.a.tests).toBe(1);
    expect(got.a.newCards).toBe(1);
  });

  it('only what is due when the due work alone fills the day', () => {
    const got = allocate([need('a', { questions: 5, reviews: 200 })], 30); // 60 min of reviews
    expect(got.a).toMatchObject({ questions: 0, reviews: 200 });
  });
});
