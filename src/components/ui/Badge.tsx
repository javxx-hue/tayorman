import React from 'react';
import clsx from 'clsx';
import { StudySetType } from '../../types';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'default' | 'outline' | 'quiz' | 'flashcards' | 'notes' | 'exam' | 'success';
  size?: 'sm' | 'md';
}

export const Badge: React.FC<BadgeProps> = ({
  children,
  variant = 'default',
  size = 'sm',
  className,
  ...props
}) => {
  const base = 'inline-flex items-center font-medium rounded-full tracking-wide select-none';

  const variants = {
    default: 'bg-secondary text-secondary-foreground border border-border/50',
    outline: 'border border-border text-muted-foreground bg-transparent',
    quiz: 'bg-creation-quiz/20 text-creation-quiz-strong border border-creation-quiz/40',
    flashcards: 'bg-creation-flashcards/20 text-creation-flashcards-strong border border-creation-flashcards/40',
    notes: 'bg-creation-notes/20 text-creation-notes-strong border border-creation-notes/40',
    exam: 'bg-creation-exam/20 text-creation-exam-strong border border-creation-exam/40',
    success: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30',
  };

  const sizes = {
    sm: 'text-xs px-2.5 py-0.5 gap-1',
    md: 'text-xs px-3 py-1 gap-1.5 font-semibold',
  };

  return (
    <span className={clsx(base, variants[variant], sizes[size], className)} {...props}>
      {children}
    </span>
  );
};

export const TypeBadge: React.FC<{ type: StudySetType; className?: string }> = ({ type, className }) => {
  const labelMap = {
    quiz: 'AI Quiz',
    flashcards: 'Flashcards',
    notes: 'Notes',
    exam: 'Exam',
  };

  return (
    <Badge variant={type} className={className}>
      {labelMap[type]}
    </Badge>
  );
};
