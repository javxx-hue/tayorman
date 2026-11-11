// Adds one practice result to an exam question of a subject on this phone (sync carries it to the cloud)
import { AnswerAttempt } from '../types';
import { getSubjectById, saveSubject } from './storage';

export function saveAttempt(subjectId: string, questionId: string, attempt: AnswerAttempt): void {
  const subject = getSubjectById(subjectId);
  if (!subject) return;
  saveSubject({ ...subject, questions: subject.questions.map((q) => (q.id === questionId ? { ...q, attempts: [...q.attempts, attempt] } : q)) });
}
