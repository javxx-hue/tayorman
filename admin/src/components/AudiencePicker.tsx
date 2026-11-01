import React from 'react';
import { Audience } from '../lib/audience';

interface Props {
  groups: { id: string; name: string }[];
  value: Audience;
  onChange: (next: Audience) => void;
  allowAll: boolean; // moderators can only pick their own groups
}

// "Hamma talabalar" or a choice of groups
export const AudiencePicker: React.FC<Props> = ({ groups, value, onChange, allowAll }) => (
  <div>
    <div className="text-xs font-semibold text-muted-foreground mb-1">Kimga</div>
    {allowAll && (
      <label className="flex items-center gap-2 text-sm mb-1">
        <input type="checkbox" checked={value.all} onChange={(e) => onChange({ all: e.target.checked, groups: value.groups })} /> Hamma talabalarga
      </label>
    )}
    {!value.all && (
      <div className="flex flex-wrap gap-2">
        {groups.length === 0 && <span className="text-xs text-muted-foreground">Avval «Guruhlar» bo'limida guruh yarating.</span>}
        {groups.map((g) => {
          const on = value.groups.includes(g.id);
          return (
            <button
              key={g.id}
              type="button"
              onClick={() => onChange({ all: false, groups: on ? value.groups.filter((x) => x !== g.id) : [...value.groups, g.id] })}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold border ${on ? 'bg-primary text-primary-foreground border-primary' : 'border-border text-muted-foreground hover:bg-secondary'}`}
            >
              {g.name}
            </button>
          );
        })}
      </div>
    )}
  </div>
);
