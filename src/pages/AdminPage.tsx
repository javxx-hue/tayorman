import React, { useCallback, useEffect, useState } from 'react';
import { Copy, Loader2, Megaphone, Plus, Trash2, Eye, EyeOff } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { toast } from '../components/ui/Toast';
import { Language, tr } from '../lib/i18n';
import { StudySet, Subject, QuizQuestion } from '../types';
import { supabase } from '../lib/supabase';
import { LibraryItem, fetchLibrary, publishToLibrary, unpublish } from '../lib/library';
import { BOT_USERNAME, inviteLink } from '../lib/telegram';
import { useAuth } from '../lib/auth';
import { saveStudySet, saveSubject, newId } from '../lib/storage';
import { parseExamQuestionsFromText } from '../lib/testParser';
import { materialFromFile } from '../lib/materials';

type Tab = 'stats' | 'import' | 'groups' | 'library' | 'broadcast';
interface Community { id: string; name: string; kind: string; invite_code: string }
interface Stats {
  users_total: number; users_samdu: number; users_new_7d: number; active_today: number; active_7d: number;
  ai_today: number; ai_7d: number; subjects_total: number; library_items: number;
  by_university: Record<string, number>; by_community: { name: string; members: number }[];
}

const input =
  'w-full px-3 py-2 rounded-xl border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary';
const card = 'rounded-2xl border border-border bg-card p-4';

// Audience picker shared by publishing and broadcasting
const AudiencePicker: React.FC<{
  lang: Language; all: boolean; ids: string[]; communities: Community[];
  onChange: (all: boolean, ids: string[]) => void;
}> = ({ lang, all, ids, communities, onChange }) => (
  <div className="space-y-1.5">
    <label className="flex items-center gap-2 text-sm">
      <input type="checkbox" checked={all} onChange={(e) => onChange(e.target.checked, ids)} />
      {tr(lang, 'Hamma foydalanuvchilar', 'Все пользователи')}
    </label>
    {!all &&
      (communities.length === 0 ? (
        <p className="text-xs text-muted-foreground">{tr(lang, 'Avval «Guruhlar» bo\'limida guruh yarating.', 'Сначала создайте группу в разделе «Группы».')}</p>
      ) : (
        communities.map((c) => (
          <label key={c.id} className="flex items-center gap-2 text-sm pl-4">
            <input type="checkbox" checked={ids.includes(c.id)} onChange={(e) => onChange(all, e.target.checked ? [...ids, c.id] : ids.filter((x) => x !== c.id))} />
            {c.name}
          </label>
        ))
      ))}
  </div>
);

export const AdminPage: React.FC<{ subjects: Subject[]; studySets: StudySet[]; lang: Language }> = ({ subjects, studySets, lang }) => {
  const { isAdmin } = useAuth();
  const [tab, setTab] = useState<Tab>('stats');
  const [stats, setStats] = useState<Stats | null>(null);
  const [communities, setCommunities] = useState<Community[]>([]);
  const [library, setLibrary] = useState<LibraryItem[]>([]);
  const [busy, setBusy] = useState(false);

  // groups
  const [groupName, setGroupName] = useState('');
  const [groupKind, setGroupKind] = useState('group');
  // publish
  const [pubKey, setPubKey] = useState(''); // "subject:<id>" or "set:<id>"
  const [pubAll, setPubAll] = useState(true);
  const [pubIds, setPubIds] = useState<string[]>([]);
  // broadcast
  const [text, setText] = useState('');
  const [bcAll, setBcAll] = useState(true);
  const [bcIds, setBcIds] = useState<string[]>([]);

  // bulk test import
  const [importSubjectId, setImportSubjectId] = useState('');
  const [newSubjectName, setNewSubjectName] = useState('');
  const [importTitle, setImportTitle] = useState('');
  const [rawText, setRawText] = useState('');
  const [parsedQuestions, setParsedQuestions] = useState<QuizQuestion[]>([]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    try {
      if (file.name.endsWith('.txt') || file.name.endsWith('.json')) {
        const t = await file.text();
        setRawText(t);
        const { questions: qs } = parseExamQuestionsFromText(t);
        setParsedQuestions(qs);
        if (!importTitle) setImportTitle(file.name.replace(/\.[^/.]+$/, ''));
        toast.success(tr(lang, `${qs.length} ta savol topildi`, `Найдено ${qs.length} вопросов`));
      } else {
        const mat = await materialFromFile(file);
        setRawText(mat.text);
        const { questions: qs } = parseExamQuestionsFromText(mat.text);
        setParsedQuestions(qs);
        if (!importTitle) setImportTitle(file.name.replace(/\.[^/.]+$/, ''));
        toast.success(tr(lang, `${qs.length} ta savol topildi`, `Найдено ${qs.length} вопросов`));
      }
    } catch {
      toast.error(tr(lang, 'Faylni o\'qishda xatolik', 'Ошибка чтения файла'));
    } finally {
      setBusy(false);
    }
  };

  const handleParse = () => {
    const { questions: qs } = parseExamQuestionsFromText(rawText);
    setParsedQuestions(qs);
    if (qs.length === 0) {
      toast.error(tr(lang, 'Savollar topilmadi. Formatni tekshiring.', 'Вопросы не найдены.'));
    } else {
      toast.success(tr(lang, `${qs.length} ta savol topildi`, `Найдено ${qs.length} вопросов`));
    }
  };

  const handleSaveImportedSet = () => {
    if (parsedQuestions.length === 0) {
      toast.error(tr(lang, 'Avval savollarni tahlil qiling', 'Сначала проанализируйте вопросы'));
      return;
    }
    let targetSubjectId = importSubjectId;
    if (targetSubjectId === '__new__') {
      if (!newSubjectName.trim()) {
        toast.error(tr(lang, 'Yangi fan nomini kiriting', 'Введите название предмета'));
        return;
      }
      const newSub: Subject = {
        id: newId('subj'),
        name: newSubjectName.trim(),
        examDate: '',
        examFormat: 'test',
        materials: [],
        questions: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      saveSubject(newSub);
      targetSubjectId = newSub.id;
    }

    const title = importTitle.trim() || `Test to'plami (${parsedQuestions.length} ta)`;
    const newSet: StudySet = {
      id: newId('set'),
      title,
      type: 'exam',
      description: `${parsedQuestions.length} ta test savolidan iborat imtihon simulyatori.`,
      createdAt: Date.now(),
      itemCount: parsedQuestions.length,
      difficulty: 'medium',
      sourceType: 'text',
      questions: parsedQuestions,
      subjectId: targetSubjectId || undefined,
    };

    saveStudySet(newSet);
    toast.success(tr(lang, "To'plam muvaffaqiyatli saqlandi!", 'Набор успешно сохранен!'));
    setRawText('');
    setParsedQuestions([]);
    setImportTitle('');
    setNewSubjectName('');
    setImportSubjectId('');
  };

  const reload = useCallback(async () => {
    if (!supabase) return;
    const [s, c, l] = await Promise.all([
      supabase.rpc('admin_stats'),
      supabase.from('communities').select('*').order('created_at', { ascending: false }),
      fetchLibrary(),
    ]);
    if (s.data) setStats(s.data as Stats);
    setCommunities((c.data ?? []) as Community[]);
    setLibrary(l);
  }, []);

  useEffect(() => {
    if (isAdmin) reload().catch(() => toast.error(tr(lang, 'Yuklab bo\'lmadi', 'Не удалось загрузить')));
  }, [isAdmin, reload]);

  if (!isAdmin) return <div className="py-24 text-center text-sm text-muted-foreground">{tr(lang, 'Faqat administrator uchun.', 'Только для администратора.')}</div>;

  const guard = async (task: () => Promise<void>) => {
    setBusy(true);
    try {
      await task();
    } catch (e) {
      console.error(e);
      toast.error(tr(lang, 'Xatolik yuz berdi', 'Произошла ошибка'));
    } finally {
      setBusy(false);
    }
  };

  const createGroup = () =>
    guard(async () => {
      const { error } = await supabase!.from('communities').insert({ name: groupName.trim(), kind: groupKind });
      if (error) throw error;
      setGroupName('');
      await reload();
    });

  const deleteGroup = (c: Community) => {
    if (!window.confirm(tr(lang, `«${c.name}» guruhi o'chirilsinmi?`, `Удалить группу «${c.name}»?`))) return;
    guard(async () => {
      const { error } = await supabase!.from('communities').delete().eq('id', c.id);
      if (error) throw error;
      await reload();
    });
  };

  const copyLink = async (code: string) => {
    await navigator.clipboard.writeText(inviteLink(code)).catch(() => {});
    toast.success(tr(lang, 'Havola nusxalandi', 'Ссылка скопирована'));
  };

  const publish = () =>
    guard(async () => {
      const [kind, id] = pubKey.split(':') as ['subject' | 'set', string];
      const doc = kind === 'subject' ? subjects.find((s) => s.id === id) : studySets.find((s) => s.id === id);
      if (!doc) return;
      await publishToLibrary({ kind, doc, audienceAll: pubAll, communityIds: pubIds, published: true });
      toast.success(tr(lang, 'Kutubxonaga chop etildi', 'Опубликовано в библиотеке'));
      setPubKey('');
      await reload();
    });

  const toggleVisible = (item: LibraryItem) =>
    guard(async () => {
      const { error } = await supabase!.from('library_items').update({ published: !item.published }).eq('id', item.id);
      if (error) throw error;
      await reload();
    });

  const removeItem = (item: LibraryItem) => {
    if (!window.confirm(tr(lang, `«${item.title}» kutubxonadan olib tashlansinmi?`, `Убрать «${item.title}» из библиотеки?`))) return;
    guard(async () => {
      await unpublish(item.id);
      await reload();
    });
  };

  const send = () => {
    if (!window.confirm(tr(lang, 'Xabar tanlangan auditoriyaga yuboriladi. Davom etasizmi?', 'Сообщение уйдёт выбранной аудитории. Продолжить?'))) return;
    guard(async () => {
      const { data, error } = await supabase!.functions.invoke('admin-broadcast', { body: { text, audienceAll: bcAll, communityIds: bcIds } });
      if (error) throw error;
      toast.success(tr(lang, `Yuborildi: ${data.sent}, xato: ${data.failed}`, `Отправлено: ${data.sent}, ошибок: ${data.failed}`));
      setText('');
      await reload();
    });
  };

  const tabs: [Tab, string][] = [
    ['stats', tr(lang, 'Statistika', 'Статистика')],
    ['import', tr(lang, 'Test yuklash', 'Импорт тестов')],
    ['groups', tr(lang, 'Guruhlar', 'Группы')],
    ['library', tr(lang, 'Kutubxona', 'Библиотека')],
    ['broadcast', tr(lang, 'Xabar', 'Рассылка')],
  ];
  const publishable = [
    ...subjects.map((s) => ({ key: `subject:${s.id}`, label: `📚 ${s.name}` })),
    ...studySets.map((s) => ({ key: `set:${s.id}`, label: `${s.type === 'flashcards' ? '🗂' : '📝'} ${s.title}` })),
  ];

  return (
    <div className="max-w-3xl mx-auto px-4 pt-5 pb-6 space-y-4">
      <h1 className="text-2xl font-serif font-bold text-foreground">Admin</h1>
      <div className="flex gap-1 p-1 bg-secondary/80 rounded-xl overflow-x-auto">
        {tabs.map(([k, label]) => (
          <button key={k} onClick={() => setTab(k)} className={`flex-1 px-3 py-2 rounded-lg text-sm whitespace-nowrap ${tab === k ? 'bg-card shadow-xs font-semibold' : 'text-muted-foreground'}`}>
            {label}
          </button>
        ))}
      </div>
      {busy && <div className="text-sm text-muted-foreground flex items-center gap-2"><Loader2 size={14} className="animate-spin" /> ...</div>}

      {tab === 'stats' &&
        (stats ? (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              {([
                [tr(lang, 'Foydalanuvchilar', 'Пользователи'), stats.users_total],
                [tr(lang, 'Shundan SamDU', 'Из них СамГУ'), stats.users_samdu],
                [tr(lang, '7 kunda yangi', 'Новых за 7 дней'), stats.users_new_7d],
                [tr(lang, 'Bugun faol', 'Активны сегодня'), stats.active_today],
                [tr(lang, '7 kunda faol', 'Активны за 7 дней'), stats.active_7d],
                [tr(lang, 'AI so\'rovlar bugun', 'ИИ-запросов сегодня'), stats.ai_today],
                [tr(lang, 'AI so\'rovlar 7 kun', 'ИИ-запросов за 7 дней'), stats.ai_7d],
                [tr(lang, 'Kutubxonada', 'В библиотеке'), stats.library_items],
              ] as [string, number][]).map(([label, n]) => (
                <div key={label} className={card}>
                  <div className="text-2xl font-bold text-foreground">{n}</div>
                  <div className="text-xs text-muted-foreground">{label}</div>
                </div>
              ))}
            </div>
            <div className={card}>
              <div className="text-xs font-semibold text-muted-foreground mb-2">{tr(lang, 'OTM bo\'yicha', 'По вузам')}</div>
              {Object.entries(stats.by_university).map(([u, n]) => (
                <div key={u} className="flex justify-between text-sm py-0.5"><span>{u === '-' ? tr(lang, 'ko\'rsatilmagan', 'не указан') : u}</span><b>{n}</b></div>
              ))}
            </div>
            {stats.by_community.length > 0 && (
              <div className={card}>
                <div className="text-xs font-semibold text-muted-foreground mb-2">{tr(lang, 'Guruhlar', 'Группы')}</div>
                {stats.by_community.map((c) => (
                  <div key={c.name} className="flex justify-between text-sm py-0.5"><span>{c.name}</span><b>{c.members}</b></div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            <div className="p-3.5 rounded-2xl bg-primary/10 border border-primary/20 text-xs text-foreground">
              {tr(
                lang,
                'Lokal boshqaruv rejimi faol. Baza to\'liq serverda saqlanmoqda.',
                'Локальный режим управления активен. База сохраняется на сервере.'
              )}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className={card}>
                <div className="text-2xl font-bold text-foreground">{subjects.length}</div>
                <div className="text-xs text-muted-foreground">{tr(lang, 'Mavjud fanlar', 'Предметы')}</div>
              </div>
              <div className={card}>
                <div className="text-2xl font-bold text-foreground">{studySets.length}</div>
                <div className="text-xs text-muted-foreground">{tr(lang, "To'plamlar (test/bilet)", 'Наборы')}</div>
              </div>
              <div className={card}>
                <div className="text-2xl font-bold text-foreground">
                  {studySets.reduce((sum, s) => sum + (s.questions?.length ?? 0), 0)}
                </div>
                <div className="text-xs text-muted-foreground">{tr(lang, 'Jami test savollari', 'Всего вопросов')}</div>
              </div>
              <div className={card}>
                <div className="text-2xl font-bold text-foreground">
                  {studySets.reduce((sum, s) => sum + (s.flashcards?.length ?? 0), 0)}
                </div>
                <div className="text-xs text-muted-foreground">{tr(lang, 'Kartochkalar (biletlar)', 'Карточки')}</div>
              </div>
            </div>
          </div>
        ))}

      {tab === 'import' && (
        <div className="space-y-4">
          <div className={card}>
            <h2 className="text-base font-serif font-bold text-foreground mb-1">
              {tr(lang, 'Ommaviy test yuklash (Word / TXT / Hemis)', 'Массовый импорт тестов')}
            </h2>
            <p className="text-xs text-muted-foreground mb-4">
              {tr(
                lang,
                "Faylni yuklang yoki test matnini nusxalab qo'ying. Standart format: Savol, so'ng +To'g'ri javob va 3 ta noto'g'ri javob.",
                'Загрузите файл или вставьте текст тестов. Стандарт: Вопрос, затем +Правильный ответ и 3 дистрактора.'
              )}
            </p>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1">
                  {tr(lang, 'Fanni tanlang', 'Выберите предмет')}
                </label>
                <select
                  className={input}
                  value={importSubjectId}
                  onChange={(e) => setImportSubjectId(e.target.value)}
                >
                  <option value="">{tr(lang, '— Fanni tanlang —', '— Выберите предмет —')}</option>
                  {subjects.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.examFormat})
                    </option>
                  ))}
                  <option value="__new__">{tr(lang, '+ Yangi fan yaratish', '+ Создать новый предмет')}</option>
                </select>
              </div>

              {importSubjectId === '__new__' && (
                <div>
                  <label className="block text-xs font-semibold text-muted-foreground mb-1">
                    {tr(lang, 'Yangi fan nomi', 'Название нового предмета')}
                  </label>
                  <input
                    type="text"
                    className={input}
                    placeholder="Masalan: Oliy matematika"
                    value={newSubjectName}
                    onChange={(e) => setNewSubjectName(e.target.value)}
                  />
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1">
                  {tr(lang, "To'plam nomi (Test nomi)", 'Название теста')}
                </label>
                <input
                  type="text"
                  className={input}
                  placeholder="Masalan: 1-Oraliq nazorat testlari (50 ta)"
                  value={importTitle}
                  onChange={(e) => setImportTitle(e.target.value)}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1">
                  {tr(lang, 'Fayl yuklash (.docx, .txt, .pdf, .json)', 'Загрузить файл')}
                </label>
                <input
                  type="file"
                  accept=".docx,.txt,.pdf,.json"
                  className="block w-full text-xs text-muted-foreground file:mr-3 file:py-2 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-primary file:text-primary-foreground hover:file:opacity-90"
                  onChange={handleFileUpload}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1">
                  {tr(lang, "Yoki test matnini bu yerga qo'ying", 'Или вставьте текст сюда')}
                </label>
                <textarea
                  rows={6}
                  className={`${input} font-mono text-xs`}
                  placeholder="1. Savol matni?&#10;+To'g'ri variant&#10;Noto'g'ri variant 1&#10;Noto'g'ri variant 2&#10;Noto'g'ri variant 3"
                  value={rawText}
                  onChange={(e) => setRawText(e.target.value)}
                />
              </div>

              <div className="flex gap-2 pt-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleParse}
                  disabled={!rawText.trim()}
                >
                  {tr(lang, 'Tahlil qilish (Tekshirish)', 'Анализировать')}
                </Button>
                {parsedQuestions.length > 0 && (
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={handleSaveImportedSet}
                    disabled={busy}
                  >
                    {tr(lang, `Saqlash (${parsedQuestions.length} ta savol)`, `Сохранить (${parsedQuestions.length})`)}
                  </Button>
                )}
              </div>
            </div>
          </div>

          {parsedQuestions.length > 0 && (
            <div className={card}>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-foreground">
                  {tr(lang, 'Tahlil qilingan savollar', 'Распознанные вопросы')} ({parsedQuestions.length})
                </h3>
              </div>
              <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
                {parsedQuestions.map((q, idx) => (
                  <div key={idx} className="p-3 rounded-xl bg-background border border-border text-xs space-y-1.5">
                    <p className="font-semibold text-foreground">{idx + 1}. {q.question}</p>
                    <div className="space-y-1 pl-2">
                      {q.options.map((opt, oIdx) => (
                        <div
                          key={oIdx}
                          className={`flex items-center gap-1.5 py-0.5 px-2 rounded ${
                            oIdx === q.correctAnswer
                              ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 font-semibold'
                              : 'text-muted-foreground'
                          }`}
                        >
                          {oIdx === q.correctAnswer ? '✓' : '•'} {opt}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {tab === 'groups' && (
        <div className="space-y-3">
          <div className={`${card} space-y-2`}>
            <input value={groupName} onChange={(e) => setGroupName(e.target.value)} placeholder={tr(lang, 'Guruh yoki fakultet nomi, masalan: Matematika, 2-kurs', 'Название группы или факультета')} className={input} />
            <div className="flex gap-2">
              <select value={groupKind} onChange={(e) => setGroupKind(e.target.value)} className={input}>
                <option value="university">{tr(lang, 'OTM', 'Вуз')}</option>
                <option value="faculty">{tr(lang, 'Fakultet', 'Факультет')}</option>
                <option value="course">{tr(lang, 'Kurs', 'Курс')}</option>
                <option value="group">{tr(lang, 'Guruh', 'Группа')}</option>
                <option value="other">{tr(lang, 'Boshqa', 'Другое')}</option>
              </select>
              <Button variant="primary" size="md" icon={<Plus size={14} />} disabled={!groupName.trim() || busy} onClick={createGroup}>{tr(lang, 'Yaratish', 'Создать')}</Button>
            </div>
          </div>
          {communities.map((c) => (
            <div key={c.id} className={`${card} flex items-center gap-2`}>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold truncate">{c.name}</div>
                <div className="text-xs text-muted-foreground truncate">{BOT_USERNAME ? inviteLink(c.invite_code) : c.invite_code}</div>
              </div>
              <button onClick={() => copyLink(c.invite_code)} aria-label="copy" className="p-2 text-muted-foreground hover:text-foreground"><Copy size={16} /></button>
              <button onClick={() => deleteGroup(c)} aria-label="delete" className="p-2 text-muted-foreground hover:text-rose-600"><Trash2 size={16} /></button>
            </div>
          ))}
          {!BOT_USERNAME && <p className="text-xs text-amber-600">{tr(lang, 'Taklif havolasi uchun .env da VITE_TELEGRAM_BOT ni to\'ldiring.', 'Для ссылок-приглашений заполните VITE_TELEGRAM_BOT в .env.')}</p>}
        </div>
      )}

      {tab === 'library' && (
        <div className="space-y-3">
          <div className={`${card} space-y-3`}>
            <div className="text-xs font-semibold text-muted-foreground">{tr(lang, 'Kutubxonaga chop etish', 'Опубликовать в библиотеке')}</div>
            <select value={pubKey} onChange={(e) => setPubKey(e.target.value)} className={input}>
              <option value="">{tr(lang, 'O\'zingizning fan yoki to\'plamingizni tanlang', 'Выберите свой предмет или набор')}</option>
              {publishable.map((p) => <option key={p.key} value={p.key}>{p.label}</option>)}
            </select>
            <AudiencePicker lang={lang} all={pubAll} ids={pubIds} communities={communities} onChange={(a, i) => { setPubAll(a); setPubIds(i); }} />
            <Button variant="primary" size="md" disabled={!pubKey || busy || (!pubAll && pubIds.length === 0)} onClick={publish}>{tr(lang, 'Chop etish', 'Опубликовать')}</Button>
            <p className="text-xs text-muted-foreground">{tr(lang, 'Fan va to\'plamlarni oddiy foydalanuvchidek «Fanlar» bo\'limida yarating. Natijalar nusxaga o\'tmaydi. Qayta chop etsangiz, kutubxonadagi nusxa yangilanadi.', 'Создавайте предметы и наборы в разделе «Предметы» как обычный пользователь. Результаты в копию не попадают. Повторная публикация обновляет копию.')}</p>
          </div>
          {library.map((item) => (
            <div key={item.id} className={`${card} flex items-center gap-2`}>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold truncate">{item.title}</div>
                <div className="text-xs text-muted-foreground">
                  {item.audience_all ? tr(lang, 'hammaga', 'всем') : tr(lang, `${item.community_ids.length} ta guruh`, `групп: ${item.community_ids.length}`)}
                  {!item.published && ` · ${tr(lang, 'yashirin', 'скрыто')}`}
                </div>
              </div>
              <button onClick={() => toggleVisible(item)} aria-label="visibility" className="p-2 text-muted-foreground hover:text-foreground">{item.published ? <Eye size={16} /> : <EyeOff size={16} />}</button>
              <button onClick={() => removeItem(item)} aria-label="delete" className="p-2 text-muted-foreground hover:text-rose-600"><Trash2 size={16} /></button>
            </div>
          ))}
        </div>
      )}

      {tab === 'broadcast' && (
        <div className={`${card} space-y-3`}>
          <textarea value={text} onChange={(e) => setText(e.target.value)} rows={5} maxLength={4000} placeholder={tr(lang, 'Xabar matni', 'Текст сообщения')} className={input} />
          <AudiencePicker lang={lang} all={bcAll} ids={bcIds} communities={communities} onChange={(a, i) => { setBcAll(a); setBcIds(i); }} />
          <Button variant="primary" size="md" icon={<Megaphone size={14} />} disabled={!text.trim() || busy || (!bcAll && bcIds.length === 0)} onClick={send}>
            {tr(lang, 'Yuborish', 'Отправить')}
          </Button>
        </div>
      )}
    </div>
  );
};
