import React, { useEffect, useRef, useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Briefcase, CheckCircle2, ChevronRight, Lightbulb, Lock, Play, RotateCcw } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Language, tr } from '../lib/i18n';
import { Subject } from '../types';
import { BAZA_MISSIONS, BAZA_STORY, BAZA_SUBJECT, BAZA_TABLES, BOSS, COMPANY } from '../lib/bazaMissions';
import { doneMissions, markMissionDone, missionOpen, RunOutput, SHOWN_ROWS } from '../lib/sqlMission';
import { prepareSqlEngine, runMission, stopSqlEngine } from '../lib/sqlRunner';
import { track } from '../lib/track';

interface MissionsProps {
  subjects: Subject[];
  lang: Language;
}

// After this many wrong checks the reference solution can be opened
const SHOW_SOLUTION_AFTER = 3;

const rankOf = (done: number, lang: Language) =>
  done >= BAZA_MISSIONS.length ? 'Junior' : tr(lang, 'Stajyor', 'Стажёр');

// The missions belong to the database subject only
function useBazaSubject(subjects: Subject[]): Subject | undefined {
  const { id } = useParams();
  const subject = subjects.find((s) => s.id === id);
  return subject?.librarySourceId === BAZA_SUBJECT ? subject : undefined;
}

const BossSays: React.FC<{ lines: string[]; tone?: 'plain' | 'good' }> = ({ lines, tone = 'plain' }) => (
  <div className="flex gap-2.5">
    <span className="w-9 h-9 rounded-full bg-primary/15 text-primary flex items-center justify-center text-xs font-extrabold shrink-0">
      {BOSS.slice(0, 2).toUpperCase()}
    </span>
    <div className="space-y-1.5 min-w-0">
      <div className="text-xs text-muted-foreground">{BOSS} · rahbar</div>
      {lines.map((l, i) => (
        <div
          key={i}
          className={`rounded-2xl rounded-tl-md px-3.5 py-2.5 text-sm leading-relaxed ${tone === 'good' ? 'bg-emerald-500/15 text-foreground' : 'bg-secondary text-foreground'}`}
        >
          {l}
        </div>
      ))}
    </div>
  </div>
);

// ---------------------------------------------------------------- the list
export const MissionsPage: React.FC<MissionsProps> = ({ subjects, lang }) => {
  const navigate = useNavigate();
  const subject = useBazaSubject(subjects);
  useEffect(() => {
    if (subject) track('mission_open', { oncePerSession: true });
  }, [subject]);
  if (!subject) return null;
  const done = doneMissions(BAZA_STORY);
  const finished = done.length >= BAZA_MISSIONS.length;

  return (
    <div className="max-w-2xl mx-auto px-4 pt-5 pb-8 space-y-4">
      <button onClick={() => navigate(`/subjects/${subject.id}`)} className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1">
        <ArrowLeft size={14} /> {subject.name}
      </button>

      <div className="rounded-3xl p-5 text-white" style={{ backgroundImage: 'var(--gradient-hero)' }}>
        <div className="text-xs text-white/85 flex items-center gap-1.5">
          <Briefcase size={14} /> {COMPANY} · {rankOf(done.length, lang)}
        </div>
        <h1 className="text-2xl font-extrabold mt-1">{tr(lang, 'Stajyor missiyalari', 'Миссии стажёра')}</h1>
        <p className="text-sm text-white/85 mt-1.5">
          {tr(
            lang,
            "Siz yetkazib berish kompaniyasida stajyorsiz. Haqiqiy SQL yozib, kompaniyadagi muammoni hal qiling.",
            'Вы стажёр в службе доставки. Пишите настоящий SQL и решите проблему компании.'
          )}
        </p>
        <div className="h-2 mt-4 rounded-full bg-white/25 overflow-hidden">
          <div className="h-full rounded-full bg-white" style={{ width: `${(done.length / BAZA_MISSIONS.length) * 100}%` }} />
        </div>
        <div className="text-xs text-white/85 mt-2">{done.length} / {BAZA_MISSIONS.length}</div>
      </div>

      {finished && (
        <BossSays
          tone="good"
          lines={[
            tr(lang, 'Siz endi Junior! Haqiqiy nosozlikni topib, uni tuzatdingiz.', 'Теперь вы Junior! Вы нашли и исправили настоящий сбой.'),
            tr(lang, "Keyingi hikoya tez orada qo'shiladi.", 'Следующая история скоро появится.'),
          ]}
        />
      )}

      <div className="rounded-2xl border border-border bg-card divide-y divide-border">
        {BAZA_MISSIONS.map((m) => {
          const isDone = done.includes(m.id);
          const open = missionOpen(done, m.id);
          return (
            <button
              key={m.id}
              disabled={!open}
              onClick={() => navigate(`/subjects/${subject.id}/missions/${m.id}`)}
              className="w-full text-left flex items-center gap-3 p-3.5 hover:bg-secondary/50 first:rounded-t-2xl last:rounded-b-2xl disabled:opacity-50"
            >
              <span className="w-9 h-9 rounded-xl bg-secondary flex items-center justify-center shrink-0 text-sm font-extrabold">
                {isDone ? <CheckCircle2 size={18} className="text-emerald-500" /> : open ? m.id : <Lock size={16} className="text-muted-foreground" />}
              </span>
              <span className="flex-1 min-w-0">
                <span className="block text-sm font-semibold text-foreground">{m.title}</span>
                <span className="block text-xs text-muted-foreground">
                  {isDone
                    ? tr(lang, 'Bajarildi', 'Выполнено')
                    : open
                      ? tr(lang, `${m.questions.length} ta imtihon savoliga tayyorlaydi`, `Готовит к ${m.questions.length} вопросам экзамена`)
                      : tr(lang, 'Oldingi missiyadan keyin ochiladi', 'Откроется после предыдущей')}
                </span>
              </span>
              {open && <ChevronRight size={16} className="text-muted-foreground shrink-0" />}
            </button>
          );
        })}
      </div>
    </div>
  );
};

// ---------------------------------------------------------------- one mission
export const MissionPage: React.FC<MissionsProps> = ({ subjects, lang }) => {
  const navigate = useNavigate();
  const { mid } = useParams();
  const subject = useBazaSubject(subjects);
  const mission = BAZA_MISSIONS.find((m) => String(m.id) === mid);
  const editor = useRef<HTMLTextAreaElement>(null);
  const [sql, setSql] = useState('');
  const [out, setOut] = useState<RunOutput | null>(null);
  const [problem, setProblem] = useState('');
  const [busy, setBusy] = useState(false);
  const [misses, setMisses] = useState(0);
  const [hint, setHint] = useState(false);
  const [solution, setSolution] = useState(false);

  // A new mission starts clean; the engine loads while the student reads
  useEffect(() => {
    setSql('');
    setOut(null);
    setProblem('');
    setMisses(0);
    setHint(false);
    setSolution(false);
    prepareSqlEngine();
  }, [mid]);
  useEffect(() => () => stopSqlEngine(), []);

  if (!subject || !mission) return null;
  const list = `/subjects/${subject.id}/missions`;
  if (!missionOpen(doneMissions(BAZA_STORY), mission.id)) return <Navigate to={list} replace />;
  const next = BAZA_MISSIONS.find((m) => m.id === mission.id + 1);
  const solved = !!out?.ok;

  // Taps add a piece where the cursor is, with a space around it
  const insert = (piece: string) => {
    const el = editor.current;
    const at = el?.selectionStart ?? sql.length;
    const before = sql.slice(0, at);
    const after = sql.slice(el?.selectionEnd ?? at);
    const left = before && !/\s$/.test(before) ? ' ' : '';
    const text = `${before}${left}${piece} ${after.replace(/^\s+/, '')}`;
    setSql(text);
    const caret = (before + left + piece).length + 1;
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(caret, caret);
    });
  };

  const check = async () => {
    if (busy) return;
    setBusy(true);
    setProblem('');
    try {
      const result = await runMission(mission.id, sql);
      setOut(result);
      if (result.ok) {
        markMissionDone(BAZA_STORY, mission.id);
        track(`mission_done_${mission.id}`);
      } else if (sql.trim()) setMisses((n) => n + 1);
    } catch (e) {
      setOut(null);
      setProblem(
        e instanceof Error && e.message === 'TIMEOUT'
          ? tr(lang, "So'rov juda uzoq ishladi va to'xtatildi. Uni soddaroq yozib ko'ring.", 'Запрос выполнялся слишком долго и был остановлен.')
          : tr(lang, "SQL dasturini yuklab bo'lmadi. Internetni tekshirib, qayta urinib ko'ring.", 'Не удалось загрузить SQL. Проверьте интернет и попробуйте снова.')
      );
    } finally {
      setBusy(false);
    }
  };

  const examQuestions = mission.questions
    .map((qid) => ({ qid, index: subject.questions.findIndex((q) => q.id === qid) }))
    .filter((x) => x.index >= 0);
  const chip = 'px-2.5 py-1 rounded-lg border border-border bg-card text-xs font-mono text-foreground hover:bg-secondary active:translate-y-[1px]';

  return (
    <div className="max-w-2xl mx-auto px-4 pt-5 pb-8 space-y-4">
      <div className="flex items-center justify-between">
        <button onClick={() => navigate(list)} className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1">
          <ArrowLeft size={14} /> {tr(lang, 'Missiyalar', 'Миссии')}
        </button>
        <span className="text-xs text-muted-foreground">{mission.id} / {BAZA_MISSIONS.length}</span>
      </div>
      <h1 className="text-2xl font-extrabold text-foreground">{mission.title}</h1>

      <BossSays lines={mission.brief} />

      <div className="rounded-2xl border border-primary/40 bg-primary/5 p-4 space-y-3">
        <div className="text-xs font-bold text-primary">{tr(lang, 'Topshiriq', 'Задание')}</div>
        <p className="text-sm text-foreground leading-relaxed">{mission.task}</p>
        <div className="space-y-1.5">
          {BAZA_TABLES.filter((t) => mission.tables.includes(t.name)).map((t) => (
            <div key={t.name} className="flex flex-wrap items-center gap-1.5">
              <button className={`${chip} font-bold`} onClick={() => insert(t.name)}>{t.name}</button>
              {t.columns.map((c) => (
                <button key={c} className={`${chip} text-muted-foreground`} onClick={() => insert(c)}>{c}</button>
              ))}
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <textarea
          ref={editor}
          value={sql}
          onChange={(e) => setSql(e.target.value)}
          rows={5}
          placeholder="SELECT ..."
          autoCapitalize="none"
          autoCorrect="off"
          autoComplete="off"
          spellCheck={false}
          className="w-full rounded-2xl border border-border bg-card p-3 font-mono text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
        />
        <div className="flex flex-wrap gap-1.5">
          {[...mission.chips, '*', ',', '(', ')', '=', ';'].map((c, i) => (
            <button key={`${c}-${i}`} className={chip} onClick={() => insert(c)}>{c}</button>
          ))}
          <button className={`${chip} text-muted-foreground`} onClick={() => setSql('')} aria-label={tr(lang, 'Tozalash', 'Очистить')}>
            <RotateCcw size={12} />
          </button>
        </div>
        <p className="text-xs text-muted-foreground">
          {tr(lang, "Har tekshirishda baza boshlang'ich holatiga qaytadi, xato qilishdan qo'rqmang.", 'Перед каждой проверкой база возвращается к началу — не бойтесь ошибиться.')}
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button variant="primary" icon={<Play size={14} />} onClick={check} disabled={busy}>
          {busy ? tr(lang, 'Tekshirilmoqda...', 'Проверка...') : tr(lang, 'Tekshirish', 'Проверить')}
        </Button>
        {!hint && (
          <Button variant="outline" icon={<Lightbulb size={14} />} onClick={() => setHint(true)}>
            {tr(lang, 'Yordam', 'Подсказка')}
          </Button>
        )}
        {misses >= SHOW_SOLUTION_AFTER && !solution && !solved && (
          <Button variant="ghost" onClick={() => setSolution(true)}>{tr(lang, "Yechimni ko'rish", 'Показать решение')}</Button>
        )}
      </div>

      {hint && <div className="rounded-2xl bg-amber-500/10 border border-amber-500/30 p-3 text-sm text-foreground">{mission.hint}</div>}
      {solution && (
        <div className="rounded-2xl border border-border bg-card p-3 space-y-2">
          <pre className="font-mono text-xs text-foreground whitespace-pre-wrap">{mission.solution}</pre>
          <p className="text-xs text-muted-foreground">{tr(lang, "Uni o'zingiz yozib, tekshirib ko'ring: qo'l bilan yozilgani yaxshiroq eslab qolinadi.", 'Напишите его сами и проверьте: так лучше запоминается.')}</p>
        </div>
      )}

      {problem && <div className="rounded-2xl bg-destructive/10 border border-destructive/30 p-3 text-sm text-foreground">{problem}</div>}
      {out && !out.ok && out.message && <div className="rounded-2xl bg-destructive/10 border border-destructive/30 p-3 text-sm text-foreground">{out.message}</div>}

      {out && out.columns.length > 0 && (
        <div className="rounded-2xl border border-border bg-card overflow-x-auto">
          <table className="w-full text-xs font-mono">
            <thead>
              <tr className="border-b border-border">
                {out.columns.map((c, i) => <th key={i} className="text-left px-3 py-2 text-muted-foreground font-semibold whitespace-nowrap">{c}</th>)}
              </tr>
            </thead>
            <tbody>
              {out.rows.map((r, i) => (
                <tr key={i} className="border-b border-border last:border-0">
                  {r.map((v, j) => <td key={j} className="px-3 py-1.5 text-foreground whitespace-nowrap">{v === null ? 'NULL' : String(v)}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
          {out.rows.length >= SHOWN_ROWS && <div className="px-3 py-2 text-xs text-muted-foreground">{tr(lang, `Faqat birinchi ${SHOWN_ROWS} ta qator ko'rsatildi`, `Показаны первые ${SHOWN_ROWS} строк`)}</div>}
        </div>
      )}

      {solved && (
        <div className="space-y-4">
          <BossSays tone="good" lines={mission.success} />
          {examQuestions.length > 0 && (
            <div className="rounded-2xl border border-border bg-card p-4 space-y-2">
              <div className="text-sm font-semibold text-foreground">{tr(lang, 'Bu missiya imtihonning shu savollariga tayyorlaydi:', 'Эта миссия готовит к вопросам экзамена:')}</div>
              {examQuestions.map(({ qid, index }) => (
                <button
                  key={qid}
                  onClick={() => navigate(`/subjects/${subject.id}/q/${qid}`, { state: { queue: examQuestions.map((x) => x.qid) } })}
                  className="w-full text-left text-sm text-foreground hover:text-primary flex gap-2"
                >
                  <span className="text-muted-foreground shrink-0">{index + 1}.</span>
                  <span className="line-clamp-2">{subject.questions[index].text}</span>
                </button>
              ))}
            </div>
          )}
          <Button variant="primary" className="w-full" onClick={() => navigate(next ? `${list}/${next.id}` : list)}>
            {next ? tr(lang, 'Keyingi missiya', 'Следующая миссия') : tr(lang, 'Missiyalarga qaytish', 'К миссиям')}
          </Button>
        </div>
      )}
    </div>
  );
};
