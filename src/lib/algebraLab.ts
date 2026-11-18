// Exact arithmetic for the "Chiziqli algebra" missions: fractions, complex numbers, determinants, 2×2 matrices
// and the row operations of Gauss's method. Answers are compared exactly, so 1,5 and 3/2 are the same number.

export interface Frac {
  n: number;
  d: number; // always > 0, and n/d in lowest terms
}

const gcd = (a: number, b: number): number => (b === 0 ? Math.abs(a) : gcd(b, a % b));

export function frac(n: number, d = 1): Frac {
  if (d === 0) throw new Error('division by zero');
  const g = gcd(n, d) || 1;
  const s = d < 0 ? -1 : 1;
  return { n: (s * n) / g || 0, d: (s * d) / g };
}

export const add = (a: Frac, b: Frac): Frac => frac(a.n * b.d + b.n * a.d, a.d * b.d);
export const mul = (a: Frac, b: Frac): Frac => frac(a.n * b.n, a.d * b.d);
export const eq = (a: Frac, b: Frac): boolean => a.n === b.n && a.d === b.d;
export const isZero = (a: Frac): boolean => a.n === 0;
export const fracText = (a: Frac): string => (a.d === 1 ? `${a.n}` : `${a.n}/${a.d}`).replace('-', '−');

// "3/2", "-1,5", "−4", " 7 " → a fraction; anything else → null
export function parseFrac(raw: string): Frac | null {
  const t = raw.trim().replace(/[−–]/g, '-').replace(',', '.').replace(/\s+/g, '');
  let m = t.match(/^(-?\d+)\/(-?\d+)$/);
  if (m) return Number(m[2]) === 0 ? null : frac(Number(m[1]), Number(m[2]));
  m = t.match(/^(-?)(\d+)(?:\.(\d+))?$/);
  if (!m) return null;
  const decimals = m[3] ?? '';
  const n = Number(`${m[2]}${decimals}`) * (m[1] ? -1 : 1);
  return frac(n, 10 ** decimals.length);
}

// ---------------------------------------------------------------- complex numbers [re, im]
export type Complex = [number, number];
export const cmul = (a: Complex, b: Complex): Complex => [a[0] * b[0] - a[1] * b[1], a[0] * b[1] + a[1] * b[0]];
export const cabs = (a: Complex): number => Math.hypot(a[0], a[1]);

// ---------------------------------------------------------------- determinants and Cramer's rule
export function det(m: number[][]): number {
  if (m.length === 1) return m[0][0];
  if (m.length === 2) return m[0][0] * m[1][1] - m[0][1] * m[1][0];
  // expansion along the first row
  return m[0].reduce((sum, a, j) => sum + (j % 2 ? -1 : 1) * a * det(m.slice(1).map((row) => row.filter((_, k) => k !== j))), 0);
}

export const withColumn = (m: number[][], col: number, values: number[]): number[][] => m.map((row, i) => row.map((a, j) => (j === col ? values[i] : a)));

// ---------------------------------------------------------------- 2×2 matrices
export type M2 = [[number, number], [number, number]];

export const mat2mul = (a: M2, b: M2): M2 => [
  [a[0][0] * b[0][0] + a[0][1] * b[1][0], a[0][0] * b[0][1] + a[0][1] * b[1][1]],
  [a[1][0] * b[0][0] + a[1][1] * b[1][0], a[1][0] * b[0][1] + a[1][1] * b[1][1]],
];

export const apply2 = (m: M2, p: [number, number]): [number, number] => [m[0][0] * p[0] + m[0][1] * p[1], m[1][0] * p[0] + m[1][1] * p[1]];

export function inverse2(m: M2): Frac[][] | null {
  const d = det(m);
  if (d === 0) return null;
  return [
    [frac(m[1][1], d), frac(-m[0][1], d)],
    [frac(-m[1][0], d), frac(m[0][0], d)],
  ];
}

// ---------------------------------------------------------------- Gauss: row operations on an augmented matrix
export type FMatrix = Frac[][];

export const toFracs = (m: number[][]): FMatrix => m.map((row) => row.map((a) => frac(a)));

// Ri ← Ri + k·Rj
export const rowAdd = (m: FMatrix, i: number, j: number, k: Frac): FMatrix => m.map((row, r) => (r === i ? row.map((a, c) => add(a, mul(k, m[j][c]))) : row));
export const rowSwap = (m: FMatrix, i: number, j: number): FMatrix => m.map((row, r) => (r === i ? m[j] : r === j ? m[i] : row));
export const rowScale = (m: FMatrix, i: number, k: Frac): FMatrix => m.map((row, r) => (r === i ? row.map((a) => mul(k, a)) : row));

// Upper triangular with non-zero pivots: ready for back substitution
export const isEchelon = (m: FMatrix): boolean => m.every((row, r) => !isZero(row[r]) && row.slice(0, r).every(isZero));

// ---------------------------------------------------------------- letters as numbers: A=1 … Z=26
export const letterOf = (n: number): string => (n >= 1 && n <= 26 ? String.fromCharCode(64 + n) : '?');
export const numberOf = (ch: string): number => ch.toUpperCase().charCodeAt(0) - 64;
