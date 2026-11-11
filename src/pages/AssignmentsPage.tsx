import React from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle2, ClipboardList, Clock, Loader2 } from 'lucide-react';
import { Language, tr } from '../lib/i18n';
import { StudySet, Subject } from '../types';
import { Assignment, Progress, assignmentsView, dueInfo, localItem, progressOf } from '../lib/assignments';
import { ADMIN_URL } from '../lib/telegram';
import { GamesPanel } from '../components/games/GamesPanel';

interface Props {
  assignments: Assignment[] | null;
  server: Record<string, Progress>;
  subjects: Subject[];
  studySets: StudySet[];
  lang: Language;
  staff: boolean; // admin or moderator: gives assignments on the admin site, has none of their own
  userId: string | null; // a signed-in student: the games need the server
}

function dueLabel(dueAt: string, lang: Language): { text: string; urgent: boolean } {
  const d = dueInfo(dueAt);
  if (d.overdue) return { text: tr(lang, "Muddati o'tgan", 'Срок прошёл'), urgent: true };
  if (d.days === 0) return { text: tr(lang, `${d.hours} soat qoldi`, `Осталось часов: ${d.hours}`), urgent: true };
  return { text: tr(lang, `${d.days} kun qoldi`, `Осталось дней: ${d.days}`), urgent: d.days <= 2 };
}

// «Musobaqa»: XP games with group mates, then what the admin gave this student
export const AssignmentsPage: React.FC<Props> = ({ assignments, server, subjects, studySets, lang, staff, userId }) => {
  const navigate = useNavigate();
  const view = assignmentsView(staff, assignments);

  const rows = (assignments ?? [])
    .map((a) => {
      const local = localItem(a, subjects, studySets);
      // The local copy knows best; the server value covers progress made on another device
      const mine = progressOf(local);
      const known = server[a.id];
      const progress = mine.status === 'new' && known ? known : mine;
      return { a, local, progress };
    })
    .sort((x, y) => {
      const doneX = x.progress.status === 'done' ? 1 : 0;
      const doneY = y.progress.status === 'done' ? 1 : 0;
      if (doneX !== doneY) return doneX - doneY;
      return (x.a.due_at ?? '9999').localeCompare(y.a.due_at ?? '9999');
    });

  const open = (row: (typeof rows)[number]) => {
    if (!row.local) return;
    navigate(row.local.kind === 'subject' ? `/subjects/${row.local.item.id}` : `/study/${row.local.item.id}`);
  };

  return (
    <div className="max-w-3xl mx-auto px-4 pt-5 pb-6">
      <h1 className="text-2xl font-extrabold text-foreground">{tr(lang, 'Musobaqa', 'Соревнование')}</h1>
      <p className="text-sm text-muted-foreground mt-1 mb-4">
        {tr(lang, "Kunlik chellenj va guruhdoshlar bilan duelda XP yig'ing, haftalik reytingda yuqoriga chiqing.", 'Набирайте XP в ежедневном челлендже и дуэлях с одногруппниками, поднимайтесь в рейтинге недели.')}
      </p>

      {userId && !staff && <GamesPanel userId={userId} studySets={studySets} lang={lang} />}

      <h2 className="text-lg font-extrabold text-foreground mt-6 mb-1">{tr(lang, 'Topshiriqlar', 'Задания')}</h2>
      <p className="text-xs text-muted-foreground mb-3">
        {tr(lang, "Administrator guruhingizga bergan vazifalar. Natijangiz faqat sizga va administratorga ko'rinadi.", 'Задания администратора для вашей группы. Результат видите вы и администратор.')}
      </p>

      {view === 'staff' ? (
        <div className="rounded-2xl border border-dashed border-border p-8 text-center bg-card space-y-3">
          <ClipboardList size={32} className="mx-auto text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            {tr(lang, "Siz administrator yoki moderatorsiz: topshiriqlarni admin saytda berasiz va natijalarni o'sha yerda ko'rasiz. Bu bo'lim talabalar uchun.", 'Вы администратор или модератор: задания вы выдаёте на сайте администратора и там же смотрите результаты. Этот раздел для студентов.')}
          </p>
          {ADMIN_URL && (
            <a href={ADMIN_URL} target="_blank" rel="noopener noreferrer" className="inline-block px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-semibold hover:opacity-90">
              {tr(lang, 'Admin saytni ochish', 'Открыть сайт администратора')}
            </a>
          )}
        </div>
      ) : view === 'loading' ? (
        <div className="py-12 text-center text-muted-foreground"><Loader2 className="mx-auto animate-spin" /></div>
      ) : view === 'empty' ? (
        <div className="rounded-2xl border border-dashed border-border p-5 text-center bg-card">
          <p className="text-sm text-muted-foreground">{tr(lang, "Hozircha topshiriq yo'q. Yangisi chiqsa, botdan xabar keladi.", 'Заданий пока нет. Когда появится новое, бот сообщит.')}</p>
        </div>
      ) : (
        <ul className="space-y-2">
          {rows.map((row) => {
            const { a, progress } = row;
            const due = a.due_at ? dueLabel(a.due_at, lang) : null;
            const done = progress.status === 'done';
            return (
              <li key={a.id}>
                <button
                  onClick={() => open(row)}
                  disabled={!row.local}
                  className="w-full text-left p-4 rounded-2xl border border-border bg-card hover:border-primary/50 disabled:opacity-60 space-y-1.5"
                >
                  <div className="flex items-start justify-between gap-3">
                    <span className="text-sm font-semibold text-foreground">{a.title}</span>
                    {done ? (
                      <span className="flex items-center gap-1 text-xs font-semibold text-emerald-600 shrink-0">
                        <CheckCircle2 size={14} /> {tr(lang, 'Bajarildi', 'Выполнено')}{progress.score !== null ? ` · ${progress.score}%` : ''}
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground shrink-0">
                        {progress.status === 'started' ? tr(lang, 'Jarayonda', 'В процессе') : tr(lang, 'Yangi', 'Новое')}
                      </span>
                    )}
                  </div>
                  {a.note && <p className="text-xs text-muted-foreground whitespace-pre-wrap">{a.note}</p>}
                  <div className="flex items-center gap-3 text-xs">
                    {due && !done && (
                      <span className={`flex items-center gap-1 ${due.urgent ? 'text-rose-600 font-semibold' : 'text-muted-foreground'}`}>
                        <Clock size={13} /> {due.text}
                      </span>
                    )}
                    {!row.local && <span className="text-muted-foreground">{tr(lang, 'Yuklanmoqda...', 'Загрузка...')}</span>}
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
};
