import React, { useState, useEffect } from 'react';
import { Play, Pause, Square, Headphones } from 'lucide-react';
import { Language } from '../../lib/i18n';

interface AudioPlayerProps {
  title: string;
  textToRead: string;
  lang: Language;
}

export const AudioPlayer: React.FC<AudioPlayerProps> = ({ title, textToRead, lang }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [rate, setRate] = useState<number>(1.0);

  useEffect(() => {
    return () => {
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  const handlePlay = () => {
    if (!('speechSynthesis' in window)) return;

    if (isPaused) {
      window.speechSynthesis.resume();
      setIsPlaying(true);
      setIsPaused(false);
      return;
    }

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(textToRead);
    utterance.lang = lang === 'uz' ? 'tr-TR' : 'ru-RU';
    utterance.rate = rate;

    utterance.onend = () => {
      setIsPlaying(false);
      setIsPaused(false);
    };

    utterance.onerror = () => {
      setIsPlaying(false);
      setIsPaused(false);
    };

    window.speechSynthesis.speak(utterance);
    setIsPlaying(true);
    setIsPaused(false);
  };

  const handlePause = () => {
    if ('speechSynthesis' in window && isPlaying) {
      window.speechSynthesis.pause();
      setIsPlaying(false);
      setIsPaused(true);
    }
  };

  const handleStop = () => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      setIsPlaying(false);
      setIsPaused(false);
    }
  };

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-900 dark:text-rose-200">
      <div className="flex items-center gap-2.5">
        <div className="w-8 h-8 rounded-xl bg-rose-500 text-white flex items-center justify-center shadow-xs">
          <Headphones size={15} />
        </div>
        <div>
          <span className="text-xs font-bold block">AI Audio O'qish (Podcast / Speech)</span>
          <span className="text-[11px] opacity-80 truncate max-w-xs block">{title}</span>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={isPlaying ? handlePause : handlePlay}
          className="px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-all"
        >
          {isPlaying ? <Pause size={13} /> : <Play size={13} className="fill-white" />}
          <span>{isPlaying ? 'Pauza' : isPaused ? 'Davom ettirish' : 'Tinglash'}</span>
        </button>

        {(isPlaying || isPaused) && (
          <button
            onClick={handleStop}
            className="p-1.5 rounded-xl bg-secondary text-foreground hover:bg-secondary/80 transition-colors"
            title="To'xtatish"
          >
            <Square size={13} />
          </button>
        )}

        <select
          value={rate}
          onChange={(e) => setRate(parseFloat(e.target.value))}
          className="text-xs px-2 py-1 rounded-xl bg-card border border-border text-foreground focus:outline-none"
        >
          <option value={0.8}>0.8x</option>
          <option value={1.0}>1.0x</option>
          <option value={1.2}>1.2x</option>
          <option value={1.5}>1.5x</option>
        </select>
      </div>
    </div>
  );
};
