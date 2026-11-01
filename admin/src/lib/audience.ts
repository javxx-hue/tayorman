// An assignment reaches students only if they can also see its library item.
// These helpers decide whether the item already covers the chosen groups, and what the
// item's audience must become when it does not.

export interface Audience {
  all: boolean;
  groups: string[];
}

export const covers = (item: Audience, wanted: Audience): boolean =>
  item.all || (!wanted.all && wanted.groups.every((g) => item.groups.includes(g)));

// Library convention: "everyone" is stored with an empty group list
export function expand(item: Audience, wanted: Audience): Audience {
  if (item.all || wanted.all) return { all: true, groups: [] };
  return { all: false, groups: [...new Set([...item.groups, ...wanted.groups])] };
}

// "2026-11-05T18:30" typed in the date field means Tashkent time, whatever the computer's clock says
export function tashkentToIso(local: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(local)) return null;
  const date = new Date(`${local}:00+05:00`);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}
