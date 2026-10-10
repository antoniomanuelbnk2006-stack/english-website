'use client';

import { Volume2 } from 'lucide-react';
import { useEffect, useRef, useState, type RefObject } from 'react';
import {
  remainingSeconds,
  scheduleSeconds,
  type ListeningStep,
} from '@/features/exams/lib/schedule';
import { formatClock } from '@/features/lessons/lib/summary';
import { useT } from '@/lib/i18n/client';

/**
 * La cinta del Listening: reproduce la secuencia entera (tiempo de lectura, cada grabación dos
 * veces, pausas y revisión final) sin que se pueda parar ni rebobinar, como en el examen.
 */
export function ListeningTape({
  steps,
  audio: audioRef,
  audioBase,
  onPart,
  onFinished,
  onError,
}: {
  steps: readonly ListeningStep[];
  /** El elemento de audio, ya desbloqueado por el clic de «Empezar». */
  audio: RefObject<HTMLAudioElement | null>;
  audioBase: string;
  /** Avisa de la parte a la que pasa la cinta. */
  onPart: (part: number) => void;
  /** Se acabó el tiempo de revisión: hay que entregar. */
  onFinished: () => void;
  onError: () => void;
}) {
  const t = useT();
  const [index, setIndex] = useState(0);
  /** Segundos que quedan del paso en curso. */
  const [left, setLeft] = useState(steps[0]?.seconds ?? 0);
  const [volume, setVolume] = useState(1);
  const callbacks = useRef({ onPart, onFinished, onError });
  useEffect(() => {
    callbacks.current = { onPart, onFinished, onError };
  });

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    let stopped = false;
    let timer = 0;
    let ticker = 0;
    let current = -1;
    let endsAt = 0;

    const run = (next: number) => {
      if (stopped) return;
      window.clearTimeout(timer);
      const step = steps[next];
      if (!step) {
        callbacks.current.onFinished();
        return;
      }
      if (step.part !== steps[current]?.part) callbacks.current.onPart(step.part);
      current = next;
      setIndex(next);
      setLeft(step.seconds);

      if (step.kind === 'play') {
        if (!step.recording.src) {
          callbacks.current.onError();
          return;
        }
        endsAt = 0;
        audio.src = `${audioBase}/${step.recording.src}`;
        audio.currentTime = 0;
        audio.play().catch(() => {
          if (!stopped) callbacks.current.onError();
        });
      } else {
        endsAt = Date.now() + step.seconds * 1000;
        timer = window.setTimeout(() => run(next + 1), step.seconds * 1000);
      }
    };

    const onEnded = () => run(current + 1);
    const onAudioError = () => {
      if (!stopped) callbacks.current.onError();
    };
    audio.addEventListener('ended', onEnded);
    audio.addEventListener('error', onAudioError);

    ticker = window.setInterval(() => {
      const step = steps[current];
      if (!step) return;
      if (step.kind === 'play') {
        const duration = Number.isFinite(audio.duration) ? audio.duration : step.seconds;
        setLeft(Math.max(0, duration - audio.currentTime));
      } else {
        setLeft(Math.max(0, (endsAt - Date.now()) / 1000));
      }
    }, 500);

    timer = window.setTimeout(() => run(0), 0);

    return () => {
      stopped = true;
      window.clearTimeout(timer);
      window.clearInterval(ticker);
      audio.removeEventListener('ended', onEnded);
      audio.removeEventListener('error', onAudioError);
      audio.pause();
    };
  }, [audioRef, audioBase, steps]);

  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = volume;
  }, [audioRef, volume]);

  const step = steps[index];
  if (!step) return null;
  const total = scheduleSeconds(steps);
  const remaining = remainingSeconds(steps, index, left);
  const status =
    step.kind === 'play'
      ? t(step.pass === 1 ? 'exams.tapeFirst' : 'exams.tapeSecond', { part: step.part })
      : step.kind === 'prep'
        ? t('exams.tapePrep', { part: step.part })
        : step.kind === 'review'
          ? t('exams.tapeReview')
          : t('exams.tapePause', { part: step.part });

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
      <p role="status" className="flex min-w-0 items-center gap-2 text-sm font-medium">
        <Volume2
          aria-hidden="true"
          className={
            step.kind === 'play' ? 'size-4 shrink-0 text-accent' : 'size-4 shrink-0 text-muted'
          }
          strokeWidth={2}
        />
        {status}
      </p>
      <span className="hud text-sm text-muted">
        {step.kind === 'play' ? null : formatClock(left * 1000)}
      </span>
      <div
        role="progressbar"
        aria-label={t('exams.tapeProgress')}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={total === 0 ? 0 : Math.round(((total - remaining) / total) * 100)}
        className="h-1.5 min-w-24 flex-1 overflow-hidden rounded-full bg-surface-2"
      >
        <div
          className="h-full bg-accent transition-[width] duration-500"
          style={{ width: `${total === 0 ? 0 : ((total - remaining) / total) * 100}%` }}
        />
      </div>
      <span className="hud text-sm text-muted">
        {t('exams.timeLeft', { time: formatClock(remaining * 1000) })}
      </span>
      <label className="flex items-center gap-2 text-xs text-muted">
        {t('exams.volume')}
        <input
          type="range"
          min={0}
          max={1}
          step={0.05}
          value={volume}
          onChange={(event) => setVolume(Number(event.target.value))}
          className="w-24 accent-accent"
        />
      </label>
    </div>
  );
}
