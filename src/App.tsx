import React, { useState, useEffect, lazy, Suspense, useCallback } from 'react';
import { Routes, Route, Navigate, useLocation, useNavigate, useParams } from 'react-router-dom';
import { ToastContainer, toast } from './components/ui/Toast';
import { Button } from './components/ui/Button';
import { BottomNav, TAB_ROOTS } from './components/layout/BottomNav';
import { initStorage, getStudySets, getUserStats, getSubjects, subscribeStorage } from './lib/storage';
import { Language, tr } from './lib/i18n';
import { QuizQuestion, StudySet, Subject, UserStats } from './types';
import { getProgress, pickQuestions, progressKey, type QuizLaunch } from './lib/quizProgress';
import { newCardsLeftToday, newCardsToday } from './lib/dailyPlan';
import { useAuth } from './lib/auth';
import { startSync } from './lib/sync';
import { deliverLibrary } from './lib/library';
import { useAssignments } from './lib/useAssignments';
import { localItem, progressOf } from './lib/assignments';
import { track } from './lib/track';
import { markPrivacySeen, privacySeen } from './lib/privacy';
import { PrivacyNotice } from './components/PrivacyNotice';
import { startTelegram, applyTelegramTheme, useTelegramBackButton, BOT_USERNAME } from './lib/telegram';

// Pages load on demand to keep the first download small on mobile data
const HomePage = lazy(() => import('./pages/HomePage').then((m) => ({ default: m.HomePage })));
const SubjectsPage = lazy(() => import('./pages/SubjectsPage').then((m) => ({ default: m.SubjectsPage })));
const SubjectPage = lazy(() => import('./pages/SubjectPage').then((m) => ({ default: m.SubjectPage })));
const BoardPage = lazy(() => import('./pages/BoardPage').then((m) => ({ default: m.BoardPage })));
const RecallPage = lazy(() => import('./pages/RecallPage').then((m) => ({ default: m.RecallPage })));
const ClozePage = lazy(() => import('./pages/ClozePage').then((m) => ({ default: m.ClozePage })));
const TicketsPage = lazy(() => import('./pages/TicketsPage').then((m) => ({ default: m.TicketsPage })));
const SubjectStatsPage = lazy(() => import('./pages/SubjectStatsPage').then((m) => ({ default: m.SubjectStatsPage })));
const QuestionPracticePage = lazy(() => import('./pages/QuestionPracticePage').then((m) => ({ default: m.QuestionPracticePage })));
const AssignmentsPage = lazy(() => import('./pages/AssignmentsPage').then((m) => ({ default: m.AssignmentsPage })));
const RequestPage = lazy(() => import('./pages/RequestPage').then((m) => ({ default: m.RequestPage })));
const ProfilePage = lazy(() => import('./pages/ProfilePage').then((m) => ({ default: m.ProfilePage })));
const OnboardingPage = lazy(() => import('./pages/OnboardingPage').then((m) => ({ default: m.OnboardingPage })));
const QuizRunner = lazy(() => import('./components/study/QuizRunner').then((m) => ({ default: m.QuizRunner })));
const QuizSetup = lazy(() => import('./components/study/QuizSetup').then((m) => ({ default: m.QuizSetup })));
const FlashcardPlayer = lazy(() => import('./components/study/FlashcardPlayer').then((m) => ({ default: m.FlashcardPlayer })));
const ExamSimulator = lazy(() => import('./components/study/ExamSimulator').then((m) => ({ default: m.ExamSimulator })));

const ONBOARDED_KEY = 'sessiyagatayyorlan_onboarded';

// A test set this large opens on a start screen instead of running all of it at once
const LARGE_QUIZ = 25;

const QuizRoute: React.FC<{ set: StudySet; lang: Language; onFinish: () => void }> = ({ set, lang, onFinish }) => {
  const launch = (useLocation().state ?? {}) as QuizLaunch;
  const [session, setSession] = useState<{ n: number; questions: QuizQuestion[] } | null>(() => {
    if (!launch.autostart) return null;
    const qs = pickQuestions(set.questions ?? [], getProgress(progressKey(set)), { mode: 'mixed', count: launch.count ?? 10 });
    return qs.length ? { n: 0, questions: qs } : null;
  });
  const start = (questions: QuizQuestion[]) => setSession((s) => ({ n: (s?.n ?? 0) + 1, questions }));

  if (!session) {
    return <QuizSetup set={set} lang={lang} onStart={start} onBack={onFinish} />;
  }
  return (
    <QuizRunner
      key={session.n}
      set={set}
      lang={lang}
      onFinish={() => setSession(null)}
      onRetake={() => start(session.questions)}
      session={{
        questions: session.questions,
        onRetryMistakes: (ids) => start((set.questions ?? []).filter((q) => ids.includes(q.id))),
        onMore: () => setSession(null),
      }}
    />
  );
};

// Renders the runner for /study/:id
const StudyRoute: React.FC<{ studySets: StudySet[]; subjects: Subject[]; lang: Language }> = ({ studySets, subjects, lang }) => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [attempt, setAttempt] = useState(0);
  const set = studySets.find((s) => s.id === id);

  if (!set) {
    return (
      <div className="max-w-md mx-auto px-4 py-24 text-center space-y-4">
        <h2 className="text-2xl font-serif font-bold text-foreground">{tr(lang, 'To\'plam topilmadi', 'Набор не найден')}</h2>
        <Button variant="primary" size="md" onClick={() => navigate('/')}>{tr(lang, 'Bosh sahifa', 'На главную')}</Button>
      </div>
    );
  }

  const finish = () => navigate(-1);
  const retake = () => setAttempt((n) => n + 1);
  switch (set.type) {
    case 'quiz':
      if ((set.questions?.length ?? 0) >= LARGE_QUIZ) return <QuizRoute key={set.id} set={set} lang={lang} onFinish={finish} />;
      return <QuizRunner key={attempt} set={set} lang={lang} onFinish={finish} onRetake={retake} />;
    case 'flashcards':
      return <FlashcardPlayer key={attempt} set={set} lang={lang} onFinish={finish} newLimit={newCardsLeftToday(set, subjects, studySets, newCardsToday(set))} />;
    case 'exam':
      return <ExamSimulator key={attempt} set={set} lang={lang} onFinish={finish} onRetake={retake} />;
    default:
      return <Navigate to="/" replace />;
  }
};

const Centered: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="min-h-screen flex items-center justify-center px-6 text-center bg-background text-foreground">
    <div className="max-w-sm space-y-4">{children}</div>
  </div>
);

export default function App() {
  const { status, lang, online, profile, joinedCommunity } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const [studySets, setStudySets] = useState<StudySet[]>(getStudySets());
  const [stats, setStats] = useState<UserStats>(getUserStats());
  const [subjects, setSubjects] = useState<Subject[]>(getSubjects());
  const [onboarded, setOnboarded] = useState(() => localStorage.getItem(ONBOARDED_KEY) === '1');
  const [allowBrowserAccess, setAllowBrowserAccess] = useState(false);

  useEffect(() => {
    initStorage();
    startTelegram();
    return applyTelegramTheme(); // the page is dark from the start (index.html)
  }, []);

  useEffect(
    () =>
      subscribeStorage(() => {
        setStudySets(getStudySets());
        setStats(getUserStats());
        setSubjects(getSubjects());
      }),
    []
  );

  useEffect(() => {
    if (online) track('app_open', { oncePerSession: true });
  }, [online]);

  // Mirror local data to Supabase while signed in
  // Content is delivered only after the first sync has finished, or an old cloud copy of something
  // the admin has since taken back could come down again. Not waiting forever if the network is slow.
  // The data notice is shown once, before the student uses anything
  const privacyStore = (() => {
    try {
      return window.localStorage;
    } catch {
      return null;
    }
  })();
  const [privacyOk, setPrivacyOk] = useState(() => privacySeen(privacyStore));
  const [synced, setSynced] = useState(false);
  useEffect(() => {
    if (!online) return;
    const fallback = setTimeout(() => setSynced(true), 8000);
    const stop = startSync((s) => {
      if (s === 'error') console.warn('Cloud sync failed; data is still saved on this device.');
      if (s === 'synced' || s === 'error') setSynced(true);
    });
    return () => {
      clearTimeout(fallback);
      stop();
    };
  }, [online, profile?.id]);

  // Students create nothing: whatever the admin published for them arrives (and updates) by itself
  useEffect(() => {
    if (!online || !synced || profile?.role !== 'student') return;
    deliverLibrary().catch((e) => {
      console.warn('Library delivery failed', e);
      if (e instanceof Error && e.name === 'StorageFullError') toast.error(tr(lang, "Telefon xotirasi to'lgan: yangi fanlar yuklanmadi. Eski ma'lumotlarni tozalang.", 'Память телефона заполнена: новые предметы не загружены. Освободите место.'));
    });
  }, [online, synced, profile?.id, profile?.role]);

  const isStudent = online && synced && profile?.role === 'student';
  const { assignments, server: assignmentProgress } = useAssignments(isStudent, subjects, studySets);
  // Tab badge: assignments not finished yet
  const openAssignments = (assignments ?? []).filter((a) => {
    const mine = progressOf(localItem(a, subjects, studySets));
    return (mine.status === 'new' ? assignmentProgress[a.id]?.status : mine.status) !== 'done';
  }).length;

  useEffect(() => {
    if (joinedCommunity) toast.success(tr(lang, `«${joinedCommunity}» guruhiga qo'shildingiz`, `Вы в группе «${joinedCommunity}»`));
  }, [joinedCommunity]);

  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [location.pathname]);

  const goBack = useCallback(() => navigate(-1), [navigate]);
  const isTabRoot = TAB_ROOTS.includes(location.pathname);
  useTelegramBackButton(!isTabRoot, goBack);

  if (status === 'loading') {
    return (
      <Centered>
        <div className="w-10 h-10 mx-auto rounded-full border-4 border-primary/20 border-t-primary animate-spin" />
      </Centered>
    );
  }
  if (status === 'outside' && !allowBrowserAccess) {
    return (
      <Centered>
        <h1 className="text-2xl font-serif font-bold">Sessiyaga tayyorlan</h1>
        <p className="text-sm text-muted-foreground">
          {tr(lang, 'Ilova Telegram ichida ishlaydi. Botni oching va «Ochish» tugmasini bosing.', 'Приложение работает внутри Telegram. Откройте бота и нажмите «Открыть».')}
        </p>
        {BOT_USERNAME && (
          <a href={`https://t.me/${BOT_USERNAME}`} className="inline-block px-5 py-2.5 rounded-xl bg-primary text-primary-foreground font-semibold text-sm">
            @{BOT_USERNAME}
          </a>
        )}
        <button
          onClick={() => setAllowBrowserAccess(true)}
          className="text-xs text-muted-foreground underline pt-4 cursor-pointer hover:text-foreground"
        >
          {tr(lang, "Brauzerda davom etish", 'Продолжить в браузере')}
        </button>
      </Centered>
    );
  }
  if (status === 'error') {
    return (
      <Centered>
        <p className="text-sm text-muted-foreground">{tr(lang, 'Kirishda xatolik. Ilovani qayta oching.', 'Ошибка входа. Откройте приложение заново.')}</p>
        <Button variant="primary" onClick={() => window.location.reload()}>{tr(lang, 'Qayta urinish', 'Повторить')}</Button>
      </Centered>
    );
  }

  const loading = <div className="py-24 text-center text-sm text-muted-foreground">{tr(lang, 'Yuklanmoqda...', 'Загрузка...')}</div>;

  if (!onboarded && online && !profile?.university) {
    return (
      <Suspense fallback={loading}>
        <OnboardingPage
          onDone={() => {
            localStorage.setItem(ONBOARDED_KEY, '1');
            setOnboarded(true);
          }}
        />
        <ToastContainer />
      </Suspense>
    );
  }

  // Derived from card states, so re-rating the same card can't inflate it

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col font-sans pb-28">
      <main className="flex-1">
        <Suspense fallback={loading}>
          <Routes>
            <Route path="/" element={<HomePage subjects={subjects} studySets={studySets} stats={stats} lang={lang} />} />
            <Route path="/subjects" element={<SubjectsPage subjects={subjects} studySets={studySets} lang={lang} />} />
            <Route path="/subjects/:id" element={<SubjectPage subjects={subjects} studySets={studySets} lang={lang} />} />
            <Route path="/subjects/:id/board" element={<BoardPage subjects={subjects} lang={lang} />} />
            <Route path="/subjects/:id/recall" element={<RecallPage subjects={subjects} lang={lang} />} />
            <Route path="/subjects/:id/cloze" element={<ClozePage subjects={subjects} lang={lang} />} />
            <Route path="/subjects/:id/tickets" element={<TicketsPage subjects={subjects} lang={lang} />} />
            <Route path="/subjects/:id/stats" element={<SubjectStatsPage subjects={subjects} studySets={studySets} lang={lang} />} />
            <Route path="/subjects/:id/q/:qid" element={<QuestionPracticePage subjects={subjects} lang={lang} />} />
            <Route path="/study/:id" element={<StudyRoute studySets={studySets} subjects={subjects} lang={lang} />} />
            <Route path="/assignments" element={<AssignmentsPage assignments={assignments} server={assignmentProgress} subjects={subjects} studySets={studySets} lang={lang} staff={online && !!profile && profile.role !== 'student'} />} />
            <Route path="/request" element={<RequestPage lang={lang} />} />
            <Route path="/library" element={<Navigate to="/request" replace />} />
            <Route path="/profile" element={<ProfilePage lang={lang} />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </main>
      <BottomNav lang={lang} openAssignments={openAssignments} />
      {online && !privacyOk && (
        <PrivacyNotice
          lang={lang}
          onAccept={() => {
            markPrivacySeen(privacyStore);
            setPrivacyOk(true);
          }}
        />
      )}
      <ToastContainer />
    </div>
  );
}
