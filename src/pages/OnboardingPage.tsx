import React, { useState } from 'react';
import { Button } from '../components/ui/Button';
import { toast } from '../components/ui/Toast';
import { useAuth } from '../lib/auth';
import { Language, tr } from '../lib/i18n';
import { haptic } from '../lib/telegram';

// First launch: language and university. Both can be changed later in Profile.
export const OnboardingPage: React.FC<{ onDone: () => void }> = ({ onDone }) => {
  const { lang, updateProfile } = useAuth();
  const [choice, setChoice] = useState<'samdu' | 'other' | null>(null);
  const [other, setOther] = useState('');
  const [saving, setSaving] = useState(false);

  const save = async () => {
    const university = choice === 'samdu' ? 'samdu' : other.trim() || null;
    setSaving(true);
    try {
      if (university) await updateProfile({ university });
      haptic.success();
      onDone();
    } catch {
      toast.error(tr(lang, 'Saqlab bo\'lmadi, qayta urinib ko\'ring', 'Не удалось сохранить, попробуйте ещё раз'));
    } finally {
      setSaving(false);
    }
  };

  const option = (active: boolean) =>
    `w-full text-left p-4 rounded-2xl border transition-colors ${active ? 'border-primary bg-primary/5' : 'border-border bg-card'}`;

  return (
    <div className="min-h-screen bg-background text-foreground px-5 py-8 max-w-md mx-auto flex flex-col">
      <h1 className="text-3xl font-serif font-bold">Tayyorman</h1>
      <p className="text-sm text-muted-foreground mt-2 mb-6">
        {tr(lang, 'Sessiya va oraliq nazoratlarga tayyorlanish uchun yordamchi.', 'Помощник для подготовки к сессии и промежуточному контролю.')}
      </p>

      <div className="mb-6">
        <div className="text-xs font-semibold text-muted-foreground mb-2">Til / Язык</div>
        <div className="grid grid-cols-2 gap-2">
          {(['uz', 'ru'] as Language[]).map((l) => (
            <button key={l} onClick={() => updateProfile({ language: l })} className={option(lang === l)}>
              <span className="font-semibold">{l === 'uz' ? "O'zbekcha" : 'Русский'}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="text-xs font-semibold text-muted-foreground mb-2">{tr(lang, 'Qayerda o\'qiysiz?', 'Где вы учитесь?')}</div>
      <div className="space-y-2">
        <button onClick={() => setChoice('samdu')} className={option(choice === 'samdu')}>
          <div className="font-semibold">{tr(lang, 'SamDU', 'СамГУ')}</div>
          <div className="text-xs text-muted-foreground">{tr(lang, 'Sharof Rashidov nomidagi Samarqand davlat universiteti', 'Самаркандский государственный университет им. Шарофа Рашидова')}</div>
        </button>
        <button onClick={() => setChoice('other')} className={option(choice === 'other')}>
          <div className="font-semibold">{tr(lang, 'Boshqa OTM', 'Другой вуз')}</div>
        </button>
        {choice === 'other' && (
          <input
            autoFocus
            value={other}
            onChange={(e) => setOther(e.target.value)}
            placeholder={tr(lang, 'OTM nomi', 'Название вуза')}
            className="w-full px-3.5 py-3 rounded-xl border border-border bg-card text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          />
        )}
      </div>

      <div className="mt-auto pt-8 space-y-2">
        <Button variant="primary" size="lg" className="w-full" disabled={!choice || saving || (choice === 'other' && !other.trim())} onClick={save}>
          {tr(lang, 'Boshlash', 'Начать')}
        </Button>
        <button onClick={onDone} className="w-full text-xs text-muted-foreground py-2">
          {tr(lang, 'O\'tkazib yuborish', 'Пропустить')}
        </button>
      </div>
    </div>
  );
};
