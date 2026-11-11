import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Crown, Flame, Loader2, Swords, Trophy } from 'lucide-react';
import { QuizQuestion, StudySet } from '../../types';
import { Language, tr } from '../../lib/i18n';
import {
  CHALLENGE_SIZE, DUEL_SIZE, Duel, RatingRow, challengeDone, challengeQuestions, duelLabel, duelQuestions, duelState,
  gameError, levelOf, myDuels, myGroup, myXp, rememberChallenge, startDuel, submitChallenge, submitDuel, today, watchDuels, weeklyRating,
} from '../../lib/games';
import { Button } from '../ui/Button';
import { GameRunner } from './GameRunner';

interface Props {
  userId: string;
  studySets: StudySet[];
  lang: Language;
}

type Play = { kind: 'challenge'; title: string; questions: QuizQuestion[] } | { kind: 'duel'; duel: Duel | null; id: string; title: string; questions: QuizQuestion[] };
interface Result {
  correct: number;
  total: number;
  note: string;
}

const card = 'rounded-3xl border border-border bg-card p-4 space-y-3';

// XP, today's challenge, duels with group mates and the week's rating
export const GamesPanel: React.FC<Props> = ({ userId, studySets, lang }) => {
  const day = today();
  const [group, setGroup] = useState<{ id: string; name: string } | null | undefined>(undefined);
  const [xp, setXp] = useState(0);
  const [duels, setDuels] = useState<Duel[]>([]);
  const [rating, setRating] = useState<RatingRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [choosing, setChoosing] = useState(false);
  const [play, setPlay] = useState<Play | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [done, setDone] = useState(() => challengeDone(day));

  const load = useCallback(async () => {
    try {
      const g = await myGroup(userId);
      const [x, d, r] = await Promise.all([myXp(userId), myDuels(), g ? weeklyRating(g.id) : Promise.resolve([])]);
      setGroup(g);
      setXp(x);
      setDuels(d);
      setRating(r);
    } catch (e) {
      setGroup((old) => (old === undefined ? null : old));
      setError(gameError(e, lang));
    }
  }, [userId, lang]);

  useEffect(() => {
    void load();
  }, [load]);

  // A duel from a group mate or their answer shows up by itself, without reopening the app
  useEffect(() => watchDuels(userId, () => void load()), [userId, load]);

  // Test sets every group mate has from the library, big enough for a duel (one entry per library item)
  const duelSets = useMemo(() => {
    const seen = new Set<string>();
    return studySets.filter((s) => {
      if (!s.libraryId || (s.type !== 'quiz' && s.type !== 'exam') || (s.questions?.length ?? 0) < DUEL_SIZE || seen.has(s.libraryId)) return false;
      seen.add(s.libraryId);
      return true;
    });
  }, [studySets]);

  const challenge = useMemo(() => (group ? challengeQuestions(studySets, group.id, day) : []), [studySets, group, day]);

  // The questions of a duel, from this phone's copy of the same library test
  const questionsOf = (d: Duel): { title: string; questions: QuizQuestion[] } | null => {
    const set = studySets.find((s) => s.libraryId === d.set_key && s.questions?.length);
    if (!set) return null;
    const byId = new Map((set.questions ?? []).map((q) => [q.id, q]));
    const questions = d.question_ids.map((id) => byId.get(id)).filter((q): q is QuizQuestion => !!q);
    return questions.length === d.question_ids.length ? { title: set.title, questions } : null;
  };

  const begin = async (set: StudySet) => {
    if (!group || !set.libraryId) return;
    setBusy(true);
    setError(null);
    try {
      const questions = duelQuestions(set);
      const started = await startDuel(group.id, set.libraryId, questions.map((q) => q.id));
      setChoosing(false);
      setPlay({ kind: 'duel', duel: null, id: started.id, title: set.title, questions });
    } catch (e) {
      setError(gameError(e, lang));
    } finally {
      setBusy(false);
    }
  };

  const finish = async (p: Play, correct: number) => {
    const total = p.questions.length;
    let note: string;
    try {
      if (p.kind === 'challenge') {
        const won = await submitChallenge(day, correct, total);
        rememberChallenge(day, correct, total);
        setDone({ correct, total });
        note = won > 0 ? `+${won} XP` : tr(lang, 'Bugungi chellenj XP si avval olingan.', 'XP за сегодняшний челлендж уже получены.');
      } else {
        await submitDuel(p.id, correct);
        const theirs = p.duel?.their_score ?? null;
        if (theirs === null) note = tr(lang, 'Natijangiz yuborildi. Raqibingiz 24 soat ichida javob beradi.', 'Результат отправлен. Соперник ответит в течение 24 часов.');
        else if (correct > theirs) note = tr(lang, `G'alaba! ${correct}:${theirs} · +50 XP`, `Победа! ${correct}:${theirs} · +50 XP`);
        else if (correct === theirs) note = tr(lang, `Durang ${correct}:${theirs} · +25 XP`, `Ничья ${correct}:${theirs} · +25 XP`);
        else note = tr(lang, `Bu safar raqib kuchliroq ${correct}:${theirs} · +10 XP`, `В этот раз соперник сильнее ${correct}:${theirs} · +10 XP`);
      }
    } catch (e) {
      note = gameError(e, lang);
    }
    setResult({ correct, total, note });
    void load();
  };

  if (play) {
    return (
      <div className="fixed inset-0 z-50 bg-background overflow-y-auto" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
        {result ? (
          <div className="max-w-md mx-auto px-6 pt-16 text-center space-y-4">
            <Trophy size={44} className="mx-auto text-amber-400" />
            <p className="text-4xl font-black text-foreground">{result.correct}/{result.total}</p>
            <p className="text-base font-semibold text-foreground">{result.note}</p>
            <Button className="w-full" size="lg" onClick={() => { setPlay(null); setResult(null); }}>
              {tr(lang, 'Musobaqaga qaytish', 'Вернуться к соревнованию')}
            </Button>
          </div>
        ) : (
          <GameRunner title={play.title} questions={play.questions} lang={lang} onDone={(c) => void finish(play, c)} onExit={() => { setPlay(null); void load(); }} />
        )}
      </div>
    );
  }

  if (group === undefined) return <div className="py-10 text-center text-muted-foreground"><Loader2 className="mx-auto animate-spin" /></div>;

  const level = levelOf(xp, lang);
  const ordered = [...duels].sort((a, b) => Number(duelState(b) === 'my-turn') - Number(duelState(a) === 'my-turn'));

  return (
    <div className="space-y-3">
      <div className={card}>
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-amber-400/15 text-amber-400 flex items-center justify-center text-lg font-black">{level.level}</div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-bold text-muted-foreground">{tr(lang, 'Darajangiz', 'Ваш уровень')}</p>
            <p className="text-base font-extrabold text-foreground truncate">{level.name}</p>
          </div>
          <p className="text-xl font-black text-amber-400">{xp} XP</p>
        </div>
        <div className="h-2.5 rounded-full bg-secondary overflow-hidden">
          <div className="h-full rounded-full bg-amber-400" style={{ width: `${level.progress}%` }} />
        </div>
        <p className="text-xs text-muted-foreground">
          {level.to === null ? tr(lang, 'Eng yuqori daraja!', 'Высший уровень!') : tr(lang, `Keyingi darajagacha ${level.to - xp} XP`, `До следующего уровня ${level.to - xp} XP`)}
        </p>
      </div>

      {error && <p className="text-sm font-semibold text-rose-400 px-1">{error}</p>}

      {!group ? (
        <div className={`${card} text-center`}>
          <p className="text-sm text-muted-foreground">
            {tr(lang, "Musobaqa guruhingiz ichida o'tadi. Guruh havolasi orqali qo'shiling, keyin chellenj va duellar ochiladi.", 'Соревнование идёт внутри группы. Вступите по ссылке группы, и откроются челлендж и дуэли.')}
          </p>
        </div>
      ) : (
        <>
          <div className={card}>
            <div className="flex items-center gap-2">
              <Flame size={20} className="text-orange-400" />
              <h2 className="text-base font-extrabold text-foreground">{tr(lang, 'Kunlik chellenj', 'Ежедневный челлендж')}</h2>
            </div>
            <p className="text-sm text-muted-foreground">
              {tr(lang, `Bugun butun guruh uchun bir xil ${CHALLENGE_SIZE} ta savol. Har to'g'ri javob 20 XP.`, `Сегодня одни и те же ${CHALLENGE_SIZE} вопросов для всей группы. Каждый верный ответ 20 XP.`)}
            </p>
            {done ? (
              <p className="text-sm font-bold text-emerald-400">{tr(lang, `Bugun bajarildi: ${done.correct}/${done.total}. Ertaga yangi savollar.`, `Сегодня выполнено: ${done.correct}/${done.total}. Завтра новые вопросы.`)}</p>
            ) : challenge.length === 0 ? (
              <p className="text-sm text-muted-foreground">{tr(lang, "Guruhingiz testlari hali yuklanmagan.", 'Тесты группы ещё не загружены.')}</p>
            ) : (
              <Button className="w-full" onClick={() => setPlay({ kind: 'challenge', title: tr(lang, 'Kunlik chellenj', 'Ежедневный челлендж'), questions: challenge.map((p) => p.question) })}>
                {tr(lang, 'Boshlash', 'Начать')}
              </Button>
            )}
          </div>

          <div className={card}>
            <div className="flex items-center gap-2">
              <Swords size={20} className="text-sky-400" />
              <h2 className="text-base font-extrabold text-foreground">{tr(lang, 'Duel', 'Дуэль')}</h2>
            </div>
            <p className="text-sm text-muted-foreground">
              {tr(lang, `Guruhingizdan darajasi sizga eng yaqin talaba bilan ${DUEL_SIZE} ta savol. G'alaba 50 XP, durang 25, mag'lubiyat 10.`, `${DUEL_SIZE} вопросов против студента группы с самым близким уровнем. Победа 50 XP, ничья 25, поражение 10.`)}
            </p>
            {choosing ? (
              <div className="space-y-2">
                <p className="text-xs font-bold text-muted-foreground">{tr(lang, 'Qaysi test bo\'yicha?', 'По какому тесту?')}</p>
                {duelSets.map((s) => (
                  <button key={s.id} disabled={busy} onClick={() => void begin(s)} className="w-full text-left p-3 rounded-2xl border border-border bg-background text-sm font-semibold text-foreground hover:border-primary/60 disabled:opacity-50">
                    {s.title}
                  </button>
                ))}
                <Button variant="ghost" size="sm" onClick={() => setChoosing(false)}>{tr(lang, 'Bekor qilish', 'Отмена')}</Button>
              </div>
            ) : duelSets.length === 0 ? (
              <p className="text-sm text-muted-foreground">{tr(lang, "Duel uchun guruh testlari hali yuklanmagan.", 'Тесты группы для дуэли ещё не загружены.')}</p>
            ) : (
              <Button className="w-full" variant="secondary" onClick={() => { setError(null); setChoosing(true); }}>
                {tr(lang, 'Duel boshlash', 'Начать дуэль')}
              </Button>
            )}

            {ordered.length > 0 && (
              <ul className="divide-y divide-border">
                {ordered.map((d) => {
                  const state = duelState(d);
                  const qs = state === 'my-turn' ? questionsOf(d) : null;
                  return (
                    <li key={d.id} className="py-2.5 flex items-center gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-foreground truncate">{d.their_name}</p>
                        <p className={`text-xs ${state === 'won' ? 'text-emerald-400' : state === 'lost' ? 'text-rose-400' : 'text-muted-foreground'}`}>
                          {duelLabel(state, lang)}
                          {d.my_score !== null && d.their_score !== null ? ` · ${d.my_score}:${d.their_score}` : ''}
                        </p>
                      </div>
                      {state === 'my-turn' && (
                        qs ? (
                          <Button size="sm" onClick={() => setPlay({ kind: 'duel', duel: d, id: d.id, title: qs.title, questions: qs.questions })}>
                            {tr(lang, "O'ynash", 'Играть')}
                          </Button>
                        ) : (
                          <span className="text-xs text-muted-foreground">{tr(lang, 'Test hali yuklanmagan', 'Тест ещё не загружен')}</span>
                        )
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          <div className={card}>
            <div className="flex items-center gap-2">
              <Crown size={20} className="text-amber-400" />
              <h2 className="text-base font-extrabold text-foreground flex-1 truncate">{tr(lang, 'Haftalik reyting', 'Рейтинг недели')}</h2>
              <span className="text-xs text-muted-foreground truncate max-w-[45%]">{group.name}</span>
            </div>
            {rating.length === 0 ? (
              <p className="text-sm text-muted-foreground">{tr(lang, "Bu hafta hali hech kim XP yig'madi. Birinchi bo'ling!", 'На этой неделе ещё никто не набрал XP. Будьте первым!')}</p>
            ) : (
              <ol className="space-y-1">
                {rating.map((r, i) => (
                  <li key={r.user_id} className={`flex items-center gap-3 px-2 py-1.5 rounded-xl ${r.user_id === userId ? 'bg-primary/15' : ''}`}>
                    <span className={`w-6 text-center text-sm font-black ${i === 0 ? 'text-amber-400' : i === 1 ? 'text-slate-300' : i === 2 ? 'text-orange-400' : 'text-muted-foreground'}`}>{i + 1}</span>
                    <span className="flex-1 text-sm font-semibold text-foreground truncate">{r.first_name}{r.user_id === userId ? tr(lang, ' (siz)', ' (вы)') : ''}</span>
                    <span className="text-sm font-bold text-amber-400">{r.xp} XP</span>
                  </li>
                ))}
              </ol>
            )}
          </div>
        </>
      )}
    </div>
  );
};
