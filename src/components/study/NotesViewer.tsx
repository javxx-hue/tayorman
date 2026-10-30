import React, { useState } from 'react';
import { StudySet } from '../../types';
import { Button } from '../ui/Button';
import { Copy, Check, Printer, FileText, ArrowLeft, BookOpen, Bookmark } from 'lucide-react';
import { Language, getTranslations } from '../../lib/i18n';
import { AudioPlayer } from './AudioPlayer';

interface NotesViewerProps {
  set: StudySet;
  lang: Language;
  onBack: () => void;
}

export const NotesViewer: React.FC<NotesViewerProps> = ({ set, lang, onBack }) => {
  const t = getTranslations(lang).notes;
  const notes = set.notes;
  const [copied, setCopied] = useState(false);

  if (!notes) {
    return (
      <div className="max-w-xl mx-auto p-12 text-center bg-card rounded-3xl border border-border">
        <h3 className="text-xl font-serif font-bold">Konspekt topilmadi</h3>
        <Button variant="primary" onClick={onBack} className="mt-4">Ortga qaytish</Button>
      </div>
    );
  }

  const handleCopy = () => {
    const textToCopy = `
# ${notes.title}

## Summary
${notes.summary}

## Key Points
${notes.keyPoints.map((p) => `- ${p}`).join('\n')}

## Glossary
${notes.glossary.map((g) => `* **${g.term}**: ${g.definition}`).join('\n')}
    `.trim();

    navigator.clipboard.writeText(textToCopy);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="max-w-4xl mx-auto my-6 sm:my-10 px-4">
      
      {/* Top Controls */}
      <div className="flex items-center justify-between gap-4 mb-6">
        <Button variant="ghost" size="sm" onClick={onBack} icon={<ArrowLeft size={16} />}>
          {lang === 'uz' ? 'Kabinetga qaytish' : 'На главную'}
        </Button>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleCopy}
            icon={copied ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
          >
            {copied ? t.copied : t.copyNotes}
          </Button>
          <Button variant="secondary" size="sm" onClick={handlePrint} icon={<Printer size={14} />}>
            {t.print}
          </Button>
        </div>
      </div>

      {/* Main Document Paper */}
      <div className="rounded-3xl bg-card border border-border/80 shadow-elevated p-8 sm:p-12 space-y-8">
        
        {/* Document Header */}
        <div className="border-b border-border/60 pb-6 space-y-4">
          <div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-creation-notes/20 text-creation-notes-strong text-xs font-semibold uppercase tracking-wider mb-3">
              <Bookmark size={13} />
              {t.title}
            </div>
            <h1 className="text-3xl sm:text-4xl font-serif font-bold text-foreground">
              {notes.title}
            </h1>
          </div>

          {/* AI Audio Podcast Player */}
          <AudioPlayer
            title={notes.title}
            textToRead={`${notes.title}. ${notes.summary}. ${notes.keyPoints.join('. ')}`}
            lang={lang}
          />
        </div>

        {/* Executive Summary */}
        <div className="space-y-3">
          <h2 className="text-lg font-serif font-bold text-foreground flex items-center gap-2">
            <BookOpen size={18} className="text-amber-500" />
            {t.executiveSummary}
          </h2>
          <div className="p-5 rounded-2xl bg-secondary/50 border border-border/60 text-sm sm:text-base leading-relaxed text-foreground">
            {notes.summary}
          </div>
        </div>

        {/* Key Takeaways */}
        {notes.keyPoints && notes.keyPoints.length > 0 && (
          <div className="space-y-3">
            <h2 className="text-lg font-serif font-bold text-foreground flex items-center gap-2">
              <FileText size={18} className="text-primary" />
              {t.bulletPoints}
            </h2>
            <ul className="space-y-2.5">
              {notes.keyPoints.map((point, idx) => (
                <li
                  key={idx}
                  className="flex items-start gap-3 p-3.5 rounded-xl bg-background border border-border/70 text-sm text-foreground/90 leading-relaxed"
                >
                  <span className="w-5 h-5 rounded-full bg-secondary flex items-center justify-center text-xs font-bold text-muted-foreground shrink-0 mt-0.5">
                    {idx + 1}
                  </span>
                  <span>{point}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Glossary & Key Terms Table */}
        {notes.glossary && notes.glossary.length > 0 && (
          <div className="space-y-3">
            <h2 className="text-lg font-serif font-bold text-foreground">
              {t.keyDefinitions}
            </h2>
            <div className="rounded-2xl border border-border overflow-hidden">
              <table className="w-full text-left text-sm">
                <thead className="bg-secondary/70 text-xs uppercase font-semibold text-muted-foreground border-b border-border">
                  <tr>
                    <th className="p-3.5 sm:px-6">Tushuncha / Atama</th>
                    <th className="p-3.5 sm:px-6">Ta'rif & Mazmun</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {notes.glossary.map((item, idx) => (
                    <tr key={idx} className="hover:bg-secondary/30 transition-colors">
                      <td className="p-3.5 sm:px-6 font-semibold text-foreground align-top w-1/3">
                        {item.term}
                      </td>
                      <td className="p-3.5 sm:px-6 text-muted-foreground align-top leading-relaxed">
                        {item.definition}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

      </div>

    </div>
  );
};
