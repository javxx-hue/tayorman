// Which subjects have missions and how far the student got. Kept small on purpose: the subject page imports it,
// the stories themselves load only with the missions page.

export type StoryId = 'baza' | 'tarmoq';

export interface StoryRef {
  id: StoryId;
  subject: string; // the library subject (librarySourceId) the story belongs to
  count: number; // missions in the story
}

export const STORIES: StoryRef[] = [
  { id: 'baza', subject: 'sub-lib-baza', count: 5 },
  { id: 'tarmoq', subject: 'sub-lib-tarmoq', count: 5 },
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

export function markMissionDone(story: StoryId, id: number): void {
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
