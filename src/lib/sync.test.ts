import { describe, it, expect } from 'vitest';
import { mergeById } from './sync';

type D = { id: string; t: number };
const stamp = (d: D) => d.t;

describe('mergeById', () => {
  it('copies one-sided items both ways and lets the newer copy win', () => {
    const local: D[] = [{ id: 'onlyLocal', t: 1 }, { id: 'newerLocal', t: 5 }, { id: 'olderLocal', t: 1 }, { id: 'same', t: 3 }];
    const remote: D[] = [{ id: 'onlyRemote', t: 1 }, { id: 'newerLocal', t: 2 }, { id: 'olderLocal', t: 9 }, { id: 'same', t: 3 }];
    const { toLocal, toRemote } = mergeById(local, remote, stamp);
    expect(toLocal.map((d) => d.id).sort()).toEqual(['olderLocal', 'onlyRemote']);
    expect(toRemote.map((d) => d.id).sort()).toEqual(['newerLocal', 'onlyLocal']);
  });

  it('does nothing when both sides match', () => {
    expect(mergeById([{ id: 'a', t: 1 }], [{ id: 'a', t: 1 }], stamp)).toEqual({ toLocal: [], toRemote: [] });
  });
});
