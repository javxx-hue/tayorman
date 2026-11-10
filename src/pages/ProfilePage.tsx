import React, { useEffect, useState } from 'react';
import { Bell, BellOff, Clock, Globe, GraduationCap, Users, MessageCircle, ShieldCheck } from 'lucide-react';
import { getDailyMinutes, MINUTE_CHOICES, setDailyMinutes } from '../lib/budget';
import { toast } from '../components/ui/Toast';
import { useAuth } from '../lib/auth';
import { supabase } from '../lib/supabase';
import { Language, tr } from '../lib/i18n';
import { ADMIN_URL, BOT_USERNAME } from '../lib/telegram';
import { PrivacyPoints } from '../components/PrivacyNotice';
import { privacyText } from '../lib/privacy';

export const ProfilePage: React.FC<{ lang: Language }> = ({ lang }) => {
  const { profile, online, updateProfile, isAdmin } = useAuth();
  const [communities, setCommunities] = useState<{ id: string; name: string }[]>([]);
  const [university, setUniversity] = useState(profile?.university === 'samdu' ? '' : profile?.university ?? '');

  useEffect(() => {
    if (!supabase || !online) return;
    supabase
      .from('community_members')
      .select('communities(id, name)')
      .then(({ data }) => setCommunities((data ?? []).map((r: any) => r.communities).filter(Boolean)));
  }, [online]);

  const save = async (patch: Parameters<typeof updateProfile>[0]) => {
    try {
      await updateProfile(patch);
      toast.success(tr(lang, 'Saqlandi', 'Сохранено'));
    } catch {
      toast.error(tr(lang, 'Saqlab bo\'lmadi', 'Не удалось сохранить'));
    }
  };

  const leave = async (id: string) => {
    if (!supabase || !profile) return;
    await supabase.from('community_members').delete().eq('community_id', id).eq('user_id', profile.id);
    setCommunities((c) => c.filter((x) => x.id !== id));
  };

  const [minutes, setMinutes] = useState(getDailyMinutes);
  const card = 'rounded-2xl border border-border bg-card p-4';
  const pill = (active: boolean) => `px-3 py-1.5 rounded-lg text-sm border ${active ? 'border-primary bg-primary/10 font-semibold' : 'border-border'}`;

  return (
    <div className="max-w-3xl mx-auto px-4 pt-5 pb-6 space-y-3">
      <h1 className="text-2xl font-serif font-bold text-foreground">
        {profile?.first_name ?? tr(lang, 'Profil', 'Профиль')}
        {profile?.username && <span className="block text-sm font-sans font-normal text-muted-foreground">@{profile.username}</span>}
      </h1>

      {isAdmin && (
        <div className={`${card} border-amber-500/30 bg-amber-500/5`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShieldCheck className="text-amber-500 shrink-0" size={20} />
              <div>
                <div className="text-sm font-semibold text-foreground">Administrator</div>
                <div className="text-xs text-muted-foreground">{profile?.telegram_id ? `ID: ${profile.telegram_id} ` : ''}(To'liq huquq)</div>
              </div>
            </div>
            {ADMIN_URL && (
              <a
                href={ADMIN_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-semibold hover:opacity-90 transition-opacity"
              >
                Admin Panel
              </a>
            )}
          </div>
        </div>
      )}

      <div className={card}>
        <div className="text-xs font-semibold text-muted-foreground mb-2 flex items-center gap-1.5"><Globe size={14} /> Til / Язык</div>
        <div className="flex gap-2">
          <button className={pill(lang === 'uz')} onClick={() => save({ language: 'uz' })}>O'zbekcha</button>
          <button className={pill(lang === 'ru')} onClick={() => save({ language: 'ru' })}>Русский</button>
        </div>
      </div>

      <div className={card}>
        <div className="text-xs font-semibold text-muted-foreground mb-2 flex items-center gap-1.5"><GraduationCap size={14} /> {tr(lang, 'OTM', 'Вуз')}</div>
        <div className="flex flex-wrap gap-2 mb-2">
          <button className={pill(profile?.university === 'samdu')} onClick={() => save({ university: 'samdu' })}>{tr(lang, 'SamDU', 'СамГУ')}</button>
        </div>
        <div className="flex gap-2">
          <input
            value={university}
            onChange={(e) => setUniversity(e.target.value)}
            placeholder={tr(lang, 'Boshqa OTM nomi', 'Другой вуз')}
            className="flex-1 px-3 py-2 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          />
          <button className={pill(false)} disabled={!university.trim()} onClick={() => save({ university: university.trim() })}>
            {tr(lang, 'Saqlash', 'Сохранить')}
          </button>
        </div>
      </div>

      <div className={card}>
        <button className="w-full flex items-center justify-between" onClick={() => save({ reminders_enabled: !profile?.reminders_enabled })} disabled={!online}>
          <span className="flex items-center gap-2 text-sm font-medium">
            {profile?.reminders_enabled ? <Bell size={16} /> : <BellOff size={16} />}
            {tr(lang, 'Har kuni 08:00 da eslatma', 'Напоминание каждый день в 08:00')}
          </span>
          <span className={`w-10 h-6 rounded-full p-0.5 transition-colors ${profile?.reminders_enabled ? 'bg-primary' : 'bg-secondary'}`}>
            <span className={`block w-5 h-5 rounded-full bg-white transition-transform ${profile?.reminders_enabled ? 'translate-x-4' : ''}`} />
          </span>
        </button>
      </div>

      <div className={card}>
        <div className="text-xs font-semibold text-muted-foreground mb-2 flex items-center gap-1.5"><Clock size={14} /> {tr(lang, 'Kunlik o\'qish vaqti', 'Время на учёбу в день')}</div>
        <div className="flex flex-wrap gap-2">
          {MINUTE_CHOICES.map((m) => (
            <button key={m} className={pill(minutes === m)} onClick={() => { setDailyMinutes(m); setMinutes(m); }}>
              {m} {tr(lang, 'daq', 'мин')}
            </button>
          ))}
        </div>
        <p className="text-xs text-muted-foreground mt-2">
          {tr(lang, "Bugungi reja shu vaqtga sig'adigan qilib tuziladi. Sig'magani keyingi kunlarga o'tadi.", 'План на день подбирается под это время. Что не помещается, переходит на следующие дни.')}
        </p>
      </div>

      <div className={card}>
        <div className="text-xs font-semibold text-muted-foreground mb-2 flex items-center gap-1.5"><Users size={14} /> {tr(lang, 'Guruhlarim', 'Мои группы')}</div>
        {communities.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {tr(lang, 'Guruhga qo\'shilish uchun admin bergan taklif havolasini oching.', 'Чтобы вступить в группу, откройте ссылку-приглашение от администратора.')}
          </p>
        ) : (
          <ul className="space-y-1.5">
            {communities.map((c) => (
              <li key={c.id} className="flex items-center justify-between text-sm">
                <span>{c.name}</span>
                <button className="text-xs text-muted-foreground hover:text-rose-600" onClick={() => leave(c.id)}>{tr(lang, 'Chiqish', 'Выйти')}</button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {BOT_USERNAME && (
        <div className={`${card} text-sm text-muted-foreground flex items-start gap-2`}>
          <MessageCircle size={16} className="shrink-0 mt-0.5" />
          <span>
            {tr(
              lang,
              `Fan, savol yoki material kerak bo'lsa, @${BOT_USERNAME} chatiga yozing (fayl yoki rasm ham mumkin): so'rov adminga boradi. Buyruqlar: /reja, /til, /eslatma.`,
              `Нужен предмет, вопросы или материалы — напишите в чат @${BOT_USERNAME} (можно файл или фото), запрос уйдёт администратору. Команды: /reja, /til, /eslatma.`
            )}
          </span>
        </div>
      )}

      <details className={card}>
        <summary className="cursor-pointer text-sm font-semibold text-foreground">{privacyText(lang).title}</summary>
        <div className="mt-3">
          <PrivacyPoints lang={lang} />
        </div>
      </details>
    </div>
  );
};
