import { useEffect, useRef, useState } from 'react';
import { StudySet, Subject } from '../types';
import { Assignment, Progress, fetchAssignments, fetchServerProgress, localItem, needsSync, progressOf, pushProgress } from './assignments';
import { deliverLibrary } from './library';
import { getStudySets, getSubjects } from './storage';

// The student's assignments, their progress as the server knows it, and the sync of new progress
export function useAssignments(enabled: boolean, subjects: Subject[], sets: StudySet[]) {
  const [assignments, setAssignments] = useState<Assignment[] | null>(null);
  const [server, setServer] = useState<Record<string, Progress>>({});
  const serverRef = useRef(server);
  serverRef.current = server;

  useEffect(() => {
    if (!enabled) return;
    let stopped = false;
    Promise.all([fetchAssignments(), fetchServerProgress()])
      .then(async ([list, progress]) => {
        if (stopped) return;
        setServer(progress);
        setAssignments(list);
        // An assignment may point at content that has not reached this device yet
        if (!list.some((a) => !localItem(a, getSubjects(), getStudySets()))) return;
        await deliverLibrary();
        // Whatever still has no content was hidden or withdrawn: there is nothing to open, so do not list it
        if (!stopped) setAssignments(list.filter((a) => localItem(a, getSubjects(), getStudySets())));
      })
      .catch((e) => {
        console.warn('Assignments failed to load', e);
        if (!stopped) setAssignments([]);
      });
    return () => {
      stopped = true;
    };
    // loaded once per session; local changes are handled by the effect below
  }, [enabled]);

  // After the student studies, report what changed (a moment later, so rapid answers go out once)
  useEffect(() => {
    if (!enabled || !assignments?.length) return;
    const timer = setTimeout(async () => {
      for (const a of assignments) {
        const now = progressOf(localItem(a, subjects, sets));
        if (!needsSync(now, serverRef.current[a.id])) continue;
        if (await pushProgress(a.id, now)) setServer((s) => ({ ...s, [a.id]: now }));
      }
    }, 2000);
    return () => clearTimeout(timer);
  }, [enabled, assignments, subjects, sets]);

  return { assignments, server };
}
