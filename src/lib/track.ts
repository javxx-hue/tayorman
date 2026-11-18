// Anonymous product events for the admin dashboard (funnel and daily active users).
// Never carries content: just who did what kind of step, and when.
import { supabase } from './supabase';

// mission_* : the SQL missions (opened the list, finished mission N)
export type EventType = 'app_open' | 'got_content' | 'first_answer' | 'mission_open' | `mission_done_${number}`;

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
