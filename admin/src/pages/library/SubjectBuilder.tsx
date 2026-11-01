import React, { useState } from 'react';
import { ExamFormat, Material, Subject } from '../../../../src/types';
import { newId } from '../../../../src/lib/storage';
import { describeGenerationError } from '../../../../src/lib/ai';
import { ACCEPTED_FILES, materialFromFile } from '../../../../src/lib/materials';
import { publishToLibrary } from '../../../../src/lib/library';
import { AudiencePicker } from '../../components/AudiencePicker';
import { Audience } from '../../lib/audience';
import { questionsAsText, questionsKeepingAnswers } from '../../lib/content';
import { Btn, Card } from '../../ui';

const field = 'px-3 py-1.5 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary';
const FORMAT: Record<ExamFormat, string> = { test: 'Test', written: 'Yozma', oral: "Og'zaki", mixed: 'Aralash' };

interface Props {
  initial?: Subject;
  initialAudience?: Audience;
  initialDraft?: boolean;
  groups: { id: string; name: string }[];
  onClose: () => void;
  onSaved: () => void;
}

// A subject: name, exam date, the teacher's list of exam questions and the lecture files the AI grades against
export const SubjectBuilder: React.FC<Props> = ({ initial, initialAudience, initialDraft, groups, onClose, onSaved }) => {
  const [name, setName] = useState(initial?.name ?? '');
  const [examDate, setExamDate] = useState(initial?.examDate ?? '');
  const [format, setFormat] = useState<ExamFormat>(initial?.examFormat ?? 'oral');
  const [questionText, setQuestionText] = useState(initial ? questionsAsText(initial.questions) : '');
  const [materials, setMaterials] = useState<Material[]>(initial?.materials ?? []);
  const [audience, setAudience] = useState<Audience>(initialAudience ?? { all: false, groups: [] });
  const [draft, setDraft] = useState(initialDraft ?? false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const addFiles = async (list: FileList | null) => {
    if (!list?.length) return;
    setError(null);
    setBusy('Fayllar o\'qilmoqda...');
    const added: Material[] = [];
    for (const f of Array.from(list)) {
      try {
        added.push(await materialFromFile(f));
      } catch (e) {
        setError(`${f.name}: ${describeGenerationError(e, 'uz')}`);
      }
    }
    setMaterials((m) => [...m, ...added]);
    setBusy(null);
  };

  const save = async () => {
    setError(null);
    const questions = questionsKeepingAnswers(questionText, initial?.questions ?? []);
    if (!name.trim()) return setError('Fan nomini yozing.');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(examDate)) return setError('Imtihon sanasini tanlang.');
    if (!questions.length) return setError("Imtihon savollarini yozing (har biri alohida qatorda).");
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

      <Card title="Imtihon savollari">
        <textarea value={questionText} rows={10} onChange={(e) => setQuestionText(e.target.value)} className={`${field} w-full`} placeholder={"1. Bozor iqtisodiyoti nima?\n2. Talab qonuni...\n\n(o'qituvchi bergan ro'yxatni shu yerga joylashtiring)"} />
        <p className="text-xs text-muted-foreground mt-1">Har bir savol alohida qatorda. Raqamlar bo'lsa ham bo'ladi. O'zgarmagan savollar tayyor javobini saqlab qoladi.</p>
      </Card>

      <Card title={`Ma'ruza materiallari (${materials.length})`}>
        <div className="space-y-2">
          <input type="file" multiple accept={ACCEPTED_FILES} onChange={(e) => { addFiles(e.target.files); e.target.value = ''; }} className="text-sm" />
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
