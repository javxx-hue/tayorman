import { describe, it, expect, vi, beforeEach } from 'vitest';

const invoke = vi.fn();
vi.mock('./supabase', () => ({ supabase: { functions: { invoke: (...a: unknown[]) => invoke(...a) } } }));

import { generateStudySet, GenerationError } from './ai';

const reply = (payload: unknown) =>
  invoke.mockResolvedValue({ data: { text: typeof payload === 'string' ? payload : JSON.stringify(payload) }, error: null });

const base = { rawContent: 'Fotosintez xloroplastlarda boradi.', sourceType: 'text' as const, title: 'Biologiya' };

describe('generateStudySet (through the server proxy)', () => {
  beforeEach(() => invoke.mockReset());

  it('rejects empty source text before calling the server', async () => {
    await expect(generateStudySet({ ...base, rawContent: '   ', targetType: 'quiz' })).rejects.toMatchObject({ code: 'EMPTY_SOURCE' });
    expect(invoke).not.toHaveBeenCalled();
  });

  it('calls the gemini function with the prompt parts', async () => {
    reply({ questions: [{ question: 'Qayerda?', options: ['Xloroplast', 'Yadro'], correctAnswer: 0 }] });
    await generateStudySet({ ...base, targetType: 'quiz' });
    const [name, opts] = invoke.mock.calls[0];
    expect(name).toBe('gemini');
    expect(opts.body.json).toBe(true);
    expect(opts.body.parts[0].text).toContain('Fotosintez');
  });

  it('keeps valid questions and drops ones with an out-of-range answer', async () => {
    reply({
      title: 'Fotosintez',
      questions: [
        { question: 'Qayerda boradi?', options: ['Xloroplast', 'Yadro', 'Ribosoma', 'Lizosoma'], correctAnswer: 0, explanation: '1-sahifa', source: 'Sahifa 1' },
        { question: 'Buzuq', options: ['A', 'B'], correctAnswer: 5 },
        { question: '', options: ['A', 'B'], correctAnswer: 0 },
      ],
    });
    const set = await generateStudySet({ ...base, targetType: 'quiz' });
    expect(set.title).toBe('Fotosintez');
    expect(set.questions).toHaveLength(1);
    expect(set.questions![0].source).toBe('Sahifa 1');
  });

  it('errors when no question survives validation', async () => {
    reply({ questions: [{ question: 'Buzuq', options: ['A'], correctAnswer: 3 }] });
    await expect(generateStudySet({ ...base, targetType: 'quiz' })).rejects.toBeInstanceOf(GenerationError);
  });

  it('accepts JSON wrapped in code fences and rejects non-JSON', async () => {
    reply('```json\n{"flashcards":[{"front":"A","back":"B"}]}\n```');
    expect((await generateStudySet({ ...base, targetType: 'flashcards' })).flashcards).toHaveLength(1);
    reply('not json at all');
    await expect(generateStudySet({ ...base, targetType: 'flashcards' })).rejects.toMatchObject({ code: 'BAD_RESPONSE' });
  });

  it('maps HTTP 429 to LIMIT_REACHED and other failures to API_ERROR', async () => {
    invoke.mockResolvedValue({ data: null, error: { message: 'x', context: { status: 429 } } });
    await expect(generateStudySet({ ...base, targetType: 'flashcards' })).rejects.toMatchObject({ code: 'LIMIT_REACHED' });
    invoke.mockResolvedValue({ data: null, error: { message: 'boom', context: { status: 502 } } });
    await expect(generateStudySet({ ...base, targetType: 'flashcards' })).rejects.toMatchObject({ code: 'API_ERROR' });
  });
});
