import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Briefcase, ChevronRight } from 'lucide-react';
import { Language, tr } from '../../lib/i18n';
import { Subject } from '../../types';
import { doneMissions, MISSION_XP, storyOf, syncMissions } from '../../lib/missionStories';

// Once per app start is enough for the home page; the missions page syncs every time it opens
let synced = false;

// Home page: the missions of the student's subjects, so they are found without digging into a subject
export const MissionsCard: React.FC<{ subjects: Subject[]; lang: Language }> = ({ subjects, lang }) => {
  const navigate = useNavigate();
  const [, refresh] = useState(0);
  const rows = subjects.flatMap((subject) => {
    const story = storyOf(subject.librarySourceId);
    return story ? [{ subject, story, done: doneMissions(story.id).length }] : [];
  });

  useEffect(() => {
    if (synced || rows.length === 0) return;
    synced = true;
    void syncMissions().then(() => refresh((n) => n + 1));
  }, [rows.length]);

  if (rows.length === 0) return null;
  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-lg font-serif text-foreground flex items-center gap-2">
          <Briefcase size={18} className="text-amber-500" /> {tr(lang, 'Stajyor missiyalari', 'Миссии стажёра')}
        </h2>
        <p className="text-xs text-muted-foreground">
          {tr(lang, `Haqiqiy kasb vazifalari: SQL, tarmoq, sxemalar, dronlar · har missiya +${MISSION_XP} XP`, `Настоящие рабочие задачи: SQL, сеть, схемы, дроны · каждая миссия +${MISSION_XP} XP`)}
        </p>
      </div>
      <div className="rounded-2xl border border-border bg-card divide-y divide-border">
        {rows.map(({ subject, story, done }) => (
          <button key={subject.id} onClick={() => navigate(`/subjects/${subject.id}/missions`)} className="w-full text-left flex items-center gap-3 p-3.5 hover:bg-secondary/40">
            <span className="flex-1 min-w-0">
              <span className="block text-sm font-bold text-foreground truncate">{subject.name}</span>
              <span className="block h-1.5 mt-2 rounded-full bg-secondary overflow-hidden">
                <span className="block h-full bg-amber-500" style={{ width: `${(done / story.count) * 100}%` }} />
              </span>
            </span>
            <span className="text-sm font-bold text-muted-foreground w-10 text-right">{done}/{story.count}</span>
            <ChevronRight size={16} className="text-muted-foreground shrink-0" />
          </button>
        ))}
      </div>
    </section>
  );
};
