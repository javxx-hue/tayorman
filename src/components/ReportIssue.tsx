import React, { useState } from 'react';
import { Flag } from 'lucide-react';
import { toast } from './ui/Toast';
import { Language, tr } from '../lib/i18n';
import { useAuth } from '../lib/auth';
import { IssueInput, IssueLimitError, reportIssue } from '../lib/issues';

interface Props extends Omit<IssueInput, 'note'> {
  lang: Language;
}

// "This question has a mistake": goes to the admin, who fixes the material in the library
export const ReportIssue: React.FC<Props> = ({ lang, ...about }) => {
  const { online } = useAuth();
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  if (!online) return null;
  if (sent) return <p className="text-xs text-muted-foreground">{tr(lang, "Xabaringiz adminga yuborildi. Rahmat!", 'Сообщение отправлено администратору. Спасибо!')}</p>;

  const send = async () => {
    if (note.trim().length < 3 || sending) return;
    setSending(true);
    try {
      await reportIssue({ ...about, note });
      setSent(true);
    } catch (e) {
      toast.error(
        e instanceof IssueLimitError
          ? tr(lang, "Bugun juda ko'p xabar yubordingiz. Ertaga yozing.", 'Сегодня слишком много сообщений. Напишите завтра.')
          : tr(lang, "Yuborib bo'lmadi. Qayta urinib ko'ring.", 'Не удалось отправить. Попробуйте ещё раз.')
      );
    } finally {
      setSending(false);
    }
  };

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground">
        <Flag size={13} /> {tr(lang, 'Savolda xato bor', 'В вопросе ошибка')}
      </button>
    );
  }

  return (
    <div className="space-y-2">
      <textarea
        value={note}
        maxLength={1000}
        rows={2}
        onChange={(e) => setNote(e.target.value)}
        placeholder={tr(lang, "Nima noto'g'ri? (masalan: to'g'ri javob boshqa variant)", 'Что неверно? (например: правильный ответ другой вариант)')}
        className="w-full p-2.5 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary"
      />
      <div className="flex gap-2">
        <button type="button" onClick={send} disabled={note.trim().length < 3 || sending} className="px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-semibold disabled:opacity-50">
          {tr(lang, 'Yuborish', 'Отправить')}
        </button>
        <button type="button" onClick={() => setOpen(false)} className="px-3 py-1.5 rounded-lg border border-border text-xs">
          {tr(lang, 'Bekor qilish', 'Отмена')}
        </button>
      </div>
    </div>
  );
};
