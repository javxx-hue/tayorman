export type StudySetType = 'quiz' | 'flashcards' | 'notes' | 'exam';
export type Difficulty = 'easy' | 'medium' | 'hard';
export type Language = 'uz' | 'ru';

export interface QuizQuestion {
  id: string;
  question: string;
  options: string[];
  correctAnswer: number; // 0-based index
  hint: string;
  explanation: string;
  source?: string; // where in the material, e.g. "Sahifa 3"
}

export interface Flashcard {
  id: string;
  front: string;
  back: string;
  example?: string;
  source?: string;
  rating?: 'again' | 'hard' | 'good' | 'easy'; // last rating given
  srs?: SrsState; // absent until first review
}

// FSRS card state as stored JSON (dates as ISO strings), see lib/srs.ts
export interface SrsState {
  due: string;
  stability: number;
  difficulty: number;
  elapsed_days: number;
  scheduled_days: number;
  learning_steps: number;
  reps: number;
  lapses: number;
  state: number; // ts-fsrs State: 0 New, 1 Learning, 2 Review, 3 Relearning
  last_review?: string;
}

export interface StudyNote {
  id: string;
  title: string;
  summary: string;
  keyPoints: string[];
  glossary: { term: string; definition: string }[];
}

export interface StudySet {
  id: string;
  title: string;
  type: StudySetType;
  description: string;
  createdAt: number;
  updatedAt?: number; // last local change, used to merge with the cloud copy
  itemCount: number;
  difficulty: Difficulty;
  sourceType: 'text' | 'pdf' | 'youtube' | 'prompt' | 'topic';
  sourceSnippet?: string;
  questions?: QuizQuestion[];
  flashcards?: Flashcard[];
  notes?: StudyNote;
  subjectId?: string; // set generated inside a subject
  libraryId?: string; // copied from the admin library
  libraryUpdatedAt?: string; // library version this copy was last refreshed from
  lastScore?: number;
  completedAt?: number;
}

export interface UserStats {
  streakDays: number;
  lastStudyDate: string; // YYYY-MM-DD
  quizzesTaken: number;
  cardsMastered: number;
  totalStudyMinutes: number;
  averageScore: number;
}

export interface GenerationOptions {
  type: StudySetType;
  questionCount?: number;
  difficulty?: Difficulty;
  language?: Language;
  topic?: string;
}

// ---------------------------------------------------------------
// Session prep: subjects, their materials and exam question lists
// ---------------------------------------------------------------
export type ExamFormat = 'test' | 'written' | 'oral' | 'mixed';
export type MaterialKind = 'pdf' | 'pptx' | 'image' | 'text' | 'youtube';

export interface Material {
  id: string;
  name: string;
  kind: MaterialKind;
  text: string; // extracted text with [Sahifa N] / [Slayd N] markers
  fileId?: string; // Telegram file id when the file came through the bot
  createdAt: number;
}

export interface ModelAnswer {
  summary: string;
  keyPoints: string[];
  sources: string[]; // e.g. "Ma'ruza 3.pdf, 5-sahifa"
}

export interface AnswerAttempt {
  at: number;
  answer: string;
  score: number; // 0-100
  feedback: string;
  missing: string[];
}

export interface ExamQuestion {
  id: string;
  text: string;
  modelAnswer?: ModelAnswer;
  attempts: AnswerAttempt[];
}

export interface Subject {
  id: string;
  name: string;
  examDate: string; // YYYY-MM-DD, local
  examFormat: ExamFormat;
  createdAt: number;
  updatedAt: number;
  materials: Material[];
  questions: ExamQuestion[];
  libraryId?: string; // copied from the admin library
  libraryUpdatedAt?: string; // library version this copy was last refreshed from
}
