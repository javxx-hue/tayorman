// AI models like to write formulas as LaTeX ("$A^{-1}$", "\sqrt{x}", "\Rightarrow"). The app shows plain text,
// so students would see the code itself. This turns the common LaTeX into ordinary symbols (A⁻¹, √x, ⇒),
// and the text it returns is left alone when it holds no LaTeX at all.

// Added to every prompt that makes text for students
export const MATH_STYLE_RULE =
  'Write every formula in plain text with Unicode symbols, NEVER LaTeX: no $ signs, no backslashes. ' +
  'Use √x, x², xⁿ, A⁻¹, a/b, ×, ·, ≤, ≥, ≠, ≈, ∑, ∫, π, λ, α, →, ⇒ and write matrices as [1 2; 3 4].';

const SUPER: Record<string, string> = {
  '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴', '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹',
  '+': '⁺', '-': '⁻', '−': '⁻', '=': '⁼', '(': '⁽', ')': '⁾', n: 'ⁿ', i: 'ⁱ', x: 'ˣ', y: 'ʸ', k: 'ᵏ', m: 'ᵐ', T: 'ᵀ',
};
const SUB: Record<string, string> = {
  '0': '₀', '1': '₁', '2': '₂', '3': '₃', '4': '₄', '5': '₅', '6': '₆', '7': '₇', '8': '₈', '9': '₉',
  '+': '₊', '-': '₋', '=': '₌', '(': '₍', ')': '₎', i: 'ᵢ', j: 'ⱼ', n: 'ₙ', m: 'ₘ', x: 'ₓ', k: 'ₖ',
};

const SYMBOLS: Record<string, string> = {
  Rightarrow: '⇒', Leftarrow: '⇐', Leftrightarrow: '⇔', rightarrow: '→', leftarrow: '←', to: '→', iff: '⇔', implies: '⇒',
  leq: '≤', le: '≤', geq: '≥', ge: '≥', neq: '≠', ne: '≠', approx: '≈', equiv: '≡', sim: '∼', propto: '∝',
  times: '×', cdot: '·', div: '÷', pm: '±', mp: '∓', infty: '∞', sum: '∑', prod: '∏', int: '∫', partial: '∂', nabla: '∇',
  in: '∈', notin: '∉', subset: '⊂', subseteq: '⊆', cup: '∪', cap: '∩', emptyset: '∅', forall: '∀', exists: '∃',
  angle: '∠', perp: '⊥', parallel: '∥', circ: '∘', ldots: '…', dots: '…', cdots: '…', degree: '°', prime: '′',
  alpha: 'α', beta: 'β', gamma: 'γ', delta: 'δ', epsilon: 'ε', varepsilon: 'ε', zeta: 'ζ', eta: 'η', theta: 'θ',
  lambda: 'λ', mu: 'μ', nu: 'ν', xi: 'ξ', pi: 'π', rho: 'ρ', sigma: 'σ', tau: 'τ', phi: 'φ', varphi: 'φ', chi: 'χ', psi: 'ψ', omega: 'ω',
  Gamma: 'Γ', Delta: 'Δ', Theta: 'Θ', Lambda: 'Λ', Xi: 'Ξ', Pi: 'Π', Sigma: 'Σ', Phi: 'Φ', Psi: 'Ψ', Omega: 'Ω',
  mathbb: '', quad: ' ', qquad: ' ', left: '', right: '', big: '', Big: '',
};
// Function names keep their spelling, just without the backslash
const BLACKBOARD: Record<string, string> = { R: 'ℝ', N: 'ℕ', Z: 'ℤ', Q: 'ℚ', C: 'ℂ' };

const hasLatex = (s: string) => /\\[A-Za-z{}()[\]\\,;! ]|\$|\^\{|_\{/.test(s);

const mapAll = (s: string, table: Record<string, string>) => {
  let out = '';
  for (const ch of s) {
    const mapped = table[ch];
    if (!mapped) return null;
    out += mapped;
  }
  return out;
};

const simple = (s: string) => /^[\p{L}\p{N}.]+$/u.test(s);
const group = (s: string) => (simple(s) ? s : `(${s})`);

function matrixText(body: string, bars: boolean): string {
  const rows = body.split(/\\\\/).map((r) => r.split('&').map((c) => c.trim()).join(' ').trim()).filter(Boolean);
  const inner = rows.join('; ');
  return bars ? `|${inner}|` : `[${inner}]`;
}

export function plainMath(input: string): string {
  if (!hasLatex(input)) return input;
  let s = input;

  // keep real braces for later (set notation), drop the math delimiters
  s = s.replace(/\\\{/g, '\u0001').replace(/\\\}/g, '\u0002');
  s = s.replace(/\$\$([^$]+)\$\$/g, '$1').replace(/\$([^$]+)\$/g, '$1').replace(/\\\(|\\\)|\\\[|\\\]/g, '');

  // matrices
  s = s.replace(/\\begin\{([pbvB]?matrix)\}([\s\S]*?)\\end\{\1\}/g, (_m, kind: string, body: string) => matrixText(body, kind === 'vmatrix'));

  // text-like wrappers keep their content
  s = s.replace(/\\(?:text|mathrm|mathbf|mathit|operatorname|boldsymbol|vec|overrightarrow|hat|bar)\s*\{([^{}]*)\}/g, '$1');
  s = s.replace(/\\mathbb\s*\{([A-Z])\}/g, (_m, c: string) => BLACKBOARD[c] ?? c);

  // fractions and roots, innermost first (a few passes handle nesting)
  for (let pass = 0; pass < 5; pass++) {
    s = s.replace(/\\[dt]?frac\s*\{([^{}]*)\}\s*\{([^{}]*)\}/g, (_m, a: string, b: string) => `${group(a.trim())}/${group(b.trim())}`);
    s = s.replace(/\\sqrt\s*\[([^\]]*)\]\s*\{([^{}]*)\}/g, (_m, n: string, x: string) => `${mapAll(n, SUPER) ?? `[${n}]`}√${group(x.trim())}`);
    s = s.replace(/\\sqrt\s*\{([^{}]*)\}/g, (_m, x: string) => `√${group(x.trim())}`);
  }

  // powers and indices: real superscript or subscript characters when every character has one
  s = s.replace(/\^\s*\{([^{}]*)\}/g, (_m, x: string) => mapAll(x.trim(), SUPER) ?? `^(${x.trim()})`);
  s = s.replace(/\^\s*([A-Za-z0-9+\-−])/g, (_m, x: string) => SUPER[x] ?? `^${x}`);
  s = s.replace(/_\s*\{([^{}]*)\}/g, (_m, x: string) => mapAll(x.trim(), SUB) ?? `_${x.trim()}`);
  s = s.replace(/_\s*([0-9ijnmxk])/g, (_m, x: string) => SUB[x] ?? `_${x}`);

  // spacing commands, symbols and function names
  s = s.replace(/\\[,;:! ]/g, ' ').replace(/\\\\/g, ' ');
  s = s.replace(/\\([A-Za-z]+)/g, (_m, name: string) => (name in SYMBOLS ? SYMBOLS[name] : name));

  // what is left of grouping braces
  s = s.replace(/[{}]/g, '').replace(/\u0001/g, '{').replace(/\u0002/g, '}');
  return s.replace(/[ \t]{2,}/g, ' ').trim();
}
