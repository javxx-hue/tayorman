import { describe, it, expect } from 'vitest';
import { buildPrompt, parseQuestions } from './sourceQuestions';

describe('parseQuestions', () => {
  it('keeps real questions, drops numbering and bullets', () => {
    const raw = JSON.stringify({ questions: ['1. Bozor iqtisodiyoti nima?', '- Talab qonunini tushuntiring', '  3) Taklif nima?  '] });
    expect(parseQuestions(raw)).toEqual(['Bozor iqtisodiyoti nima?', 'Talab qonunini tushuntiring', 'Taklif nima?']);
  });

  it('drops duplicates, too short and too long items, and non-strings', () => {
    const raw = JSON.stringify({ questions: ['Chiziqli algebra nima?', 'chiziqli algebra nima?', 'a?', 'x'.repeat(501), 42, null, 'Matritsa nima?'] });
    expect(parseQuestions(raw)).toEqual(['Chiziqli algebra nima?', 'Matritsa nima?']);
  });

  it('gives an empty list when there is nothing usable', () => {
    expect(parseQuestions(JSON.stringify({ questions: [] }))).toEqual([]);
    expect(parseQuestions(JSON.stringify({ other: 1 }))).toEqual([]);
    expect(parseQuestions('```json\n{"questions": ["Qanday savol bu?"]}\n```')).toEqual(['Qanday savol bu?']);
  });
});

describe('buildPrompt', () => {
  it('extraction forbids inventing; generation asks for the count and language', () => {
    expect(buildPrompt('M', { mode: 'extract', count: 10, language: 'uz' })).toMatch(/exactly as written/);
    expect(buildPrompt('M', { mode: 'extract', count: 10, language: 'uz' })).toMatch(/Do not invent/);
    const gen = buildPrompt('M', { mode: 'generate', count: 12, language: 'ru' });
    expect(gen).toContain('Write 12 exam questions');
    expect(gen).toContain('Russian');
  });
});
