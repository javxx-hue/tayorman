import React, { useEffect, useRef, useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Briefcase, CheckCircle2, ChevronRight, CornerDownLeft, Lock, Play, RotateCcw } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { box, chip, HelpButtons, pick, TaskCard, WorkspaceProps } from '../components/missions/shared';
import { ElekWorkspace } from '../components/missions/ElekWorkspace';
import { ELEK_BOSS, ELEK_MISSIONS, ElekMission } from '../lib/elekMissions';
import { AlgebraWorkspace } from '../components/missions/AlgebraWorkspace';
import { ALGEBRA_BOSS, ALGEBRA_MISSIONS, AlgebraMission } from '../lib/algebraMissions';
import { Language, tr } from '../lib/i18n';
import { Subject } from '../types';
import { BAZA_MISSIONS, BAZA_TABLES, BOSS, COMPANY } from '../lib/bazaMissions';
import { NET_BOSS, NetMission, missionLab, TARMOQ_MISSIONS } from '../lib/tarmoqMissions';
import { newSession, prompt, runCommand, Session } from '../lib/netLab';
import { doneMissions, insertPiece, missionOpen, saveMission, StoryId, StoryRef, storyOf, syncMissions } from '../lib/missionStories';
import { RunOutput, SHOWN_ROWS, SqlMission } from '../lib/sqlMission';
import { prepareSqlEngine, runMission, stopSqlEngine } from '../lib/sqlRunner';
import { track } from '../lib/track';

interface MissionsProps {
  subjects: Subject[];
  lang: Language;
}

interface StoryMission {
  id: number;
  title: string;
  brief: string[];
  success: string[];
  questions: string[];
}

interface StoryContent {
  boss: string;
  role: string;
  intro: string;
  finale: string;
  missions: StoryMission[];
}

const CONTENT: Record<StoryId, StoryContent> = {
  baza: {
    boss: BOSS,
    role: 'rahbar',
    intro: "Siz yetkazib berish kompaniyasida stajyorsiz. Haqiqiy SQL yozib, kompaniyadagi muammoni hal qiling.",
    finale: 'Siz endi Junior! Haqiqiy nosozlikni topib, uni tuzatdingiz.',
    missions: BAZA_MISSIONS,
  },
  tarmoq: {
    boss: NET_BOSS,
    role: 'tarmoq administratori',
    intro: "Siz kompaniyaning tarmoq bo'limida stajyorsiz. Kompyuter, kommutator va routerga haqiqiy buyruqlar yozib, ofisdagi nosozliklarni tuzating.",
    finale: "Siz endi Junior tarmoqchi! Ofisdagi 5 ta nosozlikni o'zingiz topib, tuzatdingiz.",
    missions: TARMOQ_MISSIONS,
  },
  elektronika: {
    boss: ELEK_BOSS,
    role: 'usta',
    intro: "Siz kompaniyaning ta'mirlash ustaxonasida stajyorsiz. Multimetr, rezistorlar va ossillograf bilan qurilmalarni tuzating.",
    finale: "Siz endi Junior usta! 5 ta qurilmani o'zingiz tekshirib, tuzatdingiz.",
    missions: ELEK_MISSIONS,
  },
  algebra: {
    boss: ALGEBRA_BOSS,
    role: 'dron dasturchisi',
    intro: "Siz kompaniyaning dron yetkazish bo'limida stajyorsiz. Har bir hisobingiz dronni yuritadi: xato hisob — xato parvoz.",
    finale: 'Siz endi Junior dron muhandisi! Kompleks sonlar, determinantlar, matritsalar va Gauss usuli bilan dronni boshqardingiz.',
    missions: ALGEBRA_MISSIONS,
  },
};

// After this many wrong tries the reference solution can be opened
const SQL_TRIES = 3;
const NET_TRIES = 8;

// The subject and its story, when this subject has missions
function useStory(subjects: Subject[]): { subject: Subject; story: StoryRef; content: StoryContent } | null {
  const { id } = useParams();
  const subject = subjects.find((s) => s.id === id);
  const story = storyOf(subject?.librarySourceId);
  return subject && story ? { subject, story, content: CONTENT[story.id] } : null;
}

const BossSays: React.FC<{ boss: string; role: string; lines: string[]; tone?: 'plain' | 'good' }> = ({ boss, role, lines, tone = 'plain' }) => (
  <div className="flex gap-2.5">
    <span className="w-9 h-9 rounded-full bg-primary/15 text-primary flex items-center justify-center text-xs font-extrabold shrink-0">
      {boss.slice(0, 2).toUpperCase()}
    </span>
    <div className="space-y-1.5 min-w-0">
      <div className="text-xs text-muted-foreground">{boss} · {role}</div>
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
  const found = useStory(subjects);
  const storyId = found?.story.id;
  const [, refresh] = useState(0);
  useEffect(() => {
    if (!storyId) return;
    track(`mission_open_${storyId}`, { oncePerSession: true });
    // missions finished on another device show up here too
    void syncMissions().then(() => refresh((n) => n + 1));
  }, [storyId]);
  if (!found) return null;
  const { subject, story, content } = found;
  const done = doneMissions(story.id);
  const finished = done.length >= content.missions.length;

  return (
    <div className="max-w-2xl mx-auto px-4 pt-5 pb-8 space-y-4">
      <button onClick={() => navigate(`/subjects/${subject.id}`)} className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1">
        <ArrowLeft size={14} /> {subject.name}
      </button>

      <div className="rounded-3xl p-5 text-white" style={{ backgroundImage: 'var(--gradient-hero)' }}>
        <div className="text-xs text-white/85 flex items-center gap-1.5">
          <Briefcase size={14} /> {COMPANY} · {finished ? 'Junior' : tr(lang, 'Stajyor', 'Стажёр')}
        </div>
        <h1 className="text-2xl font-extrabold mt-1">{tr(lang, 'Stajyor missiyalari', 'Миссии стажёра')}</h1>
        <p className="text-sm text-white/85 mt-1.5">{content.intro}</p>
        <div className="h-2 mt-4 rounded-full bg-white/25 overflow-hidden">
          <div className="h-full rounded-full bg-white" style={{ width: `${(done.length / content.missions.length) * 100}%` }} />
        </div>
        <div className="text-xs text-white/85 mt-2">{done.length} / {content.missions.length}</div>
      </div>

      {finished && <BossSays boss={content.boss} role={content.role} tone="good" lines={[content.finale, tr(lang, "Keyingi hikoya tez orada qo'shiladi.", 'Следующая история скоро появится.')]} />}

      <div className="rounded-2xl border border-border bg-card divide-y divide-border">
        {content.missions.map((m) => {
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
  const found = useStory(subjects);
  const [solvedId, setSolvedId] = useState<string | null>(null);
  const [earned, setEarned] = useState<{ key: string; xp: number } | null>(null);
  const mission = found?.content.missions.find((m) => String(m.id) === mid);
  if (!found || !mission) return null;
  const { subject, story, content } = found;
  const list = `/subjects/${subject.id}/missions`;
  if (!missionOpen(doneMissions(story.id), mission.id)) return <Navigate to={list} replace />;
  const key = `${story.id}-${mission.id}`;
  const solved = solvedId === key;
  const next = content.missions.find((m) => m.id === mission.id + 1);

  const onSolved = () => {
    if (solved) return;
    track(`mission_done_${story.id}_${mission.id}`);
    setSolvedId(key);
    void saveMission(story.id, mission.id).then((xp) => setEarned({ key, xp }));
  };
  const xp = earned?.key === key ? earned.xp : 0;

  const examQuestions = mission.questions
    .map((qid) => ({ qid, index: subject.questions.findIndex((q) => q.id === qid) }))
    .filter((x) => x.index >= 0);

  return (
    <div className="max-w-2xl mx-auto px-4 pt-5 pb-8 space-y-4">
      <div className="flex items-center justify-between">
        <button onClick={() => navigate(list)} className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1">
          <ArrowLeft size={14} /> {tr(lang, 'Missiyalar', 'Миссии')}
        </button>
        <span className="text-xs text-muted-foreground">{mission.id} / {content.missions.length}</span>
      </div>
      <h1 className="text-2xl font-extrabold text-foreground">{mission.title}</h1>

      <BossSays boss={content.boss} role={content.role} lines={mission.brief} />

      {/* keyed: a new mission starts with a clean workspace */}
      {story.id === 'baza' && <SqlWorkspace key={key} mission={mission as SqlMission} lang={lang} solved={solved} onSolved={onSolved} />}
      {story.id === 'tarmoq' && <NetWorkspace key={key} mission={mission as NetMission} lang={lang} solved={solved} onSolved={onSolved} />}
      {story.id === 'elektronika' && <ElekWorkspace key={key} mission={mission as ElekMission} lang={lang} solved={solved} onSolved={onSolved} />}
      {story.id === 'algebra' && <AlgebraWorkspace key={key} mission={mission as AlgebraMission} lang={lang} solved={solved} onSolved={onSolved} />}

      {solved && (
        <div className="space-y-4">
          <BossSays boss={content.boss} role={content.role} tone="good" lines={mission.success} />
          {xp > 0 && (
            <div className="rounded-2xl bg-amber-500/15 border border-amber-500/30 p-3 text-sm font-bold text-foreground text-center">
              +{xp} XP · {tr(lang, 'Musobaqa reytingiga qo\'shildi', 'Добавлено в рейтинг')}
            </div>
          )}
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

// Remembers where the cursor was in a field, so chips can insert there without focusing it: a tap on a chip
// never opens the phone keyboard
function useChipInput() {
  const caret = useRef<{ start: number; end: number } | null>(null);
  const [text, setText] = useState('');
  const remember = (e: React.SyntheticEvent<HTMLTextAreaElement | HTMLInputElement>) => {
    caret.current = { start: e.currentTarget.selectionStart ?? 0, end: e.currentTarget.selectionEnd ?? 0 };
  };
  return {
    text,
    insert: (piece: string) => {
      const r = insertPiece(text, caret.current, piece);
      setText(r.text);
      caret.current = { start: r.caret, end: r.caret };
    },
    set: (value: string) => {
      setText(value);
      caret.current = null;
    },
    fieldProps: {
      value: text,
      onChange: (e: React.ChangeEvent<HTMLTextAreaElement | HTMLInputElement>) => {
        setText(e.target.value);
        remember(e);
      },
      onSelect: remember,
      autoCapitalize: 'none',
      autoCorrect: 'off',
      autoComplete: 'off',
      spellCheck: false,
    },
  };
}

// ---------------------------------------------------------------- SQL: write a query, check it on a fresh database
const SqlWorkspace: React.FC<WorkspaceProps<SqlMission>> = ({ mission, lang, solved, onSolved }) => {
  const input = useChipInput();
  const [out, setOut] = useState<RunOutput | null>(null);
  const [problem, setProblem] = useState('');
  const [busy, setBusy] = useState(false);
  const [misses, setMisses] = useState(0);

  // The engine loads while the student reads, and is freed on leaving
  useEffect(() => {
    prepareSqlEngine();
    return () => stopSqlEngine();
  }, []);

  const check = async () => {
    if (busy) return;
    setBusy(true);
    setProblem('');
    try {
      const result = await runMission(mission.id, input.text);
      setOut(result);
      if (result.ok) onSolved();
      else if (input.text.trim()) setMisses((n) => n + 1);
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

  return (
    <>
      <TaskCard lang={lang} task={mission.task}>
        <div className="space-y-1.5">
          {BAZA_TABLES.filter((t) => mission.tables.includes(t.name)).map((t) => (
            <div key={t.name} className="flex flex-wrap items-center gap-1.5">
              <button className={`${chip} font-bold`} onClick={() => input.insert(t.name)}>{t.name}</button>
              {t.columns.map((c) => (
                <button key={c} className={`${chip} text-muted-foreground`} onClick={() => input.insert(c)}>{c}</button>
              ))}
            </div>
          ))}
        </div>
      </TaskCard>

      <div className="space-y-2">
        <textarea
          {...input.fieldProps}
          rows={5}
          placeholder="SELECT ..."
          className="w-full rounded-2xl border border-border bg-card p-3 font-mono text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
        />
        <div className="flex flex-wrap gap-1.5">
          {[...mission.chips, '*', ',', '(', ')', '=', ';'].map((c, i) => (
            <button key={`${c}-${i}`} className={chip} onClick={() => input.insert(c)}>{c}</button>
          ))}
          <button className={`${chip} text-muted-foreground`} onClick={() => input.set('')} aria-label={tr(lang, 'Tozalash', 'Очистить')}>
            <RotateCcw size={12} />
          </button>
        </div>
        <p className="text-xs text-muted-foreground">
          {tr(lang, "Har tekshirishda baza boshlang'ich holatiga qaytadi, xato qilishdan qo'rqmang.", 'Перед каждой проверкой база возвращается к началу — не бойтесь ошибиться.')}
        </p>
      </div>

      <Button variant="primary" icon={<Play size={14} />} onClick={check} disabled={busy}>
        {busy ? tr(lang, 'Tekshirilmoqda...', 'Проверка...') : tr(lang, 'Tekshirish', 'Проверить')}
      </Button>
      <HelpButtons lang={lang} hint={mission.hint} solution={mission.solution} tries={misses} need={SQL_TRIES} solved={solved} />

      {problem && <div className={box.bad}>{problem}</div>}
      {out && !out.ok && out.message && <div className={box.bad}>{out.message}</div>}

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
    </>
  );
};

// ---------------------------------------------------------------- network: consoles of the office devices
interface LogLine {
  prompt: string;
  command: string;
  output: string;
}

const OFFICE_MAP = 'Internet — R1 (G0/0 | G0/1) — SW1 (Fa0/1)\nSW1: Fa0/2 PC-Aziza · Fa0/3 PC-Kassa · Fa0/4 Server\n     Fa0/5 PC-Ombor · Fa0/6 PC-Kuryer';

const NetWorkspace: React.FC<WorkspaceProps<NetMission>> = ({ mission, lang, solved, onSolved }) => {
  const session = useRef<Session>(newSession(missionLab(mission.id)));
  const [device, setDevice] = useState(mission.devices[0]);
  const [logs, setLogs] = useState<Record<string, LogLine[]>>({});
  const [note, setNote] = useState('');
  const [tries, setTries] = useState(0);
  const input = useChipInput();
  const screen = useRef<HTMLDivElement>(null);
  const log = logs[device] ?? [];

  useEffect(() => {
    screen.current?.scrollTo({ top: screen.current.scrollHeight });
  }, [log.length, device, input.text]);

  const run = () => {
    const command = input.text.trim();
    if (!command) return;
    const s = session.current;
    const before = prompt(s, device);
    const output = runCommand(s, device, command);
    setLogs((l) => ({ ...l, [device]: [...(l[device] ?? []), { prompt: before, command, output }] }));
    input.set('');
    setTries((n) => n + 1);
    const result = mission.goal(s.lab);
    setNote(result.ok ? '' : result.note ?? '');
    if (result.ok) onSolved();
  };

  return (
    <>
      <TaskCard lang={lang} task={mission.task}>
        <pre className="text-[11px] leading-relaxed font-mono text-muted-foreground whitespace-pre-wrap">{OFFICE_MAP}</pre>
      </TaskCard>

      <div className="space-y-2">
        <div className="flex flex-wrap gap-1.5">
          {mission.devices.map((d) => (
            <button key={d} onClick={() => setDevice(d)} className={pick(d === device)}>
              {d}
            </button>
          ))}
        </div>

        <div ref={screen} className="rounded-2xl bg-zinc-950 text-zinc-100 font-mono text-[11px] leading-relaxed p-3 h-64 overflow-auto">
          {log.length === 0 && <div className="text-zinc-500 mb-2">{tr(lang, `${device} konsoli. Buyruq yozing yoki pastdagi tugmalarni bosing.`, `Консоль ${device}. Введите команду или нажмите кнопки ниже.`)}</div>}
          {log.map((l, i) => (
            <div key={i} className="mb-2">
              <div>
                <span className="text-emerald-400">{l.prompt}</span> {l.command}
              </div>
              {l.output && <pre className="whitespace-pre text-zinc-300">{l.output}</pre>}
            </div>
          ))}
          <div>
            <span className="text-emerald-400">{prompt(session.current, device)}</span> {input.text}
            <span className="inline-block w-1.5 h-3 bg-zinc-300 align-middle animate-pulse" aria-hidden />
          </div>
        </div>

        <div className="flex gap-2 items-center">
          <input
            {...input.fieldProps}
            enterKeyHint="go"
            onKeyDown={(e) => {
              if (e.key === 'Enter') run();
            }}
            placeholder={tr(lang, 'buyruq', 'команда')}
            className="flex-1 min-w-0 rounded-xl border border-border bg-card px-3 py-2 font-mono text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          />
          <Button variant="primary" size="sm" icon={<CornerDownLeft size={14} />} onClick={run} aria-label={tr(lang, 'Bajarish', 'Выполнить')}>
            {tr(lang, 'Bajarish', 'Выполнить')}
          </Button>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {(mission.chips[device] ?? []).map((c) => (
            <button key={c} className={chip} onClick={() => input.insert(c)}>{c}</button>
          ))}
          <button className={`${chip} text-muted-foreground`} onClick={() => input.set('')} aria-label={tr(lang, 'Tozalash', 'Очистить')}>
            <RotateCcw size={12} />
          </button>
        </div>
      </div>

      {note && <div className={box.bad}>{note}</div>}
      <HelpButtons lang={lang} hint={mission.hint} solution={mission.solution.join('\n')} tries={tries} need={NET_TRIES} solved={solved} />
    </>
  );
};
