import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// The bot looks texts up by name at run time, so a misspelled or missing name only shows up
// when a real person hits that branch. This keeps the names and the texts in step.
const source = readFileSync(resolve(process.cwd(), 'supabase/functions/telegram-bot/index.ts'), 'utf8').replace(/\r\n/g, '\n');

const table = source.slice(source.indexOf('const T = {'), source.indexOf('\n};\n', source.indexOf('const T = {')));
const defined = [...table.matchAll(/^ {2}(\w+): /gm)].map((m) => m[1]);
const used = [...new Set([...source.matchAll(/\bt\('(\w+)'/g)].map((m) => m[1]))];

describe('bot texts', () => {
  it('every text the code asks for exists', () => {
    expect(defined.length).toBeGreaterThan(10);
    expect(used.filter((k) => !defined.includes(k))).toEqual([]);
  });

  it('no text is left unused', () => {
    expect(defined.filter((k) => !used.includes(k))).toEqual([]);
  });

  it('every text has both languages', () => {
    for (const key of defined) {
      const block = table.slice(table.indexOf(`  ${key}: `)).split(/\n {2}\w+: /)[0];
      expect(block, key).toMatch(/\buz:/);
      expect(block, key).toMatch(/\bru:/);
    }
  });
});
