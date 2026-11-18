import { describe, expect, it } from 'vitest';
import { cmul, det, eq, frac, fracText, inverse2, isEchelon, letterOf, mat2mul, parseFrac, rowAdd, rowScale, rowSwap, toFracs } from './algebraLab';
import { ALGEBRA_MISSIONS, CODED, CRAMER, GAUSS, GAUSS_ANSWER, KEY, SECRET, STRETCH, TURN } from './algebraMissions';

const F = (raw: string) => parseFrac(raw)!;

describe('numbers typed by the student', () => {
  it('reads integers, decimals with a comma and fractions exactly', () => {
    expect(eq(F('3/2'), F('1,5'))).toBe(true);
    expect(eq(F('-6/4'), frac(-3, 2))).toBe(true);
    expect(eq(F('−4'), frac(-4))).toBe(true);
    expect(eq(F(' 7 '), frac(7))).toBe(true);
    expect(parseFrac('abc')).toBeNull();
    expect(parseFrac('1/0')).toBeNull();
    expect(parseFrac('')).toBeNull();
    expect(fracText(frac(-3, 2))).toBe('−3/2');
    expect(fracText(frac(0, 5))).toBe('0');
  });
});

describe('the maths', () => {
  it('multiplies complex numbers and matrices, finds determinants and inverses', () => {
    expect(cmul([3, 4], [0, 1])).toEqual([-4, 3]);
    expect(cmul([3, 4], [1, 1])).toEqual([-1, 7]);
    expect(det([[1, 2, -1], [1, -2, 3], [3, 0, 4]])).toBe(-4); // q-algebra-089
    expect(det([[2, 3, 0], [4, 7, 0], [-8, 2, 1]])).toBe(2); // a triangle of blocks: 2·7 − 3·4
    expect(mat2mul(TURN, STRETCH)).not.toEqual(mat2mul(STRETCH, TURN));
    const inv = inverse2(KEY)!;
    expect(inv.flat().map(fracText)).toEqual(['1', '−1', '−1', '2']);
    expect(inverse2([[1, 2], [2, 4]])).toBeNull();
  });
});

describe('the missions', () => {
  it('Cramer has a unique whole-number answer', () => {
    expect(det(CRAMER.a)).not.toBe(0);
    const [x, y, z] = ALGEBRA_MISSIONS[1].steps[2].answer;
    expect([x, y, z].every((f) => f.d === 1 && f.n > 0)).toBe(true);
    expect(CRAMER.a.map((row) => row[0] * x.n + row[1] * y.n + row[2] * z.n)).toEqual(CRAMER.b);
  });

  it('the coded command decodes back to the word', () => {
    const inv = inverse2(KEY)!.map((r) => r.map((f) => f.n / f.d));
    const word = CODED.map(([a, b]) => letterOf(inv[0][0] * a + inv[0][1] * b) + letterOf(inv[1][0] * a + inv[1][1] * b)).join('');
    expect(word).toBe(SECRET);
    expect(CODED[0]).toEqual([43, 32]);
  });

  it("Gauss: the hint's row operations reach the triangle and the answer fits", () => {
    let m = toFracs(GAUSS);
    expect(isEchelon(m)).toBe(false);
    m = rowAdd(m, 1, 0, frac(-2));
    m = rowAdd(m, 2, 0, frac(-1));
    expect(isEchelon(m)).toBe(false);
    m = rowAdd(m, 2, 1, frac(2));
    expect(isEchelon(m)).toBe(true);
    expect(GAUSS.every((row) => row[0] * GAUSS_ANSWER[0].n + row[1] * GAUSS_ANSWER[1].n + row[2] * GAUSS_ANSWER[2].n === row[3])).toBe(true);
    // swapping and scaling keep the system, and a zero pivot is not a triangle
    expect(isEchelon(rowSwap(m, 0, 2))).toBe(false);
    expect(rowScale(m, 2, frac(-1))[2].map(fracText)).toEqual(['0', '0', '1', '3']);
  });

  it('every step answer is consistent and every mission points at real exam questions', () => {
    expect(ALGEBRA_MISSIONS.map((m) => m.id)).toEqual([1, 2, 3, 4, 5]);
    for (const m of ALGEBRA_MISSIONS) {
      expect(m.questions.every((q) => /^q-algebra-\d{3}$/.test(q))).toBe(true);
      for (const s of m.steps) expect(s.answer).toHaveLength(s.fields.length);
    }
    expect(ALGEBRA_MISSIONS[0].steps[0].answer[0]).toEqual(frac(5));
  });
});
