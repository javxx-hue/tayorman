// Reading text aloud with the phone's own voices. Inside Telegram many phones have no voice for Uzbek (or none
// at all), and then the speaker button used to show but stay silent. Now a button is offered only when there
// is a voice that can actually read the language.
import { useEffect, useRef, useState } from 'react';
import { Language } from './i18n';

// Uzbek: an Uzbek voice, else a Turkish one (close enough to follow Uzbek in Latin letters). Russian: a Russian voice.
export function pickVoice<T extends { lang: string }>(voices: T[], lang: Language): T | null {
  const preferred = lang === 'uz' ? ['uz', 'tr'] : ['ru'];
  for (const code of preferred) {
    const found = voices.find((v) => v.lang.toLowerCase().replace('_', '-').split('-')[0] === code);
    if (found) return found;
  }
  return null;
}

export function useSpeech(lang: Language) {
  const [voice, setVoice] = useState<SpeechSynthesisVoice | null>(null);
  const spoke = useRef(false);

  useEffect(() => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    const synth = window.speechSynthesis;
    const load = () => setVoice(pickVoice(synth.getVoices(), lang));
    load();
    synth.addEventListener?.('voiceschanged', load); // many browsers fill the list a moment after loading
    return () => {
      synth.removeEventListener?.('voiceschanged', load);
      if (spoke.current) synth.cancel();
    };
  }, [lang]);

  // onEnd runs when the phrase has been read to the end (the board moves on to its next step then)
  const speak = (text: string, onEnd?: () => void, rate = 0.95) => {
    if (!voice) return;
    const synth = window.speechSynthesis;
    synth.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.voice = voice;
    utterance.lang = voice.lang;
    utterance.rate = rate;
    if (onEnd) utterance.onend = onEnd;
    spoke.current = true;
    synth.speak(utterance);
  };

  const stop = () => {
    if (spoke.current) window.speechSynthesis.cancel();
  };

  return { available: voice !== null, speak, stop };
}
