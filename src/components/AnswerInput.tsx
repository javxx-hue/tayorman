import React, { useRef, useState } from 'react';
import { Camera, Loader2, Mic, Square } from 'lucide-react';
import { toast } from './ui/Toast';
import { Language, tr } from '../lib/i18n';
import { describeGenerationError } from '../lib/ai';
import { transcribeAudio, transcribeHandwriting } from '../lib/answerInput';
import { MAX_RECORD_SECONDS, MIN_RECORD_SECONDS, RecorderError, canRecordAudio, useRecorder } from '../lib/useRecorder';
import { haptic } from '../lib/telegram';

const MAX_PHOTOS = 3;
const clock = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

interface Props {
  lang: Language;
  disabled?: boolean;
  onText: (text: string) => void; // the text goes to the answer box, where the student checks it
}

// Two ways to put an answer in without typing: say it, or take a photo of the paper it is written on
export const AnswerInput: React.FC<Props> = ({ lang, disabled, onText }) => {
  const [working, setWorking] = useState<'voice' | 'photo' | null>(null);
  const photoInput = useRef<HTMLInputElement>(null);

  const done = (text: string) => {
    if (!text) return toast.error(tr(lang, "Hech narsa o'qib bo'lmadi. Aniqroq gapiring yoki rasmni yaxshiroq oling.", 'Ничего не удалось распознать. Говорите чётче или сделайте фото лучше.'));
    onText(text);
    haptic.success();
    toast.success(tr(lang, "Matn tayyor. Tekshirib, xato bo'lsa tuzating, so'ng «Baholash» ni bosing.", 'Текст готов. Проверьте и исправьте ошибки, затем нажмите «Оценить».'));
  };

  const run = async (kind: 'voice' | 'photo', task: () => Promise<string>) => {
    setWorking(kind);
    try {
      done(await task());
    } catch (e) {
      console.error(e);
      toast.error(describeGenerationError(e, lang));
    } finally {
      setWorking(null);
    }
  };

  const problem = (error: RecorderError) =>
    toast.error(
      error === 'denied'
        ? tr(lang, "Mikrofonga ruxsat berilmagan. Telegram sozlamalaridan ruxsat bering yoki rasm yuklang.", 'Нет доступа к микрофону. Разрешите его в настройках Telegram или загрузите фото.')
        : tr(lang, "Yozib bo'lmadi. Qayta urinib ko'ring yoki rasm yuklang.", 'Не удалось записать. Повторите или загрузите фото.')
    );

  const recorder = useRecorder((recording, seconds) => {
    if (seconds < MIN_RECORD_SECONDS) return toast.error(tr(lang, 'Juda qisqa. Savolga javob bering va keyin to\'xtating.', 'Слишком коротко. Ответьте на вопрос и потом остановите запись.'));
    run('voice', () => transcribeAudio(recording, lang));
  }, problem);

  const onPhotos = (files: FileList | null) => {
    if (!files?.length) return;
    const list = Array.from(files).slice(0, MAX_PHOTOS);
    if (files.length > MAX_PHOTOS) toast.error(tr(lang, `Eng ko'pi bilan ${MAX_PHOTOS} ta rasm`, `Не больше фото: ${MAX_PHOTOS}`));
    // pages are read in the order they were chosen, one after the other
    run('photo', async () => {
      const pages: string[] = [];
      for (const file of list) pages.push(await transcribeHandwriting(file, lang));
      return pages.filter(Boolean).join('\n\n');
    });
  };

  const busy = working !== null;

  if (working) {
    return (
      <div className="flex items-center gap-2 text-xs text-muted-foreground" role="status">
        <Loader2 size={14} className="animate-spin" />
        {working === 'voice' ? tr(lang, 'Ovoz matnga aylantirilmoqda...', 'Голос переводится в текст...') : tr(lang, "Rasmdagi yozuv o'qilmoqda...", 'Читаем текст с фото...')}
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {canRecordAudio() && (
        recorder.recording ? (
          <button type="button" onClick={recorder.stop} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border bg-rose-500/15 border-rose-500/40 text-rose-700 dark:text-rose-300">
            <Square size={13} className="fill-current" />
            {tr(lang, "To'xtatish", 'Стоп')} · {clock(recorder.seconds)} / {clock(MAX_RECORD_SECONDS)}
          </button>
        ) : (
          <button type="button" onClick={recorder.start} disabled={disabled || busy} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border border-border text-foreground hover:bg-secondary disabled:opacity-50">
            <Mic size={14} /> {tr(lang, 'Gapirib javob berish', 'Ответить голосом')}
          </button>
        )
      )}
      {!recorder.recording && (
        <>
          <input ref={photoInput} type="file" accept="image/*" multiple className="hidden" onChange={(e) => { onPhotos(e.target.files); e.target.value = ''; }} />
          <button type="button" onClick={() => photoInput.current?.click()} disabled={disabled || busy} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border border-border text-foreground hover:bg-secondary disabled:opacity-50">
            <Camera size={14} /> {tr(lang, "Qog'ozdagi javob rasmi", 'Фото ответа с бумаги')}
          </button>
        </>
      )}
    </div>
  );
};
