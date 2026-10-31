// Anonymous product events for the admin dashboard (funnel and daily active users).
// Never carries content: just who did what kind of step, and when.
import { supabase } from './supabase';

export type EventType = 'app_open' | 'subject_created' | 'questions_added' | 'first_answer';

const sentThisSession = new Set<EventType>();

export function track(type: EventType, opts: { oncePerSession?: boolean } = {}): void {
  if (!supabase) return;
  if (opts.oncePerSession) {
    if (sentThisSession.has(type)) return;
    sentThisSession.add(type);
  }
  const client = supabase;
  client.auth
    .getSession()
    .then(({ data }) => (data.session ? client.from('events').insert({ type }) : undefined))
    .catch(() => {
      /* analytics must never break the app */
    });
}
