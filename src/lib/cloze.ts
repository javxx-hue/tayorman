// Fill-in-the-blank from a model answer: a few key terms of the answer are hidden and the student types them.
// The terms are picked without AI: abbreviations and numbers, words the answer's key points repeat, longer words.
// Common words are never hidden.

export type ClozePart = string | { blank: number };
export interface Cloze {
  parts: ClozePart[];
  answers: string[]; // in the order the blanks appear
}

const STOP = new Set(
  [
    'va', 'bilan', 'uchun', 'bu', 'bir', 'har', 'qilib', 'orqali', 'ham', 'esa', 'emas', 'yoki', 'kabi', 'shuning', 'natijada',
    'masalan', 'hisoblanadi', "bo'ladi", 'qiladi', 'beradi', 'mumkin', 'kerak', 'agar', 'lekin', 'ammo', 'shu', 'u', 'ular',
    'uning', 'ularning', 'bo\'lib', 'qilish', 'qilinadi', 'etiladi', 'etadi', 'olinadi', 'keyin', 'oldin', 'barcha', 'ko\'p',
    'kam', 'eng', 'juda', 'yana', 'faqat', 'hamda', 'ya\'ni', 'deb', 'degan', 'bor', 'yo\'q', 'emas', 'asosiy', 'muhim',
    "bo'yicha", 'tufayli', 'sababli', 'yordamida', 'asosida', "o'rtasida", 'ichida', 'ustida', 'qanday', 'nima', 'qaysi',
    'holda', 'holatda', 'yaratgan', 'qilgan', "bo'lgan", 'kelgan', 'turli', 'boshqa', 'yangi', 'katta', 'kichik',
    'the', 'and', 'for', 'with',
  ].map((w) => normalize(w))
);

// Lower case, one kind of apostrophe, no surrounding punctuation
export function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/[ʻʼ’‘`´]/g, "'")
    .replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '')
    .trim();
}

export const sameAnswer = (typed: string, answer: string): boolean => normalize(typed) === normalize(answer) && normalize(answer) !== '';

const TOKEN = /[\p{L}\p{N}][\p{L}\p{N}'ʻʼ’‘\-.]*[\p{L}\p{N}]|[\p{L}\p{N}]/gu;

function scoreOf(word: string, keyText: string): number {
  const n = normalize(word);
  if (n.length < 2 || STOP.has(n)) return 0;
  if (/[₀-₉⁰-⁹√π²³]/.test(word)) return 0; // a formula cannot be typed back on a phone keyboard
  let score = 0;
  if (/[A-Z].*[A-Z0-9]/.test(word) && word.length <= 12) score += 3; // TCP, IPv4, OSPF, SQL
  if (/\d/.test(word) && n.length >= 2) score += 2; // 1 Tbit/s, 802.11, 0.1
  if (n.length >= 4 && keyText.includes(n)) score += 2;
  if (n.length >= 7) score += 1;
  // an inflected word (manbaga, shaklda) is hard to type back exactly
  if (!/[A-Z0-9]/.test(word) && /(ga|da|dan|ni|ning|lar|lari|larni|larga|larda)$/.test(n)) score -= 1;
  return score;
}

export function makeCloze(summary: string, keyPoints: string[], max = 4): Cloze | null {
  const keyText = normalize(keyPoints.join(' '));
  const tokens = [...summary.matchAll(TOKEN)].map((m) => ({ word: m[0], at: m.index ?? 0 }));
  // the best distinct words, each hidden only where it first appears
  const best = new Map<string, { word: string; at: number; score: number }>();
  for (const t of tokens) {
    const n = normalize(t.word);
    if (best.has(n)) continue;
    const score = scoreOf(t.word, keyText);
    if (score >= 2) best.set(n, { ...t, score });
  }
  // strong terms first; weaker ones only fill in when an answer has fewer than two strong ones
  const ranked = [...best.values()].sort((a, b) => b.score - a.score || a.at - b.at);
  const strong = ranked.filter((c) => c.score >= 3);
  const chosen = (strong.length >= 2 ? strong : ranked).slice(0, max).sort((a, b) => a.at - b.at);
  if (chosen.length === 0) return null;

  const parts: ClozePart[] = [];
  let pos = 0;
  chosen.forEach((c, i) => {
    if (c.at > pos) parts.push(summary.slice(pos, c.at));
    parts.push({ blank: i });
    pos = c.at + c.word.length;
  });
  if (pos < summary.length) parts.push(summary.slice(pos));
  return { parts, answers: chosen.map((c) => c.word) };
}

// A blank exercise counts as practice, but it is easier than writing the answer: at most 70 (never "ready" alone)
export const clozeScore = (right: number, total: number): number => (total ? Math.round((right / total) * 70) : 0);
