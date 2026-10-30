import { useEffect, useRef, useState } from 'react';
import { Language } from './i18n';

// Browser speech-to-text (Chrome/Edge/Android) for practising oral answers.
// Returns supported=false where the Web Speech API is missing (Firefox, some iOS).
export function useDictation(lang: Language, onText: (text: string) => void) {
  const Recognition =
    typeof window !== 'undefined' ? (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition : undefined;
  const [listening, setListening] = useState(false);
  const recRef = useRef<any>(null);
  const onTextRef = useRef(onText);
  onTextRef.current = onText;

  useEffect(() => () => recRef.current?.stop(), []);

  const start = () => {
    if (!Recognition || listening) return;
    const rec = new Recognition();
    rec.lang = lang === 'uz' ? 'uz-UZ' : 'ru-RU';
    rec.continuous = true;
    rec.interimResults = false;
    rec.onresult = (e: any) => {
      for (let i = e.resultIndex; i < e.results.length; i++) {
        if (e.results[i].isFinal) onTextRef.current(e.results[i][0].transcript.trim());
      }
    };
    rec.onend = () => setListening(false);
    rec.onerror = () => setListening(false);
    recRef.current = rec;
    rec.start();
    setListening(true);
  };

  const stop = () => recRef.current?.stop();

  return { supported: !!Recognition, listening, start, stop };
}
