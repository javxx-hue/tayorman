import { describe, it, expect, vi } from 'vitest';

vi.mock('./supabase', () => ({ supabase: null }));

import { issueRow } from './issues';

describe('issueRow', () => {
  it('trims text and keeps the library link', () => {
    expect(issueRow({ libraryId: 'lib-1', context: '  Iqtisodiyot ', questionText: ' Bozor nima? ', note: ' javob xato ' })).toEqual({
      library_item_id: 'lib-1',
      context: 'Iqtisodiyot',
      question_text: 'Bozor nima?',
      note: 'javob xato',
    });
  });

  it('leaves the link empty when the copy has none', () => {
    expect(issueRow({ context: 'x', questionText: 'y', note: 'z' }).library_item_id).toBeNull();
  });

  it('cuts text to what the table accepts', () => {
    const row = issueRow({ context: 'c'.repeat(500), questionText: 'q'.repeat(2000), note: 'n'.repeat(2000) });
    expect(row.context).toHaveLength(300);
    expect(row.question_text).toHaveLength(1000);
    expect(row.note).toHaveLength(1000);
  });
});
