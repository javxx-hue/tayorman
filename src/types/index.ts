export type StudySetType = 'quiz' | 'flashcards' | 'exam';
export type Difficulty = 'easy' | 'medium' | 'hard';
export type Language = 'uz' | 'ru';

// A subject's topic. Library content is tagged with these, so a student can study by topic and see weak spots.
export interface Topic {
  no: number;
  name: string;
}

export interface QuizQuestion {
  id: string;
  topic?: number; // Topic.no
  question: string;
  options: string[];
  correctAnswer: number; // 0-based index
  hint: string;
  explanation: string;
  source?: string; // where in the material, e.g. "Sahifa 3"
}

export interface Flashcard {
  id: string;
  topic?: number; // Topic.no
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

export interface StudySet {
  id: string;
  title: string;
  type: StudySetType;
  description: string;
  createdAt: number;
  updatedAt?: number; // last local change, used to merge with the cloud copy
  itemCount: number;
  difficulty: Difficulty;
  sourceType: 'text' | 'pdf' | 'prompt' | 'topic';
  sourceSnippet?: string;
  questions?: QuizQuestion[];
  flashcards?: Flashcard[];
  subjectId?: string; // set generated inside a subject
  libraryId?: string; // copied from the admin library
  libraryUpdatedAt?: string; // library version this copy was last refreshed from
  topics?: Topic[];
  lastScore?: number;
  completedAt?: number;
}

export interface UserStats {
  streakDays: number;
  lastStudyDate: string; // YYYY-MM-DD
  quizzesTaken: number;
  totalStudyMinutes: number;
  averageScore: number;
}

// ---------------------------------------------------------------
// Session prep: subjects, their materials and exam question lists
// ---------------------------------------------------------------
export type ExamFormat = 'test' | 'written' | 'oral' | 'mixed';
export type MaterialKind = 'pdf' | 'pptx' | 'image' | 'text';

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
  mode?: 'recall' | 'cloze'; // how it was practised; none = a written or spoken answer
}

export interface ExamQuestion {
  id: string;
  text: string;
  topic?: number; // Topic.no
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
  topics?: Topic[];
  librarySourceId?: string; // id the admin's subject had; sets published with it name it in their subjectId
}
