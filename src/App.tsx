import React, { useState, useEffect, lazy, Suspense, useCallback } from 'react';
import { Routes, Route, Navigate, useLocation, useNavigate, useParams } from 'react-router-dom';
import { ToastContainer, toast } from './components/ui/Toast';
import { Button } from './components/ui/Button';
import { BottomNav, TAB_ROOTS } from './components/layout/BottomNav';
import { initStorage, getStudySets, getUserStats, getSubjects, subscribeStorage } from './lib/storage';
import { Language, tr } from './lib/i18n';
import { StudySet, Subject, UserStats } from './types';
import { isMastered } from './lib/srs';
import { useAuth } from './lib/auth';
import { startSync } from './lib/sync';
import { startTelegram, applyTelegramTheme, useTelegramBackButton, BOT_USERNAME } from './lib/telegram';

// Pages load on demand to keep the first download small on mobile data
const HomePage = lazy(() => import('./pages/HomePage').then((m) => ({ default: m.HomePage })));
const SubjectsPage = lazy(() => import('./pages/SubjectsPage').then((m) => ({ default: m.SubjectsPage })));
const SubjectPage = lazy(() => import('./pages/SubjectPage').then((m) => ({ default: m.SubjectPage })));
const QuestionPracticePage = lazy(() => import('./pages/QuestionPracticePage').then((m) => ({ default: m.QuestionPracticePage })));
const LibraryPage = lazy(() => import('./pages/LibraryPage').then((m) => ({ default: m.LibraryPage })));
const ProfilePage = lazy(() => import('./pages/ProfilePage').then((m) => ({ default: m.ProfilePage })));
const AdminPage = lazy(() => import('./pages/AdminPage').then((m) => ({ default: m.AdminPage })));
const OnboardingPage = lazy(() => import('./pages/OnboardingPage').then((m) => ({ default: m.OnboardingPage })));
const SetEditorPage = lazy(() => import('./pages/SetEditorPage').then((m) => ({ default: m.SetEditorPage })));
const QuizRunner = lazy(() => import('./components/study/QuizRunner').then((m) => ({ default: m.QuizRunner })));
const FlashcardPlayer = lazy(() => import('./components/study/FlashcardPlayer').then((m) => ({ default: m.FlashcardPlayer })));
const NotesViewer = lazy(() => import('./components/study/NotesViewer').then((m) => ({ default: m.NotesViewer })));
const ExamSimulator = lazy(() => import('./components/study/ExamSimulator').then((m) => ({ default: m.ExamSimulator })));

const ONBOARDED_KEY = 'tayyorman_onboarded';

// Renders the runner for /study/:id
const StudyRoute: React.FC<{ studySets: StudySet[]; lang: Language }> = ({ studySets, lang }) => {
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
      return <QuizRunner key={attempt} set={set} lang={lang} onFinish={finish} onRetake={retake} />;
    case 'flashcards':
      return <FlashcardPlayer key={attempt} set={set} lang={lang} onFinish={finish} />;
    case 'notes':
      return <NotesViewer set={set} lang={lang} onBack={finish} />;
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
  const [forceDemo, setForceDemo] = useState(false);

  useEffect(() => {
    initStorage();
    startTelegram();
    return applyTelegramTheme((scheme) => document.documentElement.classList.toggle('dark', scheme === 'dark'));
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

  // Mirror local data to Supabase while signed in
  useEffect(() => {
    if (!online) return;
    return startSync((s) => {
      if (s === 'error') console.warn('Cloud sync failed; data is still saved on this device.');
    });
  }, [online, profile?.id]);

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
  if (status === 'outside' && !forceDemo) {
    return (
      <Centered>
        <h1 className="text-2xl font-serif font-bold">Tayyorman</h1>
        <p className="text-sm text-muted-foreground">
          {tr(lang, 'Ilova Telegram ichida ishlaydi. Botni oching va «Ochish» tugmasini bosing.', 'Приложение работает внутри Telegram. Откройте бота и нажмите «Открыть».')}
        </p>
        {BOT_USERNAME && (
          <a href={`https://t.me/${BOT_USERNAME}`} className="inline-block px-5 py-2.5 rounded-xl bg-primary text-primary-foreground font-semibold text-sm">
            @{BOT_USERNAME}
          </a>
        )}
        <button
          onClick={() => setForceDemo(true)}
          className="text-xs text-muted-foreground underline pt-4 cursor-pointer hover:text-foreground"
        >
          {tr(lang, "Brauzerda ko'rish (Demo)", 'Открыть в браузере (Демо)')}
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
  const cardsMastered = studySets.reduce((sum, s) => sum + (s.flashcards?.filter(isMastered).length ?? 0), 0);

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col font-sans pb-20">
      <main className="flex-1">
        <Suspense fallback={loading}>
          <Routes>
            <Route path="/" element={<HomePage subjects={subjects} studySets={studySets} stats={{ ...stats, cardsMastered }} lang={lang} />} />
            <Route path="/subjects" element={<SubjectsPage subjects={subjects} studySets={studySets} lang={lang} />} />
            <Route path="/subjects/:id" element={<SubjectPage subjects={subjects} studySets={studySets} lang={lang} />} />
            <Route path="/subjects/:id/q/:qid" element={<QuestionPracticePage subjects={subjects} lang={lang} />} />
            <Route path="/study/:id" element={<StudyRoute studySets={studySets} lang={lang} />} />
            <Route path="/study/:id/edit" element={<SetEditorPage studySets={studySets} lang={lang} />} />
            <Route path="/library" element={<LibraryPage subjects={subjects} studySets={studySets} lang={lang} />} />
            <Route path="/profile" element={<ProfilePage lang={lang} />} />
            <Route path="/admin" element={<AdminPage subjects={subjects} studySets={studySets} lang={lang} />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </main>
      <BottomNav lang={lang} />
      <ToastContainer />
    </div>
  );
}
