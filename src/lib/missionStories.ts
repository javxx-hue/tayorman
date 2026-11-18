// Which subjects have missions and how far the student got. Kept small on purpose: the subject page imports it,
// the stories themselves load only with the missions page.
import { supabase } from './supabase';

export type StoryId = 'baza' | 'tarmoq' | 'elektronika' | 'algebra';

export const MISSION_XP = 40; // what the server gives for a mission (migration 0016)

export interface StoryRef {
  id: StoryId;
  subject: string; // the library subject (librarySourceId) the story belongs to
  count: number; // missions in the story
}

export const STORIES: StoryRef[] = [
  { id: 'baza', subject: 'sub-lib-baza', count: 5 },
  { id: 'tarmoq', subject: 'sub-lib-tarmoq', count: 5 },
  { id: 'elektronika', subject: 'sub-lib-elektronika', count: 5 },
  { id: 'algebra', subject: 'sub-lib-algebra', count: 5 },
];

export const storyOf = (librarySourceId: string | undefined): StoryRef | undefined => STORIES.find((s) => s.subject === librarySourceId);

// ---------------------------------------------------------------- progress on this phone
const progressKey = (story: StoryId) => `tayyorman_missions_${story}`;

export function doneMissions(story: StoryId): number[] {
  try {
    const v = JSON.parse(localStorage.getItem(progressKey(story)) ?? '[]') as unknown;
    return Array.isArray(v) ? v.filter((x): x is number => typeof x === 'number') : [];
  } catch {
    return [];
  }
}

function markMissionDone(story: StoryId, id: number): void {
  const done = doneMissions(story);
  if (done.includes(id)) return;
  try {
    localStorage.setItem(progressKey(story), JSON.stringify([...done, id]));
  } catch {
    /* blocked storage: the mission simply stays open to play again */
  }
}

// A mission opens once the one before it is done
export const missionOpen = (done: number[], id: number): boolean => id === 1 || done.includes(id - 1);

// ---------------------------------------------------------------- the same progress on every device
// The server keeps one XP row per finished mission ("baza:3"); those rows are the progress too.

export function progressOfRefs(refs: string[]): Partial<Record<StoryId, number[]>> {
  const out: Partial<Record<StoryId, number[]>> = {};
  for (const ref of refs) {
    const [story, n] = ref.split(':');
    const s = STORIES.find((x) => x.id === story);
    const id = Number(n);
    if (s && Number.isInteger(id) && id >= 1 && id <= s.count) out[s.id] = [...(out[s.id] ?? []), id];
  }
  return out;
}

const submit = async (story: StoryId, id: number): Promise<number> => {
  if (!supabase) return 0;
  const { data, error } = await supabase.rpc('submit_mission', { p_story: story, p_mission: id });
  return error ? 0 : Number(data ?? 0);
};

// Marks a mission done here and on the server; returns the XP it earned (0 offline or when counted before)
export async function saveMission(story: StoryId, id: number): Promise<number> {
  markMissionDone(story, id);
  try {
    return await submit(story, id);
  } catch {
    return 0; // offline: the next sync sends it
  }
}

// Brings missions finished on another device to this one, and sends up the ones only this one knows
export async function syncMissions(): Promise<void> {
  if (!supabase) return;
  try {
    const { data, error } = await supabase.from('xp_events').select('ref').eq('kind', 'mission');
    if (error || !data) return;
    const server = progressOfRefs(data.map((r) => String(r.ref)));
    for (const s of STORIES) {
      const there = server[s.id] ?? [];
      for (const id of there) markMissionDone(s.id, id);
      // in story order: the server accepts a mission only after the one before it
      for (const id of doneMissions(s.id).sort((a, b) => a - b)) if (!there.includes(id)) await submit(s.id, id);
    }
  } catch {
    /* offline: progress stays on this phone until the next time */
  }
}

// Chips put a piece where the cursor was (or at the end) with a space around it; a comma, a closing bracket
// and a semicolon stick to the word before them
const TIGHT = [',', ')', ';'];
export function insertPiece(text: string, caret: { start: number; end: number } | null, piece: string): { text: string; caret: number } {
  const at = Math.min(caret?.start ?? text.length, text.length);
  const after = text.slice(Math.min(Math.max(caret?.end ?? at, at), text.length));
  const tight = TIGHT.includes(piece);
  const before = tight ? text.slice(0, at).replace(/\s+$/, '') : text.slice(0, at);
  const left = before && !tight && !/\s$/.test(before) ? ' ' : '';
  const head = `${before}${left}${piece} `;
  return { text: head + after.replace(/^\s+/, ''), caret: head.length };
}
