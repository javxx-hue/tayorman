import React, { useState } from 'react';
import { Lightbulb } from 'lucide-react';
import { Button } from '../ui/Button';
import { Language, tr } from '../../lib/i18n';

// What every mission workspace gets from the mission page
export interface WorkspaceProps<M> {
  mission: M;
  lang: Language;
  solved: boolean;
  onSolved: () => void;
}

export const chip = 'px-2.5 py-1 rounded-lg border border-border bg-card text-xs font-mono text-foreground hover:bg-secondary active:translate-y-[1px]';
export const pick = (on: boolean) =>
  `px-3 py-1.5 rounded-xl text-xs font-bold border ${on ? 'bg-primary text-primary-foreground border-primary' : 'bg-card text-foreground border-border'}`;
export const box = {
  task: 'rounded-2xl border border-primary/40 bg-primary/5 p-4 space-y-3',
  hint: 'rounded-2xl bg-amber-500/10 border border-amber-500/30 p-3 text-sm text-foreground',
  bad: 'rounded-2xl bg-destructive/10 border border-destructive/30 p-3 text-sm text-foreground',
  good: 'rounded-2xl bg-emerald-500/10 border border-emerald-500/30 p-3 text-sm text-foreground',
};

export const TaskCard: React.FC<{ lang: Language; task: string; children?: React.ReactNode }> = ({ lang, task, children }) => (
  <div className={box.task}>
    <div className="text-xs font-bold text-primary">{tr(lang, 'Topshiriq', 'Задание')}</div>
    <p className="text-sm text-foreground leading-relaxed">{task}</p>
    {children}
  </div>
);

// Hint, then after enough tries the solution
export const HelpButtons: React.FC<{ lang: Language; hint: string; solution: string; tries: number; need: number; solved: boolean }> = ({ lang, hint, solution, tries, need, solved }) => {
  const [showHint, setShowHint] = useState(false);
  const [showSolution, setShowSolution] = useState(false);
  return (
    <>
      <div className="flex flex-wrap gap-2">
        {!showHint && (
          <Button variant="outline" icon={<Lightbulb size={14} />} onClick={() => setShowHint(true)}>
            {tr(lang, 'Yordam', 'Подсказка')}
          </Button>
        )}
        {tries >= need && !showSolution && !solved && (
          <Button variant="ghost" onClick={() => setShowSolution(true)}>{tr(lang, "Yechimni ko'rish", 'Показать решение')}</Button>
        )}
      </div>
      {showHint && <div className={box.hint}>{hint}</div>}
      {showSolution && (
        <div className="rounded-2xl border border-border bg-card p-3 space-y-2">
          <pre className="font-mono text-xs text-foreground whitespace-pre-wrap">{solution}</pre>
          <p className="text-xs text-muted-foreground">{tr(lang, "Uni o'zingiz bajarib, tekshirib ko'ring: qo'l bilan qilingani yaxshiroq eslab qolinadi.", 'Сделайте это сами и проверьте: так лучше запоминается.')}</p>
        </div>
      )}
    </>
  );
};
