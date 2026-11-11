import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Pause, Play, SkipBack, SkipForward, ChevronRight } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Language, tr } from '../lib/i18n';
import { Subject } from '../types';
import { practiceOrder } from '../lib/prep';
import { boardSteps, readingTime } from '../lib/board';
import { useSpeech } from '../lib/speech';

interface BoardPageProps {
  subjects: Subject[];
  lang: Language;
}

export const BOARD_SITTING = 10;

// The board: one exam question at a time, its model answer written up step by step and read aloud by the phone
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
  const [playing, setPlaying] = useState(true);
  const boardEnd = useRef<HTMLDivElement>(null);

  const question = queue[index];
  const steps = useMemo(() => (question ? boardSteps(question) : []), [question]);
  const last = step >= steps.length - 1;

  // Playing: read the step aloud (or wait long enough to read it), then show the next one
  useEffect(() => {
    if (!playing || !steps[step]) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const next = () => (last ? setPlaying(false) : setStep((s) => s + 1));
    if (speech.available) speech.speak(steps[step].text, () => (timer = setTimeout(next, 400)));
    else timer = setTimeout(next, readingTime(steps[step].text));
    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [playing, step, steps]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => boardEnd.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }), [step]);
  useEffect(() => () => speech.stop(), []); // eslint-disable-line react-hooks/exhaustive-deps

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

  const go = (to: number) => {
    speech.stop();
    setStep(Math.max(0, Math.min(steps.length - 1, to)));
  };
  const nextQuestion = () => {
    speech.stop();
    setIndex((i) => i + 1);
    setStep(0);
    setPlaying(true);
  };
  const number = subject.questions.findIndex((q) => q.id === question.id) + 1;

  return (
    <div className="max-w-2xl mx-auto px-4 pt-5 pb-8 space-y-4">
      <div className="flex items-center justify-between">
        <button onClick={back} className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1">
          <ArrowLeft size={14} /> {subject.name}
        </button>
        <span className="text-xs text-muted-foreground">
          {tr(lang, `${number}-bilet`, `Билет ${number}`)}
          {queue.length > 1 && ` · ${index + 1} / ${queue.length}`}
        </span>
      </div>

      {/* The board itself */}
      <div className="rounded-3xl border-4 border-[#5b4636] bg-[#1f3a2f] p-5 min-h-[55vh] max-h-[62vh] overflow-y-auto shadow-[inset_0_0_40px_rgba(0,0,0,0.45)]">
        <div className="space-y-3">
          {steps.slice(0, step + 1).map((s, i) => (
            <div
              key={i}
              className={`board-in ${i === step ? 'text-[#fff6c8]' : 'text-white/85'} ${
                s.kind === 'title' ? 'text-lg font-extrabold border-b border-white/20 pb-2' : s.kind === 'point' ? 'text-sm font-bold pl-3 border-l-2 border-[#fff6c8]/60' : 'text-[15px] leading-relaxed'
              }`}
            >
              {s.kind === 'point' && '✔ '}
              {s.text}
            </div>
          ))}
          <div ref={boardEnd} />
        </div>
      </div>

      <div className="flex items-center justify-center gap-3">
        <Button variant="outline" size="md" onClick={() => go(step - 1)} disabled={step === 0} aria-label={tr(lang, 'Orqaga', 'Назад')} icon={<SkipBack size={18} />} />
        <Button
          variant="primary"
          size="md"
          className="px-6"
          onClick={() => {
            if (playing) speech.stop();
            setPlaying((p) => !p);
          }}
          icon={playing ? <Pause size={18} /> : <Play size={18} />}
        >
          {playing ? tr(lang, "To'xtatish", 'Пауза') : tr(lang, 'Davom', 'Дальше')}
        </Button>
        <Button variant="outline" size="md" onClick={() => go(step + 1)} disabled={last} aria-label={tr(lang, 'Oldinga', 'Вперёд')} icon={<SkipForward size={18} />} />
      </div>

      {!speech.available && (
        <p className="text-xs text-center text-muted-foreground">{tr(lang, "Telefoningizda bu til uchun ovoz yo'q: doska o'zi sekin yozib boradi.", 'На телефоне нет голоса для этого языка: доска пишет сама, не спеша.')}</p>
      )}

      {last && (
        <Button variant="primary" size="lg" className="w-full" icon={<ChevronRight size={16} />} onClick={queue.length > index + 1 ? nextQuestion : back}>
          {queue.length > index + 1 ? tr(lang, 'Keyingi savol', 'Следующий вопрос') : tr(lang, 'Yakunlash', 'Завершить')}
        </Button>
      )}
    </div>
  );
};
