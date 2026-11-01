import { StudySet, UserStats, Language, Subject } from '../types';

const STORAGE_KEYS = {
  SETS: 'sessiyagatayyorlan_study_sets',
  SUBJECTS: 'sessiyagatayyorlan_subjects',
  STATS: 'sessiyagatayyorlan_user_stats',
  LANG: 'sessiyagatayyorlan_language',
  THEME: 'sessiyagatayyorlan_theme',
};

// Listeners for reactive updates
type StorageListener = () => void;
const listeners: Set<StorageListener> = new Set();

export function subscribeStorage(callback: StorageListener): () => void {
  listeners.add(callback);
  return () => listeners.delete(callback);
}

function notifyListeners() {
  listeners.forEach((fn) => fn());
}

// Clean fresh new user stats
const defaultStats: UserStats = {
  streakDays: 0,
  lastStudyDate: '',
  quizzesTaken: 0,
  cardsMastered: 0,
  totalStudyMinutes: 0,
  averageScore: 0,
};

// Initialize default data if empty (fresh start)
export function initStorage(): void {
  if (typeof window === 'undefined') return;
  
  // Migrate legacy keys if present
  if (localStorage.getItem(STORAGE_KEYS.SETS) === null && localStorage.getItem('tayyorman_study_sets')) {
    localStorage.setItem(STORAGE_KEYS.SETS, localStorage.getItem('tayyorman_study_sets')!);
  }
  if (localStorage.getItem(STORAGE_KEYS.SUBJECTS) === null && localStorage.getItem('tayyorman_subjects')) {
    localStorage.setItem(STORAGE_KEYS.SUBJECTS, localStorage.getItem('tayyorman_subjects')!);
  }
  if (localStorage.getItem(STORAGE_KEYS.STATS) === null && localStorage.getItem('tayyorman_user_stats')) {
    localStorage.setItem(STORAGE_KEYS.STATS, localStorage.getItem('tayyorman_user_stats')!);
  }
  if (localStorage.getItem(STORAGE_KEYS.LANG) === null && localStorage.getItem('tayyorman_language')) {
    localStorage.setItem(STORAGE_KEYS.LANG, localStorage.getItem('tayyorman_language')!);
  }

const STARTER_SUBJECT_MATH_ID = 'starter-subject-matem';
const STARTER_SUBJECT_SEC_ID = 'starter-subject-security';
const STARTER_SUBJECT_PROG_ID = 'starter-subject-prog';

const starterSubjects: Subject[] = [
  {
    id: STARTER_SUBJECT_SEC_ID,
    name: 'Axborot xavfsizligi',
    examDate: new Date(Date.now() + 9 * 86400000).toISOString().split('T')[0],
    examFormat: 'test',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    materials: [],
    questions: [
      {
        id: 'q-sec-bilet-1',
        text: 'Axborot xavfsizligining asosiy triadasi (CIA) nimalardan iborat?',
        modelAnswer: {
          summary: 'Axborot xavfsizligi uchta asosiy ustunga tayanadi: Maxfiylik, Butunlik va Foydalana olishlik.',
          keyPoints: [
            'Maxfiylik (Confidentiality) — ma\'lumot faqat ruxsati bor shaxslarga ochiq bo\'lishi.',
            'Butunlik (Integrity) — ma\'lumotning ruxsatsiz o\'zgartirilmasligi va to\'liqligi.',
            'Foydalana olishlik (Availability) — zarur paytda tizim va ma\'lumotning ishlashga tayyorligi.',
          ],
          sources: ['Axborot xavfsizligi ma\'ruzalar kursi, 1-mavzu'],
        },
        attempts: [],
      },
      {
        id: 'q-sec-bilet-2',
        text: 'Simmetrik va asimmetrik shifrlash algoritmlarining farqi nimada?',
        modelAnswer: {
          summary: 'Simmetrik shifrlashda 1 ta umumiy kalit, asimmetrikda esa 2 ta (ochiq va yopiq) kalit ishlatiladi.',
          keyPoints: [
            'Simmetrik: AES, DES kabi algoritmlar. Juda tez ishlaydi, katta hajmdagi ma\'lumotlar uchun mos.',
            'Asimmetrik: RSA, ECC kabi algoritmlar. Ochiq kalit (shifrlash) va yopiq kalit (ochish) juftligi.',
            'Asimmetrik shifrlash kalitlarni xavfsiz almashish va raqamli imzo uchun asosiy vositadir.',
          ],
          sources: ['Amaliy kriptografiya, 3-bob'],
        },
        attempts: [],
      },
    ],
  },
  {
    id: STARTER_SUBJECT_MATH_ID,
    name: 'Oliy matematika',
    examDate: new Date(Date.now() + 14 * 86400000).toISOString().split('T')[0],
    examFormat: 'test',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    materials: [],
    questions: [
      {
        id: 'q-mat-bilet-1',
        text: "Funksiyaning hosilasi ta'rifi va uning geometrik ma'nosi nima?",
        modelAnswer: {
          summary: "Hosilaning geometrik ma'nosi — urinmaning burchak koeffitsiyenti (tangensi)ga teng.",
          keyPoints: [
            "Hosila — argument orttirmasi nolga intilgandagi funksiya orttirmasining argument orttirmasiga nisbatining limiti.",
            "k = f'(x0) = tg(alpha) tengligi urinmaning qiyalik burchagini ifodalaydi.",
          ],
          sources: ['Matematik analiz, 2-qism'],
        },
        attempts: [],
      },
      {
        id: 'q-mat-bilet-2',
        text: 'Matritsaning determinanti va Kramar qoidasi nima?',
        modelAnswer: {
          summary: "Kramar usuli — determinantlar orqali chiziqli tenglamalar sistemasini yechish usulidir.",
          keyPoints: [
            "Sistema determinanti Delta != 0 bo'lgandagina yagona yechimga ega bo'ladi.",
            "Noma'lumlar xi = Delta_i / Delta formulasi orqali topiladi.",
          ],
          sources: ['Chiziqli algebra, 1-mavzu'],
        },
        attempts: [],
      },
    ],
  },
  {
    id: STARTER_SUBJECT_PROG_ID,
    name: 'Dasturlash asoslari (Python)',
    examDate: new Date(Date.now() + 21 * 86400000).toISOString().split('T')[0],
    examFormat: 'written',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    materials: [],
    questions: [
      {
        id: 'q-prog-bilet-1',
        text: 'Python tilida List va Tuple ma\'lumot turlarining asosiy farqlari nimalar?',
        modelAnswer: {
          summary: 'List — o\'zgaruvchan (mutable), Tuple esa o\'zgarmas (immutable) to\'plam turidir.',
          keyPoints: [
            'List kvadrat qavslar [] bilan yoziladi, elementlarini qo\'shish yoki o\'chirish mumkin.',
            'Tuple dumaloq qavslar () bilan yaratiladi, uning elementlarini yaratilgandan so\'ng o\'zgartirib bo\'lmaydi.',
            'Tuple xotiradan kamroq joy oladi va Dictionary kalitlari sifatida ishlatilishi mumkin.',
          ],
          sources: ['Python Documentation, Data Structures'],
        },
        attempts: [],
      },
    ],
  },
];

const starterSets: StudySet[] = [
  {
    id: 'starter-set-security',
    title: 'Axborot xavfsizligi (Hemis yakuniy testlar)',
    type: 'exam',
    description: 'Hemis tizimi standarti: CIA triadasi, shifrlash, xeshlash va kiberxavfsizlik.',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    itemCount: 6,
    difficulty: 'medium',
    sourceType: 'text',
    subjectId: STARTER_SUBJECT_SEC_ID,
    questions: [
      {
        id: 'q-sec-1',
        question: 'Axborot xavfsizligining asosiy tarkibiy qismlari (triadasi) qaysilar?',
        options: [
          'Maxfiylik, butunlik, foydalana olishlik',
          'Faqat maxfiylik va identifikatsiya',
          'Autentifikatsiya, audit, nazorat',
          'Faqat zaxira nusxalash va himoya',
        ],
        correctAnswer: 0,
        hint: 'CIA triadasi: Confidentiality, Integrity, Availability.',
        explanation: 'To\'g\'ri javob: Maxfiylik, butunlik, foydalana olishlik.',
      },
      {
        id: 'q-sec-2',
        question: 'Qaysi algoritm asimmetrik shifrlashga misol bo\'ladi?',
        options: ['RSA', 'AES', 'DES', 'RC4'],
        correctAnswer: 0,
        hint: 'Ochiq va yopiq kalitlar juftligi ishlatiladigan mashhur algoritm.',
        explanation: 'To\'g\'ri javob: RSA — asimmetrik algoritm. AES va DES esa simmetrik shifrlashdir.',
      },
      {
        id: 'q-sec-3',
        question: 'Xesh-funksiyalarning (masalan SHA-256) asosiy xususiyati nima?',
        options: [
          'Bir tomonlama (qaytmas) va ixtiyoriy hajmdagi ma\'lumotdan qat\'iy uzunlikdagi xesh hosil qiladi',
          'Osonlikcha orqaga qaytarib asl matnni olish mumkin',
          'Faqat matnlarni siqish uchun ishlatiladi',
          'Har doim o\'zgaruvchan uzunlikdagi xesh qaytaradi',
        ],
        correctAnswer: 0,
        hint: 'Xeshdan asl matnni qayta tiklashning iloji yo\'q.',
        explanation: 'To\'g\'ri javob: Xesh bir tomonlama qaytmas funksiya bo\'lib, yaxlitlikni tekshirish uchun xizmat qiladi.',
      },
      {
        id: 'q-sec-4',
        question: 'DDoS (Distributed Denial of Service) hujumining asosiy maqsadi nima?',
        options: [
          'Tizimni so\'rovlar bilan to\'ldirib, foydalana olishlikni (Availability) buzish',
          'Foydalanuvchilarning parollarini shifrdan chiqarish',
          'Ma\'lumotlar bazasini o\'chirib tashlash',
          'Kompyuterga troyan virusi o\'rnatish',
        ],
        correctAnswer: 0,
        hint: 'Availability (foydalana olishlik)ga qarshi qaratilgan.',
        explanation: 'To\'g\'ri javob: Tizim yoki serverni haddan tashqari ko\'p soxta so\'rovlar bilan to\'ldirib, haqiqiy foydalanuvchilar uchun xizmat ko\'rsatishni to\'xtatish.',
      },
      {
        id: 'q-sec-5',
        question: 'Raqamli imzo (Digital Signature) nimani kafolatlaydi?',
        options: [
          'Hujjatning yaxlitligi, haqiqiyligi va mualliflikni rad etib bo\'lmasligini',
          'Faqat hujjat hajmini kichraytirishni',
          'Hujjatdagi imloni tekshirishni',
          'Faqat matnni shifrlab yashirishni',
        ],
        correctAnswer: 0,
        hint: 'Non-repudiation va Integrity.',
        explanation: 'To\'g\'ri javob: Raqamli imzo xabarning jo\'natuvchisi haqiqiyligini va yo\'lda o\'zgartirilmaganligini kafolatlaydi.',
      },
      {
        id: 'q-sec-6',
        question: 'Ko\'p faktorli autentifikatsiya (MFA / 2FA) qanday ishlaydi?',
        options: [
          'Foydalanuvchini kamida 2 xil mustaqil faktor (parol + SMS/OTP kod) orqali tasdiqlash',
          'Foydalanuvchiga 2 marta bir xil parolni terdirish',
          'Faqat 2 ta akkaunt ochishni talab qilish',
          'Antivirus orqali tekshirish',
        ],
        correctAnswer: 0,
        hint: 'Something you know + Something you have.',
        explanation: 'To\'g\'ri javob: Parol va telefon/ilova orqali keladigan bir martalik tasdiqlash kodi kabi 2 faktor kombinatsiyasi.',
      },
    ],
  },
  {
    id: 'starter-set-matem',
    title: 'Oliy matematika: 1-Oraliq testlari',
    type: 'exam',
    description: 'Oraliq nazorat: Hosilalar, integrallar, matritsalar va determinantlar.',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    itemCount: 4,
    difficulty: 'medium',
    sourceType: 'text',
    subjectId: STARTER_SUBJECT_MATH_ID,
    questions: [
      {
        id: 'q-mat-1',
        question: 'y = x^2 funksiyasining hosilasi nimaga teng?',
        options: ['2x', 'x', 'x^3', '2'],
        correctAnswer: 0,
        hint: "Daraja qoidasini qo'llang: (x^n)' = n*x^(n-1)",
        explanation: "To'g'ri javob: 2x. (x^2)' = 2*x^(2-1) = 2x.",
      },
      {
        id: 'q-mat-2',
        question: "Qanday matritsaning teskarisi (A^(-1)) mavjud bo'ladi?",
        options: [
          "Determinanti nolga teng bo'lmagan kvadrat matritsa",
          "Ixtiyoriy to'g'ri burchakli matritsa",
          'Faqat birlik matritsa',
          'Barcha elementlari musbat matritsa',
        ],
        correctAnswer: 0,
        hint: 'det(A) != 0 shartini eslang.',
        explanation: "To'g'ri javob: det(A) != 0 bo'lgan kvadrat matritsaning teskari matritsasi mavjud.",
      },
      {
        id: 'q-mat-3',
        question: 'Integral ∫ 2x dx nimaga teng?',
        options: ['x^2 + C', '2x^2 + C', 'x + C', '2 + C'],
        correctAnswer: 0,
        hint: 'Hosilaning teskari amali.',
        explanation: "To'g'ri javob: x^2 + C. Chunki (x^2 + C)' = 2x.",
      },
      {
        id: 'q-mat-4',
        question: "Ikkita vektorning skalyar ko'paytmasi nolga teng bo'lsa, bu vektorlar qanday joylashgan?",
        options: ["O'zaro perpendikulyar (ortogonal)", 'Parallel', 'Ustma-ust tushadi', "Qarama-qarshi yo'nalgan"],
        correctAnswer: 0,
        hint: 'cos(90°) = 0.',
        explanation: "To'g'ri javob: a * b = |a|*|b|*cos(α) = 0 bo'lsa, α = 90°, ya'ni vektorlar o'zaro perpendikulyar.",
      },
    ],
  },
  {
    id: 'starter-set-prog-cards',
    title: 'Python asoslari (FSRS Kartochkalar)',
    type: 'flashcards',
    description: 'Python asosiy tushunchalari va ma\'lumotlar turlari.',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    itemCount: 4,
    difficulty: 'easy',
    sourceType: 'text',
    subjectId: STARTER_SUBJECT_PROG_ID,
    flashcards: [
      {
        id: 'fc-1',
        front: 'Mutable va Immutable farqi nima?',
        back: 'Mutable (o\'zgaruvchan: list, dict, set) xotiradagi o\'rnida o\'zgartirilishi mumkin. Immutable (int, str, tuple) esa o\'zgarmasdir.',
      },
      {
        id: 'fc-2',
        front: 'Python-da *args va **kwargs nima vazifa bajaradi?',
        back: '*args funksiyaga istalgancha pozitsion argumentlarni tuple ko\'rinishida, **kwargs esa kalit-qiymatli argumentlarni dict ko\'rinishida qabul qiladi.',
      },
      {
        id: 'fc-3',
        front: 'Generator va Return o\'rtasidagi farq?',
        back: 'Generator qiymatlarni bittalab hosil qilish uchun `yield` kalit so\'zini ishlatadi va butun ro\'yxatni xotirada saqlamasdan, zarur bo\'lganda bittadan hisoblaydi.',
      },
      {
        id: 'fc-4',
        front: 'Big-O O(1) va O(n) nimani anglatadi?',
        back: 'O(1) — amallar soni ma\'lumot hajmidan qat\'i nazar doimiy (masalan dict kalitiga murojaat). O(n) — bajarilish vaqti massiv elementlari soniga chiziqli bog\'liq.',
      },
    ],
  },
];

  if (localStorage.getItem(STORAGE_KEYS.SUBJECTS) === null) {
    localStorage.setItem(STORAGE_KEYS.SUBJECTS, JSON.stringify(starterSubjects));
  }
  if (localStorage.getItem(STORAGE_KEYS.SETS) === null) {
    localStorage.setItem(STORAGE_KEYS.SETS, JSON.stringify(starterSets));
  }
  if (localStorage.getItem(STORAGE_KEYS.STATS) === null) {
    localStorage.setItem(STORAGE_KEYS.STATS, JSON.stringify(defaultStats));
  }
}

// Reset to a brand new clean account
export function resetToFreshState(): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEYS.SETS, JSON.stringify([]));
  localStorage.setItem(STORAGE_KEYS.STATS, JSON.stringify(defaultStats));
  notifyListeners();
}

// Study Sets
export function getStudySets(): StudySet[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.SETS);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch (e) {
    console.error('Failed to parse study sets from storage', e);
    return [];
  }
}

// Local writes are reported here so the cloud sync (lib/sync.ts) can mirror them
export type LocalChange =
  | { kind: 'set'; op: 'upsert'; value: StudySet }
  | { kind: 'subject'; op: 'upsert'; value: Subject }
  | { kind: 'set' | 'subject'; op: 'delete'; id: string };

const changeHooks = new Set<(change: LocalChange) => void>();

export function onLocalChange(fn: (change: LocalChange) => void): () => void {
  changeHooks.add(fn);
  return () => changeHooks.delete(fn);
}

export class StorageFullError extends Error {
  constructor() {
    super('Browser storage is full');
    this.name = 'StorageFullError';
  }
}

function writeJson(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    if (e instanceof DOMException && e.name === 'QuotaExceededError') throw new StorageFullError();
    throw e;
  }
}

function upsertById<T extends { id: string }>(list: T[], item: T): T[] {
  const index = list.findIndex((x) => x.id === item.id);
  if (index < 0) return [item, ...list];
  const copy = [...list];
  copy[index] = item;
  return copy;
}

export function saveStudySet(set: StudySet, opts: { fromSync?: boolean } = {}): void {
  const value = opts.fromSync ? set : { ...set, updatedAt: Date.now() };
  writeJson(STORAGE_KEYS.SETS, upsertById(getStudySets(), value));
  if (!opts.fromSync) changeHooks.forEach((fn) => fn({ kind: 'set', op: 'upsert', value }));
  notifyListeners();
}

export function deleteStudySet(id: string, opts: { fromSync?: boolean } = {}): void {
  writeJson(STORAGE_KEYS.SETS, getStudySets().filter((s) => s.id !== id));
  if (!opts.fromSync) changeHooks.forEach((fn) => fn({ kind: 'set', op: 'delete', id }));
  notifyListeners();
}

// Subjects (fan): materials + exam question list
export function getSubjects(): Subject[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.SUBJECTS);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function getSubjectById(id: string): Subject | undefined {
  return getSubjects().find((s) => s.id === id);
}

export function saveSubject(subject: Subject, opts: { fromSync?: boolean } = {}): void {
  const value = opts.fromSync ? subject : { ...subject, updatedAt: Date.now() };
  writeJson(STORAGE_KEYS.SUBJECTS, upsertById(getSubjects(), value));
  if (!opts.fromSync) changeHooks.forEach((fn) => fn({ kind: 'subject', op: 'upsert', value }));
  notifyListeners();
}

export function deleteSubject(id: string, opts: { fromSync?: boolean } = {}): void {
  writeJson(STORAGE_KEYS.SUBJECTS, getSubjects().filter((s) => s.id !== id));
  if (!opts.fromSync) changeHooks.forEach((fn) => fn({ kind: 'subject', op: 'delete', id }));
  notifyListeners();
}

export function newId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function getStudySetById(id: string): StudySet | undefined {
  const sets = getStudySets();
  return sets.find((s) => s.id === id);
}

// User Stats & Streak
export function getUserStats(): UserStats {
  if (typeof window === 'undefined') return defaultStats;
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.STATS);
    if (!raw) return defaultStats;
    return JSON.parse(raw);
  } catch {
    return defaultStats;
  }
}

// Calendar day in the user's own time zone (toISOString would use UTC,
// which shifts the day for students in UTC+5 studying after midnight)
export function localDateKey(date: Date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function nextStreak(lastStudyDate: string, streakDays: number, today: string): number {
  if (lastStudyDate === today) return Math.max(streakDays, 1);
  if (!lastStudyDate) return 1;
  const diffDays = Math.round((Date.parse(today) - Date.parse(lastStudyDate)) / 86_400_000);
  return diffDays === 1 ? streakDays + 1 : 1;
}

function withStudyDay(stats: UserStats): UserStats {
  const today = localDateKey();
  return { ...stats, streakDays: nextStreak(stats.lastStudyDate, stats.streakDays, today), lastStudyDate: today };
}

export function recordQuizCompletion(scorePercentage: number, questionsCount: number, set?: StudySet): void {
  // Keep the latest result on the set itself; subject readiness reads it
  if (set) saveStudySet({ ...set, lastScore: scorePercentage, completedAt: Date.now() });
  const stats = withStudyDay(getUserStats());
  const updatedStats: UserStats = {
    ...stats,
    quizzesTaken: stats.quizzesTaken + 1,
    averageScore: Math.round((stats.averageScore * stats.quizzesTaken + scorePercentage) / (stats.quizzesTaken + 1)),
    totalStudyMinutes: stats.totalStudyMinutes + Math.ceil(questionsCount * 1.5),
  };
  localStorage.setItem(STORAGE_KEYS.STATS, JSON.stringify(updatedStats));
  notifyListeners();
}

// Flashcard reviews count toward the streak too
export function recordStudyActivity(): void {
  localStorage.setItem(STORAGE_KEYS.STATS, JSON.stringify(withStudyDay(getUserStats())));
  notifyListeners();
}

// Language
export function getSavedLanguage(): Language {
  if (typeof window === 'undefined') return 'uz';
  return (localStorage.getItem(STORAGE_KEYS.LANG) as Language) || 'uz';
}

export function setSavedLanguage(lang: Language): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEYS.LANG, lang);
  notifyListeners();
}

// Theme
export function getSavedTheme(): 'light' | 'dark' {
  if (typeof window === 'undefined') return 'light';
  return (localStorage.getItem(STORAGE_KEYS.THEME) as 'light' | 'dark') || 'light';
}

export function setSavedTheme(theme: 'light' | 'dark'): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEYS.THEME, theme);
  if (theme === 'dark') {
    document.documentElement.classList.add('dark');
  } else {
    document.documentElement.classList.remove('dark');
  }
  notifyListeners();
}

// -------------------------------------------------------------
// Data Export & Import Helpers
// -------------------------------------------------------------
export function exportSetsToJson(): void {
  const sets = getStudySets();
  const blob = new Blob([JSON.stringify(sets, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `sessiyagatayyorlan-study-sets-${new Date().toISOString().split('T')[0]}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export function importSetsFromJson(jsonContent: string): { success: boolean; count: number } {
  try {
    const parsed = JSON.parse(jsonContent);
    if (!Array.isArray(parsed)) return { success: false, count: 0 };

    const current = getStudySets();
    const currentIds = new Set(current.map((s) => s.id));
    
    // Add new sets
    const newSets = parsed.filter((s) => s.id && !currentIds.has(s.id));
    const merged = [...newSets, ...current];
    localStorage.setItem(STORAGE_KEYS.SETS, JSON.stringify(merged));
    notifyListeners();
    return { success: true, count: newSets.length };
  } catch {
    return { success: false, count: 0 };
  }
}

export function exportFlashcardsToCsv(set: StudySet): void {
  if (!set.flashcards || set.flashcards.length === 0) return;
  
  const rows = set.flashcards.map((fc) => {
    const front = `"${(fc.front || '').replace(/"/g, '""')}"`;
    const back = `"${(fc.back || '').replace(/"/g, '""')}"`;
    return `${front},${back}`;
  });

  const csvContent = 'Front,Back\n' + rows.join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${set.title.replace(/\s+/g, '-').toLowerCase()}-anki-cards.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
