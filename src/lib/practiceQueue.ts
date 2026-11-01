// The order a student goes through questions in one sitting. The page they started from decides it
// (today's plan, the whole list, "more practice") and hands it on through the address, so "next" always
// means the next one in that order. It must not depend on scores: those change after every answer.

export interface QueueState {
  queue?: string[];
}

export const queueOf = (state: unknown): string[] | null => {
  const q = (state as QueueState | null | undefined)?.queue;
  return Array.isArray(q) && q.every((x) => typeof x === 'string') ? q : null;
};

// Only questions that still exist (the admin may have changed the subject meanwhile)
export const usableQueue = (queue: string[], existing: Set<string>) => queue.filter((id) => existing.has(id));

export function nextInQueue(queue: string[], currentId: string): string | null {
  const at = queue.indexOf(currentId);
  return at >= 0 ? queue[at + 1] ?? null : null;
}

// 1-based place of the question in the queue, or 0 when it is not in it
export const placeInQueue = (queue: string[], currentId: string) => queue.indexOf(currentId) + 1;
