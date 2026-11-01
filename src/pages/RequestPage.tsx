import React, { useEffect, useRef, useState } from 'react';
import { Loader2, Paperclip, Send, X } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { toast } from '../components/ui/Toast';
import { Language, tr } from '../lib/i18n';
import { useAuth } from '../lib/auth';
import { haptic } from '../lib/telegram';
import { MAX_ATTACHMENTS, MAX_FILE_BYTES, MyRequest, RequestFileError, RequestKind, RequestLimitError, fetchMyRequests, sendRequest } from '../lib/requests';

const KINDS: { key: RequestKind; uz: string; ru: string; hintUz: string; hintRu: string }[] = [
  { key: 'new_subject', uz: 'Yangi fan', ru: 'Новый предмет', hintUz: "Qaysi fan, qaysi kurs va guruh, imtihon sanasi", hintRu: 'Какой предмет, курс и группа, дата экзамена' },
  { key: 'questions', uz: 'Savol / material', ru: 'Вопросы / материал', hintUz: "Qaysi fan uchun, nima kerak (manba faylni pastdan biriktiring)", hintRu: 'Для какого предмета и что нужно (источник прикрепите ниже)' },
  { key: 'bug', uz: 'Xato', ru: 'Ошибка', hintUz: "Qaysi savol yoki joyda xato bor", hintRu: 'В каком вопросе или месте ошибка' },
  { key: 'other', uz: 'Boshqa', ru: 'Другое', hintUz: "Taklif yoki savolingizni yozing", hintRu: 'Напишите предложение или вопрос' },
];

const STATUS: Record<MyRequest['status'], { uz: string; ru: string; cls: string }> = {
  new: { uz: 'Yuborildi', ru: 'Отправлено', cls: 'bg-secondary text-muted-foreground' },
  seen: { uz: "Ko'rildi", ru: 'Просмотрено', cls: 'bg-blue-500/15 text-blue-700 dark:text-blue-300' },
  accepted: { uz: 'Qabul qilindi', ru: 'Принято', cls: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300' },
  declined: { uz: 'Rad etildi', ru: 'Отклонено', cls: 'bg-rose-500/15 text-rose-700 dark:text-rose-300' },
};

// The one thing a student can "create": a request to the admins
export const RequestPage: React.FC<{ lang: Language }> = ({ lang }) => {
  const { online, profile } = useAuth();
  const fileInput = useRef<HTMLInputElement>(null);
  const [kind, setKind] = useState<RequestKind>('new_subject');
  const [text, setText] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [sending, setSending] = useState(false);
  const [mine, setMine] = useState<MyRequest[] | null>(null);

  const load = () => {
    if (!online) return setMine([]);
    fetchMyRequests()
      .then(setMine)
      .catch(() => setMine([]));
  };
  useEffect(load, [online]);

  const current = KINDS.find((k) => k.key === kind)!;

  const addFiles = (list: FileList | null) => {
    if (!list) return;
    const next = [...files, ...Array.from(list)];
    if (next.length > MAX_ATTACHMENTS) toast.error(tr(lang, `Eng ko'pi bilan ${MAX_ATTACHMENTS} ta fayl`, `Не больше файлов: ${MAX_ATTACHMENTS}`));
    setFiles(next.slice(0, MAX_ATTACHMENTS));
  };

  const fileProblem = (e: RequestFileError) => {
    const name = e.fileName ? `«${e.fileName}»: ` : '';
    if (e.reason === 'type') return name + tr(lang, "bu fayl turi qabul qilinmaydi. PDF, Word, PowerPoint, TXT yoki rasm yuboring.", 'этот тип файла не принимается. Пришлите PDF, Word, PowerPoint, TXT или фото.');
    if (e.reason === 'size') return name + tr(lang, `fayl ${MAX_FILE_BYTES / 1024 / 1024} MB dan katta.`, `файл больше ${MAX_FILE_BYTES / 1024 / 1024} МБ.`);
    if (e.reason === 'count') return tr(lang, "Fayllar juda ko'p.", 'Слишком много файлов.');
    return name + tr(lang, "yuklab bo'lmadi. Internetni tekshirib, qayta urinib ko'ring.", 'не удалось загрузить. Проверьте интернет и повторите.');
  };

  const submit = async () => {
    if (text.trim().length < 3 || sending) return;
    setSending(true);
    try {
      await sendRequest(kind, text.trim(), files, profile?.id);
      haptic.success();
      toast.success(tr(lang, "So'rov adminga yuborildi", 'Запрос отправлен администратору'));
      setText('');
      setFiles([]);
      load();
    } catch (e) {
      toast.error(
        e instanceof RequestFileError
          ? fileProblem(e)
          : e instanceof RequestLimitError
          ? tr(lang, "Bugun juda ko'p so'rov yubordingiz. Ertaga yozing.", 'Сегодня слишком много запросов. Напишите завтра.')
          : tr(lang, "Yuborib bo'lmadi. Internetni tekshirib, qayta urinib ko'ring.", 'Не удалось отправить. Проверьте интернет и повторите.')
      );
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto px-4 pt-5 pb-6">
      <h1 className="text-2xl font-serif font-bold text-foreground">{tr(lang, 'Adminga yozish', 'Написать админу')}</h1>
      <p className="text-sm text-muted-foreground mt-1 mb-4">
        {tr(
          lang,
          'Fanlar, savollar va materiallarni administrator tayyorlaydi. Nima kerakligini shu yerda yozing, javob botga keladi.',
          'Предметы, вопросы и материалы готовит администратор. Напишите, что нужно, ответ придёт в бот.'
        )}
      </p>

      <div className="rounded-2xl border border-border bg-card p-4 space-y-3 mb-6">
        <div className="flex flex-wrap gap-2">
          {KINDS.map((k) => (
            <button
              key={k.key}
              onClick={() => setKind(k.key)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold border ${kind === k.key ? 'bg-primary text-primary-foreground border-primary' : 'border-border text-muted-foreground'}`}
            >
              {tr(lang, k.uz, k.ru)}
            </button>
          ))}
        </div>
        <textarea
          rows={4}
          maxLength={4000}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={tr(lang, current.hintUz, current.hintRu)}
          className="w-full p-3 rounded-xl border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary resize-y"
        />
        <div className="space-y-2">
          <input ref={fileInput} type="file" multiple accept=".pdf,.docx,.pptx,.txt,.md,image/*" className="hidden" onChange={(e) => { addFiles(e.target.files); e.target.value = ''; }} />
          <button
            type="button"
            onClick={() => fileInput.current?.click()}
            disabled={files.length >= MAX_ATTACHMENTS}
            className="flex items-center gap-1.5 text-xs font-semibold text-primary disabled:opacity-50"
          >
            <Paperclip size={14} /> {tr(lang, 'Fayl biriktirish (PDF, Word, PowerPoint, rasm)', 'Прикрепить файл (PDF, Word, PowerPoint, фото)')}
          </button>
          {files.map((f, i) => (
            <div key={`${f.name}-${i}`} className="flex items-center justify-between gap-2 text-xs rounded-lg border border-border px-3 py-1.5">
              <span className="truncate">{f.name}</span>
              <span className="text-muted-foreground shrink-0">{(f.size / 1024 / 1024).toFixed(1)} MB</span>
              <button type="button" onClick={() => setFiles(files.filter((_, j) => j !== i))} aria-label={tr(lang, 'Olib tashlash', 'Убрать')} className="text-muted-foreground hover:text-rose-600"><X size={14} /></button>
            </div>
          ))}
        </div>
        <div className="flex justify-end">
          <Button
            variant="primary"
            size="md"
            icon={sending ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
            onClick={submit}
            disabled={text.trim().length < 3 || sending || !online}
          >
            {tr(lang, 'Yuborish', 'Отправить')}
          </Button>
        </div>
      </div>

      <h2 className="text-sm font-semibold text-muted-foreground mb-2">{tr(lang, "Mening so'rovlarim", 'Мои запросы')}</h2>
      {mine === null ? (
        <div className="py-8 text-center text-muted-foreground"><Loader2 className="mx-auto animate-spin" /></div>
      ) : mine.length === 0 ? (
        <p className="text-sm text-muted-foreground">{tr(lang, "Hali so'rov yubormagansiz.", 'Вы ещё не отправляли запросов.')}</p>
      ) : (
        <ul className="space-y-2">
          {mine.map((r) => {
            const k = KINDS.find((x) => x.key === r.kind) ?? KINDS[3];
            return (
              <li key={r.id} className="p-3 rounded-2xl border border-border bg-card space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs text-muted-foreground">{tr(lang, k.uz, k.ru)} · {new Date(r.created_at).toLocaleDateString()}</span>
                  <span className={`px-2 py-0.5 rounded-md text-[11px] font-semibold ${STATUS[r.status].cls}`}>{tr(lang, STATUS[r.status].uz, STATUS[r.status].ru)}</span>
                </div>
                <p className="text-sm text-foreground whitespace-pre-wrap">{r.text}</p>
                {r.attachments.length > 0 && <p className="text-xs text-muted-foreground">📎 {tr(lang, `${r.attachments.length} ta fayl`, `Файлов: ${r.attachments.length}`)}</p>}
                {r.admin_reply && (
                  <p className="text-sm rounded-xl bg-primary/5 border border-primary/20 p-2.5 whitespace-pre-wrap">
                    <b>{tr(lang, 'Admin: ', 'Админ: ')}</b>{r.admin_reply}
                  </p>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
};
