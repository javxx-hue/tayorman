import { describe, it, expect } from 'vitest';
import { createHmac } from 'node:crypto';
import { verifyInitData } from '../../supabase/functions/_shared/initData';
import { stripProgress } from './library';
import { StudySet, Subject } from '../types';

const BOT_TOKEN = '123456:TEST-token';

// Builds initData exactly the way Telegram signs it
function sign(fields: Record<string, string>, token = BOT_TOKEN): string {
  const dataCheckString = Object.entries(fields)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join('\n');
  const secret = createHmac('sha256', 'WebAppData').update(token).digest();
  const hash = createHmac('sha256', secret).update(dataCheckString).digest('hex');
  return new URLSearchParams({ ...fields, hash }).toString();
}

const now = () => String(Math.floor(Date.now() / 1000));
const user = JSON.stringify({ id: 42, first_name: 'Ali', language_code: 'uz' });

describe('verifyInitData', () => {
  it('accepts correctly signed data and returns the user and start param', async () => {
    const r = await verifyInitData(sign({ auth_date: now(), user, start_param: 'c_abcdef123456' }), BOT_TOKEN);
    expect(r?.user.id).toBe(42);
    expect(r?.startParam).toBe('c_abcdef123456');
  });

  it('rejects data signed with another bot token', async () => {
    expect(await verifyInitData(sign({ auth_date: now(), user }, '999:OTHER'), BOT_TOKEN)).toBeNull();
  });

  it('rejects tampered fields', async () => {
    const tampered = sign({ auth_date: now(), user }).replace('Ali', 'Eve').replace('%22id%22%3A42', '%22id%22%3A1');
    expect(await verifyInitData(tampered, BOT_TOKEN)).toBeNull();
  });

  it('rejects missing hash and stale auth_date', async () => {
    expect(await verifyInitData(`auth_date=${now()}&user=${encodeURIComponent(user)}`, BOT_TOKEN)).toBeNull();
    const old = String(Math.floor(Date.now() / 1000) - 3 * 24 * 3600);
    expect(await verifyInitData(sign({ auth_date: old, user }), BOT_TOKEN)).toBeNull();
  });
});

describe('stripProgress', () => {
  it('removes attempts from a subject but keeps questions and answers', () => {
    const subject = {
      id: 's', name: 'Fan', examDate: '2026-12-01', examFormat: 'oral', createdAt: 0, updatedAt: 0, materials: [],
      questions: [{ id: 'q', text: 'Savol?', modelAnswer: { summary: 'x', keyPoints: [], sources: [] }, attempts: [{ at: 1, answer: 'a', score: 90, feedback: '', missing: [] }] }],
    } as Subject;
    const out = stripProgress(subject, 'subject') as Subject;
    expect(out.questions[0].attempts).toEqual([]);
    expect(out.questions[0].modelAnswer?.summary).toBe('x');
    expect(subject.questions[0].attempts).toHaveLength(1); // original untouched
  });

  it('removes card schedule and score from a set', () => {
    const set = {
      id: 'x', title: 'Kartalar', type: 'flashcards', lastScore: 80,
      flashcards: [{ id: 'c', front: 'a', back: 'b', rating: 'good', srs: { due: 'd', state: 2 } }],
    } as unknown as StudySet;
    const out = stripProgress(set, 'set') as StudySet;
    expect(out.lastScore).toBeUndefined();
    expect(out.flashcards![0]).toEqual({ id: 'c', front: 'a', back: 'b' });
  });
});
