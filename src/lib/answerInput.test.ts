import { describe, it, expect, vi } from 'vitest';

vi.mock('./supabase', () => ({ supabase: null }));

import { audioPrompt, cleanTranscript, fitWithin, handwritingPrompt, isGradable } from './answerInput';
import { encodeWav, WAV_RATE } from './audioWav';

describe('cleanTranscript', () => {
  it('turns silence markers into nothing, so an empty recording is not an answer', () => {
    for (const marker of ['<noise>', '[silence]', '[Inaudible]', '<music>', '  <no speech>  ']) expect(cleanTranscript(marker)).toBe('');
  });

  it('keeps what was said and tidies the spacing', () => {
    expect(cleanTranscript('  Bozor   iqtisodiyoti\n\n\n\nbu talab va taklif  ')).toBe('Bozor iqtisodiyoti\n\nbu talab va taklif');
  });

  it('keeps square brackets the student really wrote', () => {
    expect(cleanTranscript('x ∈ [0, 1] bo\'lsa')).toBe("x ∈ [0, 1] bo'lsa");
  });

  it('removes a code fence a model sometimes wraps around the text', () => {
    expect(cleanTranscript('```\nMatritsa nima\n```')).toBe('Matritsa nima');
  });

  it('turns LaTeX into plain symbols like everything else the AI writes', () => {
    expect(cleanTranscript('$A^{-1}$ ni topamiz')).toBe('A⁻¹ ni topamiz');
  });
});

describe('prompts', () => {
  it('ask for exactly what the student said or wrote, in their language, without correcting', () => {
    expect(audioPrompt('uz')).toMatch(/Uzbek/);
    expect(audioPrompt('ru')).toMatch(/Russian/);
    for (const p of [audioPrompt('uz'), handwritingPrompt('uz')]) {
      expect(p).toMatch(/Do not correct/);
      expect(p).toMatch(/output nothing/);
      expect(p).toMatch(/NEVER LaTeX/);
    }
  });
});

describe('fitWithin', () => {
  it('shrinks a big photo to the limit and keeps its proportions', () => {
    expect(fitWithin(4000, 3000, 1600)).toEqual({ width: 1600, height: 1200 });
    expect(fitWithin(3000, 4000, 1600)).toEqual({ width: 1200, height: 1600 });
  });
  it('never enlarges a small one', () => {
    expect(fitWithin(800, 600, 1600)).toEqual({ width: 800, height: 600 });
  });
});

describe('encodeWav', () => {
  const text = (b: Uint8Array, at: number, n: number) => String.fromCharCode(...b.slice(at, at + n));

  it('writes a valid 16 kHz mono 16-bit file header and the samples', () => {
    const wav = encodeWav(new Float32Array([0, 0.5, -0.5, 1, -1]));
    const view = new DataView(wav.buffer);
    expect(text(wav, 0, 4)).toBe('RIFF');
    expect(text(wav, 8, 8)).toBe('WAVEfmt ');
    expect(view.getUint16(20, true)).toBe(1); // PCM
    expect(view.getUint16(22, true)).toBe(1); // mono
    expect(view.getUint32(24, true)).toBe(WAV_RATE);
    expect(view.getUint16(34, true)).toBe(16);
    expect(text(wav, 36, 4)).toBe('data');
    expect(view.getUint32(40, true)).toBe(10); // 5 samples x 2 bytes
    expect(wav.length).toBe(44 + 10);
    expect([0, 1, 2, 3, 4].map((i) => view.getInt16(44 + i * 2, true))).toEqual([0, 16384, -16383, 32767, -32767]);
  });

  it('clips what is out of range instead of wrapping around', () => {
    const view = new DataView(encodeWav(new Float32Array([2, -2])).buffer);
    expect([view.getInt16(44, true), view.getInt16(46, true)]).toEqual([32767, -32767]);
  });

  it('two minutes of speech stay well inside the request size limit', () => {
    const bytes = 44 + 120 * WAV_RATE * 2;
    expect(Math.ceil((bytes * 4) / 3)).toBeLessThan(8 * 1024 * 1024);
  });
});

describe('isGradable', () => {
  it('needs a few real words, not one run of random letters', () => {
    expect(isGradable('bhbdhfesfggf')).toBe(false);
    expect(isGradable('  hygyuyugyugtygu  ')).toBe(false);
    expect(isGradable('LAN lokal tarmoq')).toBe(true);
    expect(isGradable('a^2 + b^2 = c^2')).toBe(true);
    expect(isGradable('— , .')).toBe(false);
  });
});
