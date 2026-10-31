import React, { useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft, CalendarDays, FileText, Upload, Youtube, Trash2, Sparkles, ListChecks, Play, Pencil,
  CheckCircle2, Loader2, Layers, HelpCircle, Timer, Image as ImageIcon, Presentation,
} from 'lucide-react';
import { Button } from '../components/ui/Button';
import { toast } from '../components/ui/Toast';
import { Language } from '../lib/i18n';
import { Material, StudySet, StudySetType, Subject } from '../types';
import { track } from '../lib/track';
import { saveSubject, deleteSubject, saveStudySet, getSubjectById, StorageFullError } from '../lib/storage';
import { ACCEPTED_FILES, buildMaterialContext, materialFromFile, materialFromYouTube } from '../lib/materials';
import { generateModelAnswer, planSubject, questionScore, questionsFromText, scoreToGrade, subjectReadiness, daysUntil, PASS_SCORE } from '../lib/prep';
import { describeGenerationError, generateStudySet } from '../lib/ai';
import { getYouTubeInfo } from '../lib/youtubeParser';
import { SubjectForm, FORMAT_LABELS, daysLeftLabel, readinessColor } from './SubjectsPage';

type Tab = 'plan' | 'questions' | 'materials' | 'practice';

function describeError(e: unknown, lang: Language): string {
  if (e instanceof StorageFullError) {
    return lang === 'uz'
      ? 'Brauzer xotirasi to\'ldi. Eski materiallarni o\'chiring yoki hisobga kiring (bulutda saqlanadi).'
      : 'Память устройства заполнена. Удалите старые материалы.';
  }
  return describeGenerationError(e, lang);
}

const MATERIAL_ICONS: Record<Material['kind'], React.ReactNode> = {
  pdf: <FileText size={16} />,
  pptx: <Presentation size={16} />,
  image: <ImageIcon size={16} />,
  text: <FileText size={16} />,
  youtube: <Youtube size={16} className="text-red-500" />,
};

interface SubjectPageProps {
  subjects: Subject[];
  studySets: StudySet[];
  lang: Language;
}

export const SubjectPage: React.FC<SubjectPageProps> = ({ subjects, studySets, lang }) => {
  const { id } = useParams();
  const navigate = useNavigate();
  const isUz = lang === 'uz';
  const subject = subjects.find((s) => s.id === id);

  const [tab, setTab] = useState<Tab>('plan');
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null); // label of the running task
  const [questionDraft, setQuestionDraft] = useState('');
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [pasteText, setPasteText] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  if (!subject) {
    return (
      <div className="max-w-md mx-auto px-4 py-24 text-center space-y-4">
        <h2 className="text-2xl font-serif font-bold text-foreground">{isUz ? 'Fan topilmadi' : 'Предмет не найден'}</h2>
        <Button variant="primary" onClick={() => navigate('/subjects')}>{isUz ? 'Fanlarga qaytish' : 'К предметам'}</Button>
      </div>
    );
  }

  const days = daysUntil(subject.examDate);
  const plan = planSubject(subject);
  const readiness = subjectReadiness(subject, studySets);
  const ownSets = studySets.filter((s) => s.subjectId === subject.id);

  // Re-read from storage before every write: long tasks (answers one by one)
  // would otherwise overwrite each other with the state captured at render
  const update = (fn: (s: Subject) => Subject) => {
    const latest = getSubjectById(subject.id);
    if (latest) saveSubject(fn(latest));
  };

  const run = async (label: string, task: () => Promise<void>) => {
    setBusy(label);
    try {
      await task();
    } catch (e) {
      console.error(label, e);
      toast.error(describeError(e, lang));
    } finally {
      setBusy(null);
    }
  };

  // ---------------- Materials ----------------
  const addMaterials = (materials: Material[]) => update((s) => ({ ...s, materials: [...s.materials, ...materials] }));

  const handleFiles = (files: FileList | null) => {
    if (!files?.length) return;
    const list = Array.from(files);
    run(isUz ? 'Materiallar o\'qilmoqda' : 'Читаем материалы', async () => {
      const added: Material[] = [];
      for (const file of list) {
        try {
          added.push(await materialFromFile(file));
        } catch (e) {
          toast.error(`${file.name}: ${describeError(e, lang)}`);
        }
      }
      if (added.length) {
        addMaterials(added);
        toast.success(isUz ? `${added.length} ta material qo'shildi` : `Добавлено материалов: ${added.length}`);
      }
    });
  };

  const handleYouTube = () => {
    if (!getYouTubeInfo(youtubeUrl)) {
      toast.error(isUz ? 'YouTube havolasi noto\'g\'ri' : 'Неверная ссылка YouTube');
      return;
    }
    run(isUz ? 'Video ko\'rib chiqilmoqda' : 'Смотрим видео', async () => {
      addMaterials([await materialFromYouTube(youtubeUrl)]);
      setYoutubeUrl('');
      toast.success(isUz ? 'Video konspekti qo\'shildi' : 'Конспект видео добавлен');
    });
  };

  const handlePasteText = () => {
    if (pasteText.trim().length < 20) return;
    addMaterials([
      { id: `mat-${Date.now()}`, name: isUz ? 'Kiritilgan matn' : 'Вставленный текст', kind: 'text', text: pasteText.trim(), createdAt: Date.now() },
    ]);
    setPasteText('');
  };

  const removeMaterial = (materialId: string) => update((s) => ({ ...s, materials: s.materials.filter((m) => m.id !== materialId) }));

  // ---------------- Questions ----------------
  const handleAddQuestions = () => {
    const qs = questionsFromText(questionDraft);
    if (!qs.length) {
      toast.error(isUz ? 'Savol topilmadi' : 'Вопросы не найдены');
      return;
    }
    update((s) => ({ ...s, questions: [...s.questions, ...qs] }));
    track('questions_added');
    setQuestionDraft('');
    toast.success(isUz ? `${qs.length} ta savol qo'shildi` : `Добавлено вопросов: ${qs.length}`);
  };

  const removeQuestion = (qid: string) => update((s) => ({ ...s, questions: s.questions.filter((q) => q.id !== qid) }));

  const prepareAnswers = (ids: string[]) => {
    if (!subject.materials.length) {
      toast.error(isUz ? 'Avval ma\'ruza materiallarini yuklang' : 'Сначала загрузите материалы лекций');
      setTab('materials');
      return;
    }
    run(isUz ? 'Javoblar tayyorlanmoqda' : 'Готовим ответы', async () => {
      let done = 0;
      for (const qid of ids) {
        const question = subject.questions.find((q) => q.id === qid);
        if (!question) continue;
        setBusy(isUz ? `Javoblar tayyorlanmoqda (${done + 1}/${ids.length})` : `Готовим ответы (${done + 1}/${ids.length})`);
        const modelAnswer = await generateModelAnswer(subject, question, lang);
        update((s) => ({ ...s, questions: s.questions.map((q) => (q.id === qid ? { ...q, modelAnswer } : q)) }));
        done++;
      }
      toast.success(isUz ? `${done} ta javob tayyor` : `Готово ответов: ${done}`);
    });
  };

  // ---------------- Quiz / flashcards from all materials ----------------
  const generateFromSubject = (type: StudySetType, count: number) => {
    if (!subject.materials.length) {
      toast.error(isUz ? 'Avval ma\'ruza materiallarini yuklang' : 'Сначала загрузите материалы лекций');
      setTab('materials');
      return;
    }
    run(isUz ? 'AI yaratmoqda' : 'Создаём', async () => {
      const set = await generateStudySet({
        rawContent: buildMaterialContext(subject.materials),
        sourceType: 'text',
        targetType: type,
        title: subject.name,
        count,
        difficulty: 'medium',
        language: lang,
      });
      const linked = { ...set, subjectId: subject.id };
      saveStudySet(linked);
      navigate(`/study/${linked.id}`);
    });
  };

  const handleDelete = () => {
    if (!window.confirm(isUz ? `"${subject.name}" fani o'chirilsinmi?` : `Удалить «${subject.name}»?`)) return;
    deleteSubject(subject.id);
    navigate('/subjects');
  };

  const tabs: { key: Tab; label: string; count?: number }[] = [
    { key: 'plan', label: isUz ? 'Bugun' : 'Сегодня' },
    { key: 'questions', label: isUz ? 'Savollar' : 'Вопросы', count: subject.questions.length },
    { key: 'materials', label: isUz ? 'Materiallar' : 'Материалы', count: subject.materials.length },
    { key: 'practice', label: isUz ? 'Test va kartalar' : 'Тесты и карточки', count: ownSets.length },
  ];

  const textareaClass =
    'w-full p-3.5 rounded-xl border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary resize-y';

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-10">
      <button onClick={() => navigate('/subjects')} className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 mb-4">
        <ArrowLeft size={14} /> {isUz ? 'Fanlarim' : 'Мои предметы'}
      </button>

      {/* Header */}
      <div className="rounded-3xl bg-card border border-border/80 p-5 sm:p-6 shadow-soft mb-6">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-2xl sm:text-3xl font-serif font-bold text-foreground">{subject.name}</h1>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground mt-2">
              <span className="flex items-center gap-1"><CalendarDays size={13} />{subject.examDate} · {daysLeftLabel(days, isUz)}</span>
              <span>{FORMAT_LABELS[subject.examFormat][lang]}</span>
            </div>
          </div>
          <div className="flex gap-2 shrink-0">
            <Button variant="outline" size="sm" icon={<Pencil size={14} />} onClick={() => setIsEditOpen(true)}>{isUz ? 'Tahrirlash' : 'Изменить'}</Button>
            <Button variant="ghost" size="sm" icon={<Trash2 size={14} />} onClick={handleDelete} aria-label={isUz ? 'O\'chirish' : 'Удалить'} />
          </div>
        </div>
        <div className="mt-5">
          <div className="flex justify-between text-xs mb-1">
            <span className="text-muted-foreground">{isUz ? 'Tayyorlik' : 'Готовность'}</span>
            <span className="font-bold text-foreground">{readiness}%</span>
          </div>
          <div className="h-2.5 rounded-full bg-secondary overflow-hidden">
            <div className={`h-full transition-all ${readinessColor(readiness)}`} style={{ width: `${readiness}%` }} />
          </div>
        </div>
      </div>

      {busy && (
        <div className="mb-4 p-3 rounded-xl bg-primary/5 border border-primary/20 text-sm text-foreground flex items-center gap-2" role="status">
          <Loader2 size={16} className="animate-spin" /> {busy}...
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-secondary/80 rounded-xl border border-border/60 mb-6 overflow-x-auto">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-3.5 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all ${
              tab === t.key ? 'bg-card text-foreground shadow-xs font-semibold' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {t.label}{t.count !== undefined ? ` (${t.count})` : ''}
          </button>
        ))}
      </div>

      {/* ---------------- Today ---------------- */}
      {tab === 'plan' && (
        <div className="space-y-4">
          {subject.materials.length === 0 || subject.questions.length === 0 ? (
            <div className="rounded-2xl border border-border bg-card p-5 space-y-3">
              <h3 className="font-serif font-bold text-lg text-foreground">{isUz ? 'Boshlash uchun 2 qadam' : '2 шага, чтобы начать'}</h3>
              <button onClick={() => setTab('materials')} className="w-full text-left flex items-center gap-3 p-3 rounded-xl border border-border hover:bg-secondary/50">
                {subject.materials.length ? <CheckCircle2 size={18} className="text-emerald-500" /> : <Upload size={18} />}
                <span className="text-sm">{isUz ? 'Ma\'ruzalar, slaydlar yoki konspekt rasmlarini yuklang' : 'Загрузите лекции, слайды или фото конспектов'}</span>
              </button>
              <button onClick={() => setTab('questions')} className="w-full text-left flex items-center gap-3 p-3 rounded-xl border border-border hover:bg-secondary/50">
                {subject.questions.length ? <CheckCircle2 size={18} className="text-emerald-500" /> : <ListChecks size={18} />}
                <span className="text-sm">{isUz ? 'O\'qituvchi bergan imtihon savollarini kiriting' : 'Вставьте список экзаменационных вопросов от преподавателя'}</span>
              </button>
            </div>
          ) : days < 0 ? (
            <p className="text-sm text-muted-foreground">{isUz ? 'Bu fan imtihoni o\'tib ketgan. Sanani tahrirlang.' : 'Этот экзамен уже прошёл. Измените дату.'}</p>
          ) : (
            <div className="rounded-2xl border border-border bg-card p-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
                <div>
                  <h3 className="font-serif font-bold text-lg text-foreground">
                    {plan.isReviewDay ? (isUz ? 'Ertaga imtihon: umumiy takrorlash' : 'Экзамен завтра: общее повторение') : (isUz ? 'Bugungi savollar' : 'Вопросы на сегодня')}
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    {isUz
                      ? `${plan.remaining} ta savol hali o'zlashtirilmagan (${PASS_SCORE}% dan past). Kuniga ~${plan.perDay} ta.`
                      : `Не выучено вопросов (ниже ${PASS_SCORE}%): ${plan.remaining}. Примерно ${plan.perDay} в день.`}
                  </p>
                </div>
                {plan.today.length > 0 && (
                  <Button variant="primary" size="md" icon={<Play size={15} />} onClick={() => navigate(`/subjects/${subject.id}/q/${plan.today[0].id}`)}>
                    {isUz ? 'Boshlash' : 'Начать'}
                  </Button>
                )}
              </div>
              {plan.today.length === 0 ? (
                <p className="text-sm text-emerald-700 dark:text-emerald-300 font-medium">
                  {isUz ? 'Barcha savollar o\'zlashtirilgan! Test yoki kartalar bilan mustahkamlang.' : 'Все вопросы выучены! Закрепите тестами или карточками.'}
                </p>
              ) : (
                <ol className="space-y-2">
                  {plan.today.map((q) => (
                    <li key={q.id}>
                      <button onClick={() => navigate(`/subjects/${subject.id}/q/${q.id}`)} className="w-full text-left flex items-center justify-between gap-3 p-3 rounded-xl border border-border hover:bg-secondary/50">
                        <span className="text-sm text-foreground">{q.text}</span>
                        <span className="text-xs text-muted-foreground shrink-0">{q.attempts.length ? `${questionScore(q)}%` : isUz ? 'yangi' : 'новый'}</span>
                      </button>
                    </li>
                  ))}
                </ol>
              )}
            </div>
          )}
        </div>
      )}

      {/* ---------------- Questions ---------------- */}
      {tab === 'questions' && (
        <div className="space-y-5">
          <div className="rounded-2xl border border-border bg-card p-5 space-y-3">
            <label className="block text-sm font-semibold text-foreground">{isUz ? 'Imtihon savollari ro\'yxati' : 'Список экзаменационных вопросов'}</label>
            <textarea
              rows={5}
              value={questionDraft}
              onChange={(e) => setQuestionDraft(e.target.value)}
              placeholder={isUz ? '1. Bozor iqtisodiyoti nima?\n2. Talab qonuni...\n\n(o\'qituvchi bergan ro\'yxatni shu yerga joylashtiring)' : '1. Что такое рыночная экономика?\n2. Закон спроса...'}
              className={textareaClass}
            />
            <div className="flex justify-end">
              <Button variant="primary" size="sm" icon={<ListChecks size={14} />} onClick={handleAddQuestions} disabled={!questionDraft.trim()}>
                {isUz ? 'Savollarni qo\'shish' : 'Добавить вопросы'}
              </Button>
            </div>
          </div>

          {subject.questions.length > 0 && (
            <div className="rounded-2xl border border-border bg-card p-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
                <h3 className="font-semibold text-foreground">{subject.questions.length} {isUz ? 'ta savol' : 'вопросов'}</h3>
                {subject.questions.some((q) => !q.modelAnswer) && (
                  <Button
                    variant="outline"
                    size="sm"
                    icon={<Sparkles size={14} />}
                    disabled={!!busy}
                    onClick={() => prepareAnswers(subject.questions.filter((q) => !q.modelAnswer).map((q) => q.id))}
                  >
                    {isUz ? 'Barcha javoblarni tayyorlash' : 'Подготовить все ответы'}
                  </Button>
                )}
              </div>
              <ol className="space-y-2">
                {subject.questions.map((q, i) => {
                  const score = questionScore(q);
                  return (
                    <li key={q.id} className="flex items-center gap-3 p-3 rounded-xl border border-border">
                      <span className="text-xs text-muted-foreground w-6 shrink-0">{i + 1}.</span>
                      <button onClick={() => navigate(`/subjects/${subject.id}/q/${q.id}`)} className="flex-1 text-left text-sm text-foreground hover:underline min-w-0">
                        {q.text}
                      </button>
                      {q.attempts.length > 0 ? (
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-md text-white ${readinessColor(score)}`}>{scoreToGrade(score)} · {score}%</span>
                      ) : q.modelAnswer ? (
                        <span className="text-[11px] text-emerald-700 dark:text-emerald-300">{isUz ? 'javob tayyor' : 'ответ готов'}</span>
                      ) : null}
                      <button onClick={() => removeQuestion(q.id)} className="p-1 text-muted-foreground hover:text-rose-600" aria-label={isUz ? 'O\'chirish' : 'Удалить'}>
                        <Trash2 size={14} />
                      </button>
                    </li>
                  );
                })}
              </ol>
            </div>
          )}
        </div>
      )}

      {/* ---------------- Materials ---------------- */}
      {tab === 'materials' && (
        <div className="space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="rounded-2xl border border-dashed border-border bg-card p-5 flex flex-col items-center justify-center text-center gap-3">
              <Upload size={28} className="text-muted-foreground" />
              <p className="text-sm text-foreground font-medium">PDF, PowerPoint, Word, TXT {isUz ? 'yoki konspekt rasmi' : 'или фото конспектов'}</p>
              <p className="text-xs text-muted-foreground">{isUz ? 'Bir nechta faylni birdan tanlash mumkin. Rasmdagi qo\'lyozmani AI o\'qiydi.' : 'Можно выбрать несколько файлов. ИИ читает рукописный текст на фото.'}</p>
              <input ref={fileRef} type="file" multiple accept={ACCEPTED_FILES} className="hidden" onChange={(e) => { handleFiles(e.target.files); e.target.value = ''; }} />
              <Button variant="primary" size="sm" icon={<Upload size={14} />} onClick={() => fileRef.current?.click()} disabled={!!busy}>
                {isUz ? 'Fayl tanlash' : 'Выбрать файлы'}
              </Button>
            </div>
            <div className="rounded-2xl border border-border bg-card p-5 space-y-3">
              <label className="text-sm font-semibold text-foreground flex items-center gap-1.5"><Youtube size={16} className="text-red-500" /> {isUz ? 'YouTube ma\'ruza' : 'Лекция на YouTube'}</label>
              <input
                value={youtubeUrl}
                onChange={(e) => setYoutubeUrl(e.target.value)}
                placeholder="https://youtube.com/watch?v=..."
                className="w-full px-3.5 py-2.5 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
              <p className="text-xs text-muted-foreground">{isUz ? 'AI videoni ko\'rib chiqib, vaqt belgilari bilan konspekt yozadi.' : 'ИИ посмотрит видео и напишет конспект с таймкодами.'}</p>
              <Button variant="outline" size="sm" onClick={handleYouTube} disabled={!youtubeUrl.trim() || !!busy}>{isUz ? 'Qo\'shish' : 'Добавить'}</Button>
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-card p-5 space-y-3">
            <label className="block text-sm font-semibold text-foreground">{isUz ? 'Yoki matnni joylashtiring' : 'Или вставьте текст'}</label>
            <textarea rows={3} value={pasteText} onChange={(e) => setPasteText(e.target.value)} className={textareaClass} />
            <div className="flex justify-end">
              <Button variant="outline" size="sm" onClick={handlePasteText} disabled={pasteText.trim().length < 20}>{isUz ? 'Qo\'shish' : 'Добавить'}</Button>
            </div>
          </div>

          {subject.materials.length > 0 && (
            <ul className="space-y-2">
              {subject.materials.map((m) => (
                <li key={m.id} className="flex items-center gap-3 p-3 rounded-xl border border-border bg-card">
                  <span className="text-muted-foreground">{MATERIAL_ICONS[m.kind]}</span>
                  <span className="flex-1 text-sm text-foreground truncate">{m.name}</span>
                  <span className="text-xs text-muted-foreground shrink-0">{Math.round(m.text.length / 1000)}k {isUz ? 'belgi' : 'симв.'}</span>
                  <button onClick={() => removeMaterial(m.id)} className="p-1 text-muted-foreground hover:text-rose-600" aria-label={isUz ? 'O\'chirish' : 'Удалить'}>
                    <Trash2 size={14} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* ---------------- Quizzes & cards ---------------- */}
      {tab === 'practice' && (
        <div className="space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {[
              { type: 'quiz' as const, count: 15, icon: <HelpCircle size={18} />, label: isUz ? 'Test (15 savol)' : 'Тест (15 вопросов)' },
              { type: 'flashcards' as const, count: 20, icon: <Layers size={18} />, label: isUz ? 'Flesh-kartalar (20)' : 'Карточки (20)' },
              { type: 'exam' as const, count: 30, icon: <Timer size={18} />, label: isUz ? 'Sinov imtihoni (30)' : 'Пробный экзамен (30)' },
            ].map((g) => (
              <button
                key={g.type}
                disabled={!!busy}
                onClick={() => generateFromSubject(g.type, g.count)}
                className="p-4 rounded-2xl border border-border bg-card hover:border-primary/50 text-left flex items-center gap-3 disabled:opacity-50"
              >
                <span className="w-9 h-9 rounded-xl bg-secondary flex items-center justify-center">{g.icon}</span>
                <span className="text-sm font-semibold text-foreground">{g.label}</span>
              </button>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">{isUz ? 'Barcha materiallaringiz asosida yaratiladi.' : 'Создаётся по всем вашим материалам.'}</p>
          {ownSets.length > 0 && (
            <ul className="space-y-2">
              {ownSets.map((s) => (
                <li key={s.id} className="flex items-stretch gap-2">
                  <button onClick={() => navigate(`/study/${s.id}`)} className="flex-1 min-w-0 text-left flex items-center justify-between gap-3 p-3 rounded-xl border border-border bg-card hover:bg-secondary/50">
                    <span className="text-sm text-foreground truncate">{s.title} · {s.type === 'quiz' ? 'Test' : s.type === 'exam' ? (isUz ? 'Imtihon' : 'Экзамен') : (isUz ? 'Kartalar' : 'Карточки')}</span>
                    <span className="text-xs text-muted-foreground shrink-0">{typeof s.lastScore === 'number' ? `${s.lastScore}%` : `${s.itemCount}`}</span>
                  </button>
                  {(s.type === 'quiz' || s.type === 'exam' || s.type === 'flashcards') && (
                    <button onClick={() => navigate(`/study/${s.id}/edit`)} aria-label={isUz ? 'Tahrirlash' : 'Изменить'} className="px-3 rounded-xl border border-border bg-card text-muted-foreground hover:text-foreground">
                      <Pencil size={14} />
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <SubjectForm key={isEditOpen ? 'edit' : 'closed'} isOpen={isEditOpen} onClose={() => setIsEditOpen(false)} lang={lang} initial={subject} onSaved={() => {}} />
    </div>
  );
};
