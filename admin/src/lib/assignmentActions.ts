// Giving a library item to students as an assignment: the one place that does it, for the Topshiriqlar page
// and for the "also give as assignment" option when a test or subject is saved.
import { supabase } from './supabase';
import { Audience, tashkentClock, tashkentToIso } from './audience';

export interface AssignDraft {
  on: boolean;
  note: string;
  due: string; // "2026-11-05T18:30" from the form, Tashkent time; '' = no deadline
  notify: boolean;
}

export const emptyAssign: AssignDraft = { on: false, note: '', due: '', notify: true };

export type DueCheck = { ok: true; iso: string | null } | { ok: false; error: string };

// A deadline must be a real moment in the future (Tashkent time); none is fine
export function checkDue(due: string, now = Date.now()): DueCheck {
  if (!due) return { ok: true, iso: null };
  const iso = tashkentToIso(due);
  if (!iso) return { ok: false, error: "Muddat noto'g'ri." };
  if (new Date(iso).getTime() <= now) return { ok: false, error: `Muddat o'tib ketgan vaqtni ko'rsatmoqda. Hozir Toshkentda ${tashkentClock(now)}.` };
  return { ok: true, iso };
}

interface Input {
  libraryItemId: string;
  title: string;
  note: string;
  audience: Audience;
  dueIso: string | null;
  notify: boolean;
}

// Creates the assignment and, when asked, tells the audience in the bot. Returns what to show the admin.
export async function createAssignment(input: Input): Promise<string> {
  const { data: created, error } = await supabase
    .from('assignments')
    .insert({
      title: input.title.trim(),
      note: input.note.trim() || null,
      library_item_id: input.libraryItemId,
      audience_all: input.audience.all,
      community_ids: input.audience.all ? [] : input.audience.groups,
      due_at: input.dueIso,
      notify: input.notify,
    })
    .select('id')
    .single();
  if (error || !created) throw new Error("Topshiriqni saqlab bo'lmadi.");

  if (!input.notify) return 'Topshiriq yaratildi.';
  const { data: res, error: fnError } = await supabase.functions.invoke('assignment-notify', { body: { id: created.id } });
  if (fnError) return "Topshiriq yaratildi, lekin botga xabar yuborib bo'lmadi.";
  return `Topshiriq yaratildi. Botda ${res?.sent ?? 0} ta talabaga xabar yuborildi${res?.failed ? `, ${res.failed} tasiga yetmadi` : ''}.`;
}
