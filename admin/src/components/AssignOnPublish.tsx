import React from 'react';
import { AssignDraft } from '../lib/assignmentActions';
import { tashkentClock } from '../lib/audience';

const field = 'px-3 py-1.5 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary';

// "Also give it to the students as an assignment": it then shows in their Topshiriq tab, with a deadline
export const AssignOnPublish: React.FC<{ value: AssignDraft; onChange: (next: AssignDraft) => void }> = ({ value, onChange }) => (
  <div className="rounded-xl border border-border p-3 space-y-3">
    <label className="flex items-center gap-2 text-sm font-semibold">
      <input type="checkbox" checked={value.on} onChange={(e) => onChange({ ...value, on: e.target.checked })} /> Topshiriq sifatida ham berish
    </label>
    <p className="text-xs text-muted-foreground -mt-1">
      Belgilamasangiz, material talabalarning «Fanlar» bo'limida paydo bo'ladi, lekin «Topshiriq» bo'limiga tushmaydi va muddat bo'lmaydi.
    </p>
    {value.on && (
      <div className="space-y-3">
        <textarea value={value.note} maxLength={2000} rows={2} onChange={(e) => onChange({ ...value, note: e.target.value })} placeholder="Izoh (ixtiyoriy): talabaga nima qilish kerak" className={`${field} w-full`} />
        <div className="flex flex-wrap items-end gap-4">
          <label className="text-xs font-semibold text-muted-foreground">
            Muddat (Toshkent vaqti, hozir {tashkentClock()}; ixtiyoriy)
            <input type="datetime-local" value={value.due} onChange={(e) => onChange({ ...value, due: e.target.value })} className={`${field} block mt-1`} />
          </label>
          <label className="flex items-center gap-2 text-sm pb-1.5">
            <input type="checkbox" checked={value.notify} onChange={(e) => onChange({ ...value, notify: e.target.checked })} /> Botda xabar yuborish
          </label>
        </div>
      </div>
    )}
  </div>
);
