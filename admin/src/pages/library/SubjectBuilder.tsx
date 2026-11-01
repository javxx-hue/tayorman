import React, { useEffect, useState } from 'react';
import { ExamFormat, Material, Subject } from '../../../../src/types';
import { newId } from '../../../../src/lib/storage';
import { describeGenerationError } from '../../../../src/lib/ai';
import { ACCEPTED_FILES, materialFromFile } from '../../../../src/lib/materials';
import { publishToLibrary } from '../../../../src/lib/library';
import { AudiencePicker } from '../../components/AudiencePicker';
import { Audience } from '../../lib/audience';
import { listAsText, questionsAsText, questionsKeepingAnswers } from '../../lib/content';
import { questionsFromMaterials, Mode } from '../../lib/sourceQuestions';
import { parseQuestionList } from '../../../../src/lib/prep';
import { Btn, Card } from '../../ui';

const field = 'px-3 py-1.5 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary';
const FORMAT: Record<ExamFormat, string> = { test: 'Test', written: 'Yozma', oral: "Og'zaki", mixed: 'Aralash' };

interface Props {
  initial?: Subject;
  initialAudience?: Audience;
  initialDraft?: boolean;
  presetFiles?: File[]; // source files that came with a student's request
  groups: { id: string; name: string }[];
  onClose: () => void;
  onSaved: () => void;
}

// A subject: name, exam date, the teacher's list of exam questions and the lecture files the AI grades against
export const SubjectBuilder: React.FC<Props> = ({ initial, initialAudience, initialDraft, presetFiles, groups, onClose, onSaved }) => {
  const [name, setName] = useState(initial?.name ?? '');
  const [examDate, setExamDate] = useState(initial?.examDate ?? '');
  const [format, setFormat] = useState<ExamFormat>(initial?.examFormat ?? 'oral');
  const [questionText, setQuestionText] = useState(initial ? questionsAsText(initial.questions) : '');
  const [materials, setMaterials] = useState<Material[]>(initial?.materials ?? []);
  const [audience, setAudience] = useState<Audience>(initialAudience ?? { all: false, groups: [] });
  const [draft, setDraft] = useState(initialDraft ?? false);
  const [count, setCount] = useState(15);
  const [lang, setLang] = useState<'uz' | 'ru'>('uz');
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const addFiles = async (list: File[]) => {
    if (!list.length) return;
    setError(null);
    setBusy('Fayllar o\'qilmoqda...');
    const added: Material[] = [];
    for (const f of list) {
      try {
        added.push(await materialFromFile(f));
      } catch (e) {
        setError(`${f.name}: ${describeGenerationError(e, 'uz')}`);
      }
    }
    setMaterials((m) => [...m, ...added]);
    setBusy(null);
  };

  // Questions from the lecture files: the list a document already has, or ones the AI writes. Added to what is typed.
  const fillQuestions = async (mode: Mode) => {
    setError(null);
    setBusy(mode === 'extract' ? 'Fayldan savollar ajratilmoqda...' : 'AI savollar tuzmoqda...');
    try {
      const found = await questionsFromMaterials(materials, { mode, count, language: lang });
      if (!found.length) {
        setError(mode === 'extract' ? "Fayldan savollar ro'yxati topilmadi. «AI bilan tuzish» ni sinab ko'ring." : "AI savol tuza olmadi. Qayta urinib ko'ring.");
        return;
      }
      setQuestionText(listAsText([...parseQuestionList(questionText), ...found]));
    } catch (e) {
      setError(describeGenerationError(e, 'uz'));
    } finally {
      setBusy(null);
    }
  };

  // Files that came with a request are read once, when the form opens
  useEffect(() => {
    if (presetFiles?.length) addFiles(presetFiles);
  }, []);

  const save = async () => {
    setError(null);
    const questions = questionsKeepingAnswers(questionText, initial?.questions ?? []);
    if (!name.trim()) return setError('Fan nomini yozing.');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(examDate)) return setError('Imtihon sanasini tanlang.');
    if (!questions.length) return setError("Imtihon savollari bo'sh. Qo'lda yozing yoki yuqoridagi tugmalar bilan fayldan oling.");
    if (!draft && !audience.all && !audience.groups.length) return setError('Kimga ochilishini tanlang yoki qoralama sifatida saqlang.');

    const now = Date.now();
    const doc: Subject = {
      id: initial?.id ?? newId('sub'),
      name: name.trim(),
      examDate,
      examFormat: format,
      createdAt: initial?.createdAt ?? now,
      updatedAt: now,
      materials,
      questions,
    };
    setBusy('Saqlanmoqda...');
    try {
      await publishToLibrary({ kind: 'subject', doc, audienceAll: audience.all, communityIds: audience.groups, published: !draft });
      onSaved();
    } catch {
      setError("Saqlab bo'lmadi. Qayta urinib ko'ring.");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-serif font-bold">{initial ? 'Fanni tahrirlash' : 'Yangi fan'}</h2>
        <Btn onClick={onClose}>Bekor qilish</Btn>
      </div>

      <Card title="Fan">
        <div className="space-y-3">
          <input value={name} onChange={(e) => setName(e.target.value)} maxLength={200} placeholder="Fan nomi, masalan: Iqtisodiyot nazariyasi" className={`${field} w-full`} />
          <div className="flex flex-wrap gap-3 items-end">
            <label className="text-xs font-semibold text-muted-foreground">Imtihon sanasi<input type="date" value={examDate} onChange={(e) => setExamDate(e.target.value)} className={`${field} block mt-1`} /></label>
            <label className="text-xs font-semibold text-muted-foreground">Shakli
              <select value={format} onChange={(e) => setFormat(e.target.value as ExamFormat)} className={`${field} block mt-1`}>
                {(Object.keys(FORMAT) as ExamFormat[]).map((f) => <option key={f} value={f}>{FORMAT[f]}</option>)}
              </select>
            </label>
          </div>
        </div>
      </Card>

      <Card title={`Ma'ruza materiallari (${materials.length})`}>
        <div className="space-y-2">
          <input type="file" multiple accept={ACCEPTED_FILES} onChange={(e) => { addFiles(Array.from(e.target.files ?? [])); e.target.value = ''; }} className="text-sm" />
          <p className="text-xs text-muted-foreground">AI talabaning javobini shu materiallarga qarab baholaydi. PDF, PowerPoint, Word, TXT yoki rasm.</p>
          {materials.map((m) => (
            <div key={m.id} className="flex items-center justify-between gap-2 text-sm rounded-lg border border-border px-3 py-1.5">
              <span className="truncate">{m.name}</span>
              <span className="text-xs text-muted-foreground shrink-0">{Math.round(m.text.length / 1000)}k belgi</span>
              <Btn tone="danger" onClick={() => setMaterials((list) => list.filter((x) => x.id !== m.id))}>Olib tashlash</Btn>
            </div>
          ))}
        </div>
      </Card>

      <Card title="Imtihon savollari">
        <div className="flex flex-wrap items-center gap-2 mb-3">
          <Btn disabled={!!busy || !materials.length} onClick={() => fillQuestions('extract')}>Fayldagi savollar ro'yxatini olish</Btn>
          <Btn disabled={!!busy || !materials.length} onClick={() => fillQuestions('generate')}>AI bilan savollar tuzish</Btn>
          <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
            Soni <input type="number" min={5} max={50} value={count} onChange={(e) => setCount(Math.min(50, Math.max(5, Number(e.target.value) || 5)))} className={`${field} w-16`} />
          </label>
          <select value={lang} onChange={(e) => setLang(e.target.value as 'uz' | 'ru')} className={field}>
            <option value="uz">O'zbekcha</option>
            <option value="ru">Ruscha</option>
          </select>
        </div>
        {!materials.length && <p className="text-xs text-muted-foreground mb-2">Savollarni fayldan olish uchun avval yuqoridagi «Ma'ruza materiallari» ga fayl qo'shing.</p>}
        {busy && <p className="text-sm text-foreground mb-2 animate-pulse" role="status">⏳ {busy} (bir daqiqagacha cho'zilishi mumkin)</p>}
        {error && <p className="text-sm text-rose-600 mb-2" role="alert">{error}</p>}
        <textarea value={questionText} rows={10} onChange={(e) => setQuestionText(e.target.value)} className={`${field} w-full`} placeholder={"1. Bozor iqtisodiyoti nima?\n2. Talab qonuni...\n\n(o'qituvchi bergan ro'yxatni shu yerga joylashtiring)"} />
        <p className="text-xs text-muted-foreground mt-1">Har bir savol alohida qatorda. Raqamlar bo'lsa ham bo'ladi. O'zgarmagan savollar tayyor javobini saqlab qoladi.</p>
      </Card>

      <Card title="Kimga ochiq">
        <div className="space-y-3">
          <AudiencePicker groups={groups} value={audience} onChange={setAudience} allowAll />
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={draft} onChange={(e) => setDraft(e.target.checked)} /> Qoralama (talabalarga hali ko'rsatilmaydi)
          </label>
          {busy && <p className="text-sm text-muted-foreground" role="status">{busy}</p>}
          {error && <p className="text-sm text-rose-600" role="alert">{error}</p>}
          <Btn tone="primary" disabled={!!busy} onClick={save}>{draft ? 'Qoralamani saqlash' : 'Saqlash va nashr qilish'}</Btn>
        </div>
      </Card>
    </div>
  );
};
