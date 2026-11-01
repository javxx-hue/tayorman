import { describe, it, expect } from 'vitest';
import { plainMath } from './mathText';

describe('plainMath', () => {
  it('turns the example from a real generated test into readable text', () => {
    const raw = "$AX = B$ tenglamaning chap tarafini $A^{-1}$ ga ko'paytirsak: $A^{-1}AX = A^{-1}B \\Rightarrow EX = A^{-1}B \\Rightarrow X = A^{-1}B$ ";
    expect(plainMath(raw)).toBe("AX = B tenglamaning chap tarafini A⁻¹ ga ko'paytirsak: A⁻¹AX = A⁻¹B ⇒ EX = A⁻¹B ⇒ X = A⁻¹B");
    expect(plainMath('X = A^{-1} B')).toBe('X = A⁻¹ B'); // the options of that question
  });

  it('roots and fractions', () => {
    expect(plainMath('$\\sqrt{x}$')).toBe('√x');
    expect(plainMath('$\\sqrt{x^2 + 1}$')).toBe('√(x² + 1)');
    expect(plainMath('$\\sqrt[3]{8}$')).toBe('³√8');
    expect(plainMath('$\\frac{a}{b}$')).toBe('a/b');
    expect(plainMath('$\\frac{x+1}{2}$')).toBe('(x+1)/2');
    expect(plainMath('$\\frac{1}{\\sqrt{2}}$')).toBe('1/(√2)');
  });

  it('powers and indices', () => {
    expect(plainMath('$x^2 + y^{10}$')).toBe('x² + y¹⁰');
    expect(plainMath('$a_{ij}$ va $a_1$')).toBe('aᵢⱼ va a₁');
    expect(plainMath('$A^T$')).toBe('Aᵀ');
    expect(plainMath('$e^{-x}$')).toBe('e⁻ˣ');
    expect(plainMath('$x^{a+b}$')).toBe('x^(a+b)'); // letters without a superscript form stay readable
  });

  it('symbols and Greek letters', () => {
    expect(plainMath('$\\lambda \\neq 0, \\pi \\approx 3.14, a \\leq b \\times c$')).toBe('λ ≠ 0, π ≈ 3.14, a ≤ b × c');
    expect(plainMath('$\\sum_{i=1}^{n} a_i$')).toBe('∑ᵢ₌₁ⁿ aᵢ');
    expect(plainMath('$\\det A \\neq 0$')).toBe('det A ≠ 0');
    expect(plainMath('$\\mathbb{R}^n$')).toBe('ℝⁿ');
  });

  it('matrices', () => {
    expect(plainMath('$\\begin{pmatrix} 1 & 2 \\\\ 3 & 4 \\end{pmatrix}$')).toBe('[1 2; 3 4]');
    expect(plainMath('$\\begin{vmatrix} a & b \\\\ c & d \\end{vmatrix}$')).toBe('|a b; c d|');
  });

  it('keeps real braces and text', () => {
    expect(plainMath('$\\{1, 2, 3\\}$')).toBe('{1, 2, 3}');
    expect(plainMath('$\\text{agar } x > 0$')).toBe('agar x > 0');
  });

  it('leaves ordinary text alone, exactly', () => {
    for (const plain of ['Matritsa nima?', 'X = A⁻¹ B', 'Narx 5$ edi', '{1, 2, 3} to\'plam', 'a^b va c_d', 'Savol: 2 + 2 = ?']) expect(plainMath(plain)).toBe(plain);
  });

  it('is idempotent', () => {
    const once = plainMath('$\\frac{\\sqrt{x}}{2} \\Rightarrow A^{-1}$');
    expect(plainMath(once)).toBe(once);
  });
});
