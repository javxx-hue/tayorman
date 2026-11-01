import React, { useState } from 'react';
import { StudySet, StudySetType } from '../../../../src/types';
import { newId } from '../../../../src/lib/storage';
import { generateStudySet, describeGenerationError } from '../../../../src/lib/ai';
import { ACCEPTED_FILES, buildMaterialContext, materialFromFile } from '../../../../src/lib/materials';
import { parseExamQuestionsFromText } from '../../../../src/lib/testParser';
import { publishToLibrary } from '../../../../src/lib/library';
import { Material } from '../../../../src/types';
import { AudiencePicker } from '../../components/AudiencePicker';
import { CardsEditor, QuizEditor } from '../../components/QuestionsEditor';
import { Audience } from '../../lib/audience';
import { checkCards, checkQuiz } from '../../lib/content';
import { Btn, Card } from '../../ui';

const field = 'px-3 py-1.5 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary';
const TYPE_LABEL: Record<'quiz' | 'exam' | 'flashcards', string> = { quiz: 'Test', exam: 'Imtihon (vaqt bilan)', flashcards: 'Kartalar' };

interface Props {
  initial?: StudySet;
  initialAudience?: Audience;
  initialDraft?: boolean;
  groups: { id: string; name: string }[];
  onClose: () => void;
  onSaved: () => void;
}

// New test from files (AI) or from pasted Word/Hemis text; or edit one that exists. Then choose who gets it.
export const SetBuilder: React.FC<Props> = ({ initial, initialAudience, initialDraft, groups, onClose, onSaved }) => {
  const [doc, setDoc] = useState<StudySet | null>(initial ?? null);
  const [source, setSource] = useState<'file' | 'text'>('file');
  const [title, setTitle] = useState(initial?.title ?? '');
  const [type, setType] = useState<'quiz' | 'exam' | 'flashcards'>('quiz');
  const [count, setCount] = useState(15);
  const [lang, setLang] = useState<'uz' | 'ru'>('uz');
  const [files, setFiles] = useState<File[]>([]);
  const [pasted, setPasted] = useState('');
  const [audience, setAudience] = useState<Audience>(initialAudience ?? { all: false, groups: [] });
  const [draft, setDraft] = useState(initialDraft ?? false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const fail = (e: unknown) => setError(describeGenerationError(e, 'uz'));

  const fromFiles = async () => {
    setError(null);
    setNotice(null);
    if (!files.length) return setError('Avval fayl tanlang.');
    setBusy('Fayllar o\'qilmoqda...');
    try {
      const materials: Material[] = [];
      for (const f of files) {
        try {
          materials.push(await materialFromFile(f));
        } catch (e) {
          setError(`${f.name}: ${describeGenerationError(e, 'uz')}`);
        }
      }
      if (!materials.length) return;
      setBusy('AI savollarni tuzmoqda (1-2 daqiqa)...');
      const set = await generateStudySet({
        rawContent: buildMaterialContext(materials),
        sourceType: 'text',
        targetType: type as StudySetType,
        title: title.trim() || undefined,
        count,
        difficulty: 'medium',
        language: lang,
      });
      setDoc({ ...set, title: title.trim() || set.title });
      setNotice("Tayyor. Pastda tekshirib, kerak bo'lsa tuzating.");
    } catch (e) {
      fail(e);
    } finally {
      setBusy(null);
    }
  };

  const fromText = () => {
    setError(null);
    setNotice(null);
    const { questions, skipped } = parseExamQuestionsFromText(pasted);
    if (!questions.length) return setError("Savol topilmadi. To'g'ri javob oldiga + qo'ying yoki «Javob: C» deb yozing.");
    const now = Date.now();
    setDoc({
      id: newId('set'),
      title: title.trim() || 'Yangi test',
      type: type === 'flashcards' ? 'quiz' : type,
      description: '',
      createdAt: now,
      itemCount: questions.length,
      difficulty: 'medium',
      sourceType: 'text',
      questions,
    });
    setNotice(`${questions.length} ta savol o'qildi${skipped ? `, ${skipped} tasida to'g'ri javob belgilanmagan (o'tkazildi)` : ''}.`);
  };

  const save = async () => {
    if (!doc) return;
    setError(null);
    const isCards = doc.type === 'flashcards';
    const checked = isCards ? checkCards(doc.flashcards ?? []) : checkQuiz(doc.questions ?? []);
    if (!checked.ok) return setError(checked.error);
    if (!doc.title.trim()) return setError('Nomini yozing.');
    if (!draft && !audience.all && !audience.groups.length) return setError("Kimga ochilishini tanlang yoki qoralama sifatida saqlang.");

    const final: StudySet = {
      ...doc,
      title: doc.title.trim(),
      updatedAt: Date.now(),
      itemCount: checked.value.length,
      ...(isCards ? { flashcards: checked.value as StudySet['flashcards'] } : { questions: checked.value as StudySet['questions'] }),
    };
    setBusy('Saqlanmoqda...');
    try {
      await publishToLibrary({ kind: 'set', doc: final, audienceAll: audience.all, communityIds: audience.groups, published: !draft });
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
        <h2 className="text-lg font-serif font-bold">{initial ? 'Testni tahrirlash' : 'Yangi test'}</h2>
        <Btn onClick={onClose}>Bekor qilish</Btn>
      </div>

      {!doc && (
        <Card title="1. Savollar qayerdan?">
          <div className="space-y-3">
            <div className="flex gap-2">
              {(['file', 'text'] as const).map((s) => (
                <button key={s} onClick={() => setSource(s)} className={`px-3 py-1.5 rounded-full text-xs font-semibold border ${source === s ? 'bg-primary text-primary-foreground border-primary' : 'border-border text-muted-foreground'}`}>
                  {s === 'file' ? 'Fayldan (AI tuzadi)' : 'Tayyor matndan (Word / Hemis)'}
                </button>
              ))}
            </div>
            <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} placeholder="Nomi (bo'sh qoldirsangiz AI o'ylab topadi)" className={`${field} w-full`} />
            <div className="flex flex-wrap gap-3 items-center text-sm">
              <select value={type} onChange={(e) => setType(e.target.value as typeof type)} className={field}>
                {(Object.keys(TYPE_LABEL) as (keyof typeof TYPE_LABEL)[])
                  .filter((k) => source === 'file' || k !== 'flashcards')
                  .map((k) => <option key={k} value={k}>{TYPE_LABEL[k]}</option>)}
              </select>
              {source === 'file' && (
                <>
                  <label className="flex items-center gap-1.5">Soni <input type="number" min={5} max={50} value={count} onChange={(e) => setCount(Math.min(50, Math.max(5, Number(e.target.value) || 5)))} className={`${field} w-20`} /></label>
                  <select value={lang} onChange={(e) => setLang(e.target.value as 'uz' | 'ru')} className={field}>
                    <option value="uz">O'zbekcha</option>
                    <option value="ru">Ruscha</option>
                  </select>
                </>
              )}
            </div>

            {source === 'file' ? (
              <div className="space-y-2">
                <input type="file" multiple accept={ACCEPTED_FILES} onChange={(e) => setFiles(Array.from(e.target.files ?? []))} className="text-sm" />
                <p className="text-xs text-muted-foreground">PDF, PowerPoint, Word, TXT yoki konspekt rasmi. PDF va rasmni o'qish ham AI limitidan sarflaydi.</p>
                <Btn tone="primary" disabled={!!busy || !files.length} onClick={fromFiles}>AI bilan tuzish</Btn>
              </div>
            ) : (
              <div className="space-y-2">
                <textarea value={pasted} rows={10} onChange={(e) => setPasted(e.target.value)} className={`${field} w-full font-mono`} placeholder={"1. Savol matni?\n+To'g'ri javob\nBoshqa variant\nBoshqa variant\nBoshqa variant\n\n2. Keyingi savol?\nA) bir\nB) ikki\nC) uch\nJavob: B"} />
                <p className="text-xs text-muted-foreground">To'g'ri javob oldiga <b>+</b> qo'ying yoki oxiriga «Javob: C» deb yozing. Savollar orasiga bo'sh qator qoldiring. AI sarflanmaydi.</p>
                <Btn tone="primary" disabled={!pasted.trim()} onClick={fromText}>Savollarni o'qish</Btn>
              </div>
            )}
          </div>
        </Card>
      )}

      {busy && <p className="text-sm text-muted-foreground" role="status">{busy}</p>}
      {notice && <p className="text-sm text-emerald-600" role="status">{notice}</p>}
      {error && <p className="text-sm text-rose-600" role="alert">{error}</p>}

      {doc && (
        <>
          <Card title={initial ? 'Savollar' : '2. Tekshirib tuzating'}>
            <div className="space-y-3">
              <input value={doc.title} onChange={(e) => setDoc({ ...doc, title: e.target.value })} maxLength={300} placeholder="Nomi" className={`${field} w-full`} />
              {doc.type === 'flashcards' ? (
                <CardsEditor cards={doc.flashcards ?? []} onChange={(flashcards) => setDoc({ ...doc, flashcards })} />
              ) : (
                <QuizEditor questions={doc.questions ?? []} onChange={(questions) => setDoc({ ...doc, questions })} />
              )}
            </div>
          </Card>

          <Card title={initial ? 'Kimga ochiq' : '3. Kimga ochiladi'}>
            <div className="space-y-3">
              <AudiencePicker groups={groups} value={audience} onChange={setAudience} allowAll />
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={draft} onChange={(e) => setDraft(e.target.checked)} /> Qoralama (talabalarga hali ko'rsatilmaydi)
              </label>
              <Btn tone="primary" disabled={!!busy} onClick={save}>{draft ? 'Qoralamani saqlash' : 'Saqlash va nashr qilish'}</Btn>
            </div>
          </Card>
        </>
      )}
    </div>
  );
};
