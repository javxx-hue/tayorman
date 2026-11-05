import React from 'react';
import { ShieldCheck } from 'lucide-react';
import { Language } from '../lib/i18n';
import { privacyText } from '../lib/privacy';

// The same points, as a plain list (used in the profile) ...
export const PrivacyPoints: React.FC<{ lang: Language }> = ({ lang }) => (
  <ul className="space-y-2 text-sm text-muted-foreground list-disc pl-5">
    {privacyText(lang).points.map((p) => (
      <li key={p}>{p}</li>
    ))}
  </ul>
);

// ... and as the one-time sheet at the start. The student reads it and taps once.
export const PrivacyNotice: React.FC<{ lang: Language; onAccept: () => void }> = ({ lang, onAccept }) => {
  const text = privacyText(lang);
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-3" role="dialog" aria-modal="true" aria-label={text.title}>
      <div className="w-full max-w-md max-h-[85vh] overflow-y-auto rounded-2xl border border-border bg-card p-5 space-y-3">
        <div className="flex items-center gap-2">
          <ShieldCheck className="text-primary shrink-0" size={20} />
          <h2 className="text-base font-semibold text-foreground">{text.title}</h2>
        </div>
        <PrivacyPoints lang={lang} />
        <button onClick={onAccept} className="w-full px-4 py-2.5 rounded-xl bg-primary text-primary-foreground font-semibold text-sm hover:opacity-90">
          {text.accept}
        </button>
      </div>
    </div>
  );
};
