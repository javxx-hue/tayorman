// Saving a test or subject to the library, and (if chosen) giving it to the students as an assignment right away.
import { StudySet, Subject } from '../../../src/types';
import { publishToLibrary } from '../../../src/lib/library';
import { Audience } from './audience';
import { AssignDraft, checkDue, createAssignment } from './assignmentActions';

interface Input {
  kind: 'set' | 'subject';
  doc: StudySet | Subject;
  audience: Audience;
  draft: boolean;
  assign: AssignDraft;
}

// Returns what to tell the admin afterwards, if anything. Failures carry a message that is safe to show.
export async function publishAndAssign({ kind, doc, audience, draft, assign }: Input): Promise<string | undefined> {
  const giveNow = assign.on && !draft;
  // Check the deadline first, so a typo does not leave the item saved and the assignment missing
  const due = giveNow ? checkDue(assign.due) : null;
  if (due && !due.ok) throw new Error(due.error);

  let libraryItemId: string;
  try {
    libraryItemId = await publishToLibrary({ kind, doc, audienceAll: audience.all, communityIds: audience.groups, published: !draft });
  } catch {
    throw new Error("Saqlab bo'lmadi. Qayta urinib ko'ring.");
  }
  if (!giveNow || !due?.ok) return undefined;

  try {
    const title = 'name' in doc ? doc.name : doc.title;
    return await createAssignment({ libraryItemId, title, note: assign.note, audience, dueIso: due.iso, notify: assign.notify });
  } catch {
    throw new Error("Material saqlandi, lekin topshiriq yaratib bo'lmadi. «Topshiriqlar» bo'limidan qo'lda bering.");
  }
}
