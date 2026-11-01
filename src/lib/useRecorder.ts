import { useEffect, useRef, useState } from 'react';

// One answer is at most this long: it keeps the file small enough to send and the AI reply quick
export const MAX_RECORD_SECONDS = 120;
export const MIN_RECORD_SECONDS = 1;

export type RecorderError = 'denied' | 'failed';

export const canRecordAudio = () =>
  typeof window !== 'undefined' && typeof MediaRecorder !== 'undefined' && !!navigator.mediaDevices?.getUserMedia;

// First type this browser can record (Android: webm, iPhone: mp4)
const pickType = () => ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg'].find((t) => MediaRecorder.isTypeSupported?.(t));

// Records from the microphone until stopped (or until the time limit) and hands over the recording
export function useRecorder(onDone: (blob: Blob, seconds: number) => void, onError: (error: RecorderError) => void) {
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const recorder = useRef<MediaRecorder | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const cancelled = useRef(false);
  const handlers = useRef({ onDone, onError });
  handlers.current = { onDone, onError };

  const release = () => {
    if (timer.current) clearInterval(timer.current);
    timer.current = null;
    stream.current?.getTracks().forEach((t) => t.stop());
    stream.current = null;
  };

  // leaving the page throws the recording away
  useEffect(
    () => () => {
      cancelled.current = true;
      if (recorder.current?.state === 'recording') recorder.current.stop();
      release();
    },
    []
  );

  const stop = () => {
    if (recorder.current?.state === 'recording') recorder.current.stop();
  };

  const start = async () => {
    if (recording) return;
    try {
      stream.current = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (e) {
      handlers.current.onError(e instanceof DOMException && (e.name === 'NotAllowedError' || e.name === 'SecurityError') ? 'denied' : 'failed');
      return;
    }
    try {
      const chunks: Blob[] = [];
      const rec = new MediaRecorder(stream.current, pickType() ? { mimeType: pickType() } : undefined);
      let elapsed = 0;
      rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
      rec.onstop = () => {
        release();
        setRecording(false);
        if (!cancelled.current && chunks.length) handlers.current.onDone(new Blob(chunks, { type: rec.mimeType }), elapsed);
      };
      recorder.current = rec;
      cancelled.current = false;
      rec.start();
      setSeconds(0);
      setRecording(true);
      timer.current = setInterval(() => {
        elapsed += 1;
        setSeconds(elapsed);
        if (elapsed >= MAX_RECORD_SECONDS) stop();
      }, 1000);
    } catch {
      release();
      handlers.current.onError('failed');
    }
  };

  return { recording, seconds, start, stop };
}
