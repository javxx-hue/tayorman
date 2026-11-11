import { describe, it, expect } from 'vitest';
import { clozeScore, makeCloze, normalize, sameAnswer } from './cloze';

const summary =
  "TCP ulanishni uch tomonlama qo'l siqish bilan o'rnatadi: SYN, SYN-ACK va ACK. U ishonchli yetkazishni ta'minlaydi, UDP esa tezroq, lekin kafolatsiz.";
const keyPoints = ["TCP ulanishga yo'naltirilgan", "Uch tomonlama qo'l siqish", 'UDP tezroq'];

describe('makeCloze', () => {
  it('hides key terms (abbreviations first) and keeps the text around them', () => {
    const c = makeCloze(summary, keyPoints, 3)!;
    expect(c.answers.length).toBe(3);
    expect(c.answers).toContain('TCP');
    const rebuilt = c.parts.map((p) => (typeof p === 'string' ? p : c.answers[p.blank])).join('');
    expect(rebuilt).toBe(summary);
  });

  it('never hides common words', () => {
    const c = makeCloze('Bu va bilan uchun esa ham bir qilib.', [], 4);
    expect(c).toBeNull();
  });

  it('hides each word only once, in reading order', () => {
    const c = makeCloze('OSPF va OSPF yana OSPF. BGP esa boshqa.', [], 4)!;
    expect(c.answers).toEqual(['OSPF', 'BGP']);
  });
});

describe('checking answers', () => {
  it('ignores case, apostrophe style and surrounding punctuation', () => {
    expect(sameAnswer(' tcp ', 'TCP')).toBe(true);
    expect(sameAnswer("o‘tkazuvchanlik", "o'tkazuvchanlik")).toBe(true);
    expect(sameAnswer('UDP', 'TCP')).toBe(false);
    expect(sameAnswer('', '')).toBe(false);
    expect(normalize('«SYN-ACK».')).toBe('syn-ack');
  });

  it('a blank exercise is worth at most 70', () => {
    expect(clozeScore(4, 4)).toBe(70);
    expect(clozeScore(2, 4)).toBe(35);
    expect(clozeScore(0, 0)).toBe(0);
  });
});
