import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Card, Pill } from '../ui';

// Which test questions a group finds hardest. Totals only: no student is named.
interface Row {
  set_key: string;
  question_id: string;
  students: number;
  answers: number;
  wrong: number;
}
interface Group {
  id: string;
  name: string;
}
interface Item {
  id: string;
  title: string;
  data: { questions?: { id: string; question: string; topic?: number }[]; topics?: { no: number; name: string }[] };
}

const pct = (wrong: number, answers: number) => (answers ? Math.round((wrong / answers) * 100) : 0);
const tone = (p: number) => (p >= 50 ? 'red' : p >= 30 ? 'amber' : 'green');

export const AnalysisPage: React.FC = () => {
  const [groups, setGroups] = useState<Group[] | null>(null);
  const [group, setGroup] = useState<string>('');
  const [rows, setRows] = useState<Row[] | null>(null);
  const [items, setItems] = useState<Record<string, Item>>({});
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    supabase
      .from('communities')
      .select('id, name')
      .order('name')
      .then(({ data, error: err }) => {
        if (err) return setError("Guruhlarni yuklab bo'lmadi.");
        setGroups((data ?? []) as Group[]);
        if (data?.length) setGroup(data[0].id);
      });
  }, []);

  useEffect(() => {
    if (!group) return;
    setRows(null);
    setError(null);
    (async () => {
      const { data, error: err } = await supabase.rpc('group_hard_questions', { p_community: group, p_limit: 100 });
      if (err) return setError("Tahlilni yuklab bo'lmadi.");
      const list = (data ?? []) as Row[];
      const keys = [...new Set(list.map((r) => r.set_key))].filter((k) => !items[k]);
      if (keys.length) {
        const { data: lib } = await supabase.from('library_items').select('id, title, data').in('id', keys);
        setItems((prev) => ({ ...prev, ...Object.fromEntries(((lib ?? []) as Item[]).map((i) => [i.id, i])) }));
      }
      setRows(list);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [group]);

  const questionOf = (r: Row) => items[r.set_key]?.data.questions?.find((q) => q.id === r.question_id);
  const topicName = (r: Row) => {
    const item = items[r.set_key];
    const no = questionOf(r)?.topic;
    return item?.data.topics?.find((t) => t.no === no)?.name ?? '';
  };

  // Topics, from the questions above (the hardest ones), weakest first
  const topics = useMemo(() => {
    const by = new Map<string, { name: string; set: string; answers: number; wrong: number }>();
    for (const r of rows ?? []) {
      const name = topicName(r);
      if (!name) continue;
      const key = `${r.set_key}:${name}`;
      const t = by.get(key) ?? { name, set: items[r.set_key]?.title ?? '', answers: 0, wrong: 0 };
      t.answers += Number(r.answers);
      t.wrong += Number(r.wrong);
      by.set(key, t);
    }
    return [...by.values()].filter((t) => t.answers >= 5).sort((a, b) => pct(b.wrong, b.answers) - pct(a.wrong, a.answers)).slice(0, 10);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, items]);

  const hardest = (rows ?? []).filter((r) => Number(r.answers) >= 3).slice(0, 30);

  return (
    <div className="space-y-4">
      <Card title="Guruh tahlili: qaysi savollar qiyin">
        <p className="text-sm text-muted-foreground mb-3">
          Talabalarning test javoblaridan umumiy hisob. Kim xato qilgani ko'rsatilmaydi. Savol kamida 2 ta talaba tomonidan ishlangan bo'lsa chiqadi.
        </p>
        {groups === null ? (
          <p className="text-sm text-muted-foreground">Yuklanmoqda...</p>
        ) : groups.length === 0 ? (
          <p className="text-sm text-muted-foreground">Guruh yo'q.</p>
        ) : (
          <select value={group} onChange={(e) => setGroup(e.target.value)} className="px-3 py-2 rounded-lg border border-border bg-background text-sm">
            {groups.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </select>
        )}
      </Card>

      {error && <p className="text-sm text-rose-600">{error}</p>}

      {rows !== null && !error && (
        <>
          <Card title="Eng qiyin mavzular">
            {topics.length === 0 ? (
              <p className="text-sm text-muted-foreground">Hali yetarli javob yo'q. Talabalar testlarni ishlagani sari shu yerda chiqadi.</p>
            ) : (
              <table className="w-full text-sm">
                <tbody>
                  {topics.map((t) => {
                    const p = pct(t.wrong, t.answers);
                    return (
                      <tr key={`${t.set}:${t.name}`} className="border-t border-border first:border-0">
                        <td className="py-1.5 pr-3">{t.name}</td>
                        <td className="py-1.5 pr-3 text-xs text-muted-foreground">{t.set}</td>
                        <td className="py-1.5 text-right whitespace-nowrap">
                          <Pill tone={tone(p)}>{p}% xato</Pill>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </Card>

          <Card title="Eng qiyin savollar">
            {hardest.length === 0 ? (
              <p className="text-sm text-muted-foreground">Hali yetarli javob yo'q.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-xs text-muted-foreground text-left">
                      <th className="py-1.5 pr-3 font-medium">Savol</th>
                      <th className="py-1.5 pr-3 font-medium">Mavzu</th>
                      <th className="py-1.5 pr-3 font-medium whitespace-nowrap">Talaba</th>
                      <th className="py-1.5 font-medium text-right">Xato</th>
                    </tr>
                  </thead>
                  <tbody>
                    {hardest.map((r) => {
                      const p = pct(Number(r.wrong), Number(r.answers));
                      return (
                        <tr key={`${r.set_key}:${r.question_id}`} className="border-t border-border align-top">
                          <td className="py-1.5 pr-3">
                            {questionOf(r)?.question ?? r.question_id}
                            <div className="text-xs text-muted-foreground">{items[r.set_key]?.title}</div>
                          </td>
                          <td className="py-1.5 pr-3 text-xs text-muted-foreground">{topicName(r)}</td>
                          <td className="py-1.5 pr-3 text-xs whitespace-nowrap">{r.students}</td>
                          <td className="py-1.5 text-right whitespace-nowrap">
                            <Pill tone={tone(p)}>
                              {p}% ({r.wrong}/{r.answers})
                            </Pill>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </>
      )}
    </div>
  );
};
