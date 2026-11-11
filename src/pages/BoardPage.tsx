import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Pause, Play, SkipBack, SkipForward, ChevronRight, Check } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { CHALK_TIP, Teacher, TEACHER_SIZE } from '../components/board/Teacher';
import { Language, tr } from '../lib/i18n';
import { Subject } from '../types';
import { practiceOrder } from '../lib/prep';
import { boardSteps, BoardSpeed, getBoardSpeed, highlight, readingTime, setBoardSpeed, SPEEDS } from '../lib/board';
import { clozeScore, makeCloze, sameAnswer } from '../lib/cloze';
import { saveAttempt } from '../lib/attempts';
import { useSpeech } from '../lib/speech';

interface BoardPageProps {
  subjects: Subject[];
  lang: Language;
}

export const BOARD_SITTING = 10;
const CHALK = '#eef2e6';

// Board text with the key terms underlined in yellow chalk
const Chalk: React.FC<{ text: string; terms: string[] }> = ({ text, terms }) => (
  <>
    {highlight(text, terms).map((p, i) =>
      p.key ? (
        <span key={i} className="text-[#fde68a] underline decoration-1 decoration-[#fde68a]/60 underline-offset-4">{p.text}</span>
      ) : (
        <span key={i}>{p.text}</span>
      )
    )}
  </>
);

// The board: an exam question's model answer written up in chalk step by step and read aloud by the phone,
// with a short fill-in check at the end. No AI involved.
export const BoardPage: React.FC<BoardPageProps> = ({ subjects, lang }) => {
  const { id } = useParams();
  const navigate = useNavigate();
  const start = (useLocation().state as { question?: string } | null)?.question;
  const subject = subjects.find((s) => s.id === id);
  const speech = useSpeech(lang);

  // A link from one question shows just that one; otherwise a sitting in practice order
  const queue = useMemo(() => {
    if (!subject) return [];
    const withAnswer = subject.questions.filter((q) => q.modelAnswer);
    if (start) return withAnswer.filter((q) => q.id === start);
    return practiceOrder(subject).filter((q) => q.modelAnswer).slice(0, BOARD_SITTING);
  }, [subject?.id, start]); // eslint-disable-line react-hooks/exhaustive-deps

  const [index, setIndex] = useState(0);
  const [step, setStep] = useState(0);
  const [typed, setTyped] = useState(0);
  const [spoken, setSpoken] = useState(false);
  const [talking, setTalking] = useState(false);
  const [playing, setPlaying] = useState(true);
  const [nod, setNod] = useState(0);
  const [speed, setSpeed] = useState<BoardSpeed>(getBoardSpeed);
  const [phase, setPhase] = useState<'teach' | 'check'>('teach');
  const [answers, setAnswers] = useState<string[]>([]);
  const [checked, setChecked] = useState(false);
  const boardEnd = useRef<HTMLDivElement>(null);
  const caret = useRef<HTMLSpanElement>(null);
  const page = useRef<HTMLDivElement>(null);
  const [chalkAt, setChalkAt] = useState({ left: 0, top: 0 });

  const question = queue[index];
  const steps = useMemo(() => (question ? boardSteps(question) : []), [question]);
  const cloze = useMemo(() => (question?.modelAnswer ? makeCloze(question.modelAnswer.summary, question.modelAnswer.keyPoints, 3) : null), [question]);
  const terms = useMemo(() => (question?.modelAnswer ? makeCloze(question.modelAnswer.summary, question.modelAnswer.keyPoints, 5)?.answers ?? [] : []), [question]);
  const current = steps[step];
  const typingDone = !!current && typed >= current.text.length;
  const lastStep = step >= steps.length - 1;
  const pace = SPEEDS[speed];

  // Write the current step letter by letter
  useEffect(() => {
    if (phase !== 'teach' || !current) return;
    setTyped(0);
    const timer = setInterval(() => {
      setTyped((n) => {
        if (n >= current.text.length) {
          clearInterval(timer);
          return n;
        }
        return n + 1;
      });
    }, 1000 / pace.lettersPerSecond);
    return () => clearInterval(timer);
  }, [phase, step, current, pace.lettersPerSecond]);

  // Read it aloud while playing (or, with no voice on the phone, give time to read it)
  useEffect(() => {
    setSpoken(false);
    if (phase !== 'teach' || !playing || !current) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    // Stopping speech also reports "ended" in some browsers: only the step still on the board may move on
    let active = true;
    if (speech.available) {
      setTalking(true);
      speech.speak(
        current.text,
        () => {
          if (!active) return;
          setTalking(false);
          setSpoken(true);
        },
        pace.speechRate
      );
    } else timer = setTimeout(() => setSpoken(true), readingTime(current.text) * pace.wait);
    return () => {
      active = false;
      if (timer) clearTimeout(timer);
    };
  }, [phase, playing, step, current]); // eslint-disable-line react-hooks/exhaustive-deps

  // When a step is written and said: a nod, then the next step (or the check after the last one)
  useEffect(() => {
    if (phase !== 'teach' || !playing || !typingDone || !spoken) return;
    setNod((n) => n + 1);
    const timer = setTimeout(() => (lastStep ? toCheck() : setStep((s) => s + 1)), 500);
    return () => clearTimeout(timer);
  }, [phase, playing, typingDone, spoken]); // eslint-disable-line react-hooks/exhaustive-deps

  // A block body on purpose: newer browsers return a promise from scrollIntoView, and an effect must not return one
  useEffect(() => {
    boardEnd.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [step, typed, phase]);
  useEffect(() => () => speech.stop(), []); // eslint-disable-line react-hooks/exhaustive-deps

  // The teacher follows the chalk: its chalk tip goes to the end of the line being written
  useLayoutEffect(() => {
    const end = caret.current;
    const area = page.current;
    if (!end || !area) return;
    const scale = TEACHER_SIZE / 100;
    const left = Math.min(end.offsetLeft - CHALK_TIP.x * scale, area.clientWidth - TEACHER_SIZE);
    setChalkAt({ left: Math.max(0, left), top: end.offsetTop + end.offsetHeight - CHALK_TIP.y * scale });
  }, [typed, step, phase, index]);

  if (!subject) return null;
  const back = () => (start ? navigate(-1) : navigate(`/subjects/${subject.id}`));

  if (!question) {
    return (
      <div className="max-w-md mx-auto px-4 py-16 text-center space-y-4">
        <h2 className="text-2xl font-serif text-foreground">{queue.length ? tr(lang, 'Dars tugadi', 'Урок окончен') : tr(lang, "Namunaviy javob yo'q", 'Нет образца ответа')}</h2>
        <Button variant="primary" onClick={back}>{tr(lang, 'Orqaga', 'Назад')}</Button>
      </div>
    );
  }

  function toCheck() {
    speech.stop();
    setTalking(false);
    if (cloze) setPhase('check');
    else nextQuestion();
  }
  function nextQuestion() {
    speech.stop();
    setTalking(false);
    if (index + 1 >= queue.length) return back();
    setIndex((i) => i + 1);
    setStep(0);
    setPhase('teach');
    setAnswers([]);
    setChecked(false);
    setPlaying(true);
  }
  const goStep = (to: number) => {
    speech.stop();
    setTalking(false);
    setStep(Math.max(0, Math.min(steps.length - 1, to)));
  };
  // A tap on the board: finish writing the line, or move on
  const tapBoard = () => {
    if (phase !== 'teach') return;
    if (!typingDone) setTyped(current.text.length);
    else if (lastStep) toCheck();
    else goStep(step + 1);
  };
  const changeSpeed = (s: BoardSpeed) => {
    setSpeed(s);
    setBoardSpeed(s);
  };
  const check = () => {
    if (!cloze) return;
    const right = cloze.answers.filter((a, i) => sameAnswer(answers[i] ?? '', a)).length;
    saveAttempt(subject.id, question.id, { at: Date.now(), answer: answers.join(' | '), score: clozeScore(right, cloze.answers.length), feedback: '', missing: [], mode: 'cloze' });
    setChecked(true);
  };
  const number = subject.questions.findIndex((q) => q.id === question.id) + 1;

  return (
    <div className="max-w-2xl mx-auto px-4 pt-4 pb-6 space-y-3">
      <div className="flex items-center justify-between">
        <button onClick={back} className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1">
          <ArrowLeft size={14} /> {subject.name}
        </button>
        <span className="text-xs text-muted-foreground">
          {tr(lang, `${number}-bilet`, `Билет ${number}`)}
          {queue.length > 1 && ` · ${index + 1} / ${queue.length}`}
        </span>
      </div>

      {/* The board */}
      <div className="relative">
        <div
          onClick={tapBoard}
          className="rounded-3xl border-[6px] border-[#5b4636] bg-[#1f3a2f] px-5 pt-5 pb-28 h-[70vh] overflow-y-auto shadow-[inset_0_0_50px_rgba(0,0,0,0.5)] text-[17px] leading-relaxed font-medium select-none cursor-pointer"
          style={{ color: CHALK, textShadow: '0 0 1px rgba(255,255,255,0.35)' }}
        >
          {phase === 'teach' ? (
            <div ref={page} className="relative space-y-3">
              {steps.slice(0, step + 1).map((s, i) => {
                const text = i === step ? s.text.slice(0, typed) : s.text;
                return (
                  <div
                    key={i}
                    className={`${i === step ? '' : 'opacity-85'} ${s.kind === 'title' ? 'font-chalk text-[26px] font-semibold leading-snug border-b border-white/20 pb-2' : s.kind === 'point' ? 'pl-3 border-l-2 border-[#fde68a]/50' : ''}`}
                  >
                    {s.kind === 'point' && '✔ '}
                    <Chalk text={text} terms={terms} />
                    {i === step && <span ref={caret} className={typingDone ? 'inline-block w-0 h-[1em]' : 'chalk-caret'} />}
                  </div>
                );
              })}
              <div className="absolute pointer-events-none transition-all duration-150 ease-linear" style={{ left: chalkAt.left, top: chalkAt.top }}>
                <Teacher talking={talking} nod={nod} />
              </div>
            </div>
          ) : (
            cloze && (
              <div className="space-y-3" onClick={(e) => e.stopPropagation()}>
                <div className="font-chalk text-[26px] font-semibold border-b border-white/20 pb-2">{tr(lang, "Tekshiruv: bo'sh joylarni to'ldiring", 'Проверка: заполните пропуски')}</div>
                <p className="leading-loose">
                  {cloze.parts.map((p, i) =>
                    typeof p === 'string' ? (
                      <span key={i}>{p}</span>
                    ) : checked ? (
                      <span key={i} className={sameAnswer(answers[p.blank] ?? '', cloze.answers[p.blank]) ? 'text-emerald-300 underline' : 'text-rose-300'}>
                        {sameAnswer(answers[p.blank] ?? '', cloze.answers[p.blank]) ? cloze.answers[p.blank] : `${answers[p.blank] || '—'} → ${cloze.answers[p.blank]}`}
                      </span>
                    ) : (
                      <input
                        key={i}
                        value={answers[p.blank] ?? ''}
                        onChange={(e) => setAnswers((a) => Object.assign([...a], { [p.blank]: e.target.value }))}
                        aria-label={tr(lang, `${p.blank + 1}-bo'sh joy`, `Пропуск ${p.blank + 1}`)}
                        className="mx-1 w-28 px-2 bg-transparent border-b-2 border-dashed border-[#eef2e6]/60 text-[#fde68a] focus:outline-none text-[17px] font-semibold"
                        autoCapitalize="none"
                        autoCorrect="off"
                      />
                    )
                  )}
                </p>
              </div>
            )
          )}
          <div ref={boardEnd} />
        </div>
      </div>

      {phase === 'teach' ? (
        <>
          <div className="flex items-center justify-center gap-3">
            <Button variant="outline" size="md" onClick={() => goStep(step - 1)} disabled={step === 0} aria-label={tr(lang, 'Orqaga', 'Назад')} icon={<SkipBack size={18} />} />
            <Button
              variant="primary"
              size="md"
              className="px-6"
              onClick={() => {
                if (playing) {
                  speech.stop();
                  setTalking(false);
                }
                setPlaying((p) => !p);
              }}
              icon={playing ? <Pause size={18} /> : <Play size={18} />}
            >
              {playing ? tr(lang, "To'xtatish", 'Пауза') : tr(lang, 'Davom', 'Дальше')}
            </Button>
            <Button variant="outline" size="md" onClick={tapBoard} aria-label={tr(lang, 'Oldinga', 'Вперёд')} icon={<SkipForward size={18} />} />
          </div>
          <div className="flex items-center justify-center gap-1.5">
            {(['slow', 'normal', 'fast'] as BoardSpeed[]).map((s) => (
              <button
                key={s}
                onClick={() => changeSpeed(s)}
                className={`px-3 py-1 rounded-full text-xs font-bold border ${speed === s ? 'border-primary bg-primary/15 text-primary' : 'border-border text-muted-foreground'}`}
              >
                {s === 'slow' ? tr(lang, 'Sekin', 'Медленно') : s === 'normal' ? tr(lang, 'Oddiy', 'Обычно') : tr(lang, 'Tez', 'Быстро')}
              </button>
            ))}
          </div>
          {!speech.available && (
            <p className="text-xs text-center text-muted-foreground">
              {tr(lang, "Telefoningizda bu til uchun ovoz yo'q: doska o'zi yozib boradi. Doskani bossangiz, keyingisiga o'tadi.", 'На телефоне нет голоса для этого языка: доска пишет сама. Нажмите на доску, чтобы перейти дальше.')}
            </p>
          )}
        </>
      ) : !checked ? (
        <Button variant="primary" size="lg" className="w-full" icon={<Check size={16} />} disabled={!answers.some((a) => a?.trim())} onClick={check}>
          {tr(lang, 'Tekshirish', 'Проверить')}
        </Button>
      ) : (
        <Button variant="primary" size="lg" className="w-full" icon={<ChevronRight size={16} />} onClick={nextQuestion}>
          {index + 1 < queue.length ? tr(lang, 'Keyingi savol', 'Следующий вопрос') : tr(lang, 'Yakunlash', 'Завершить')}
        </Button>
      )}
    </div>
  );
};
