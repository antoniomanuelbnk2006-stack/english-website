'use client';

import { Minus, Pause, Play, Plus, RotateCcw, SkipBack, SkipForward } from 'lucide-react';
import { useEffect, useRef, type KeyboardEvent, type PointerEvent } from 'react';
import { Button } from '@/components/ui/button';
import { formatClock } from '@/features/lessons/lib/summary';
import { RATE_STEP } from '@/lib/audio/segments';
import { player, usePlayer } from '@/lib/audio/store';
import { useT } from '@/lib/i18n/client';

/** Elementos en los que una tecla ya significa otra cosa. */
function isTyping(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLElement && target.matches('input, textarea, select, [contenteditable]')
  );
}

/**
 * Reproductor por frases: anterior, repetir, reproducir/pausa, siguiente y velocidad.
 * La onda y el tiempo se actualizan tocando el DOM en cada fotograma, sin renderizar.
 */
export function AudioPlayer({
  peaks,
  duration,
  onRepeat,
}: {
  peaks: readonly number[];
  duration: number;
  /** Se llama cada vez que se repite una frase (para contar repeticiones). */
  onRepeat?: (segmentIndex: number) => void;
}) {
  const t = useT();
  const playing = usePlayer((state) => state.playing);
  const rate = usePlayer((state) => state.rate);
  const status = usePlayer((state) => state.status);
  const progressRef = useRef<SVGGElement>(null);
  const timeRef = useRef<HTMLSpanElement>(null);
  const sliderRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const paint = (time: number) => {
      const ratio = duration > 0 ? Math.min(1, time / duration) : 0;
      if (progressRef.current) {
        progressRef.current.style.clipPath = `inset(0 ${(1 - ratio) * 100}% 0 0)`;
      }
      if (timeRef.current) timeRef.current.textContent = formatClock(time * 1000);
      sliderRef.current?.setAttribute('aria-valuenow', String(Math.round(time)));
    };
    paint(player.time());
    return player.onTime(paint);
  }, [duration]);

  const repeat = () => {
    onRepeat?.(usePlayer.getState().segmentIndex);
    player.jump(0);
  };

  // Atajos de teclado del reproductor (docs/03-producto/02-pantallas-y-flujos.md §4).
  useEffect(() => {
    const onKey = (event: globalThis.KeyboardEvent) => {
      if (event.ctrlKey || event.metaKey || event.altKey || isTyping(event.target)) return;
      const onControl =
        event.target instanceof HTMLElement && event.target.matches('button, a, [role="slider"]');
      if (event.key === ' ' && !onControl) {
        event.preventDefault();
        player.toggle();
      } else if (event.key === 'r' || event.key === 'R') {
        onRepeat?.(usePlayer.getState().segmentIndex);
        player.jump(0);
      } else if (event.key === 'ArrowLeft' && !onControl) {
        player.jump(-1);
      } else if (event.key === 'ArrowRight' && !onControl) {
        player.jump(1);
      } else if (event.key === '[') {
        player.setRate(usePlayer.getState().rate - RATE_STEP);
      } else if (event.key === ']') {
        player.setRate(usePlayer.getState().rate + RATE_STEP);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onRepeat]);

  const seekFromPointer = (event: PointerEvent<HTMLDivElement>) => {
    const box = event.currentTarget.getBoundingClientRect();
    player.seek(((event.clientX - box.left) / box.width) * duration);
  };

  const seekFromKey = (event: KeyboardEvent<HTMLDivElement>) => {
    const step = { ArrowLeft: -5, ArrowRight: 5, PageDown: -15, PageUp: 15 }[event.key];
    if (step !== undefined) {
      event.preventDefault();
      player.seek(player.time() + step);
    } else if (event.key === 'Home') {
      event.preventDefault();
      player.seek(0);
    }
  };

  const bars = peaks.length > 0 ? peaks : [0.2];
  const wave = bars.map((peak, index) => {
    const height = Math.max(4, peak * 100);
    return (
      <rect key={index} x={index} y={(100 - height) / 2} width={0.6} height={height} rx={0.3} />
    );
  });

  return (
    <section
      aria-label={t('player.label')}
      className="flex flex-col gap-3 rounded-panel border border-border bg-surface p-4"
    >
      <div className="flex items-center gap-3">
        <div
          ref={sliderRef}
          role="slider"
          tabIndex={0}
          aria-label={t('player.position')}
          aria-valuemin={0}
          aria-valuemax={Math.round(duration)}
          aria-valuenow={0}
          onPointerDown={seekFromPointer}
          onKeyDown={seekFromKey}
          className="h-14 min-w-0 flex-1 cursor-pointer rounded-control"
        >
          <svg
            viewBox={`0 0 ${bars.length} 100`}
            preserveAspectRatio="none"
            aria-hidden="true"
            className="size-full"
          >
            <g className="fill-border">{wave}</g>
            <g ref={progressRef} className="fill-accent" style={{ clipPath: 'inset(0 100% 0 0)' }}>
              {wave}
            </g>
          </svg>
        </div>
        <p className="hud shrink-0 text-sm text-muted">
          <span ref={timeRef}>0:00</span> / {formatClock(duration * 1000)}
        </p>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            aria-label={t('player.previous')}
            onClick={() => player.jump(-1)}
          >
            <SkipBack aria-hidden="true" strokeWidth={1.75} />
          </Button>
          <Button variant="ghost" size="icon" aria-label={t('player.repeat')} onClick={repeat}>
            <RotateCcw aria-hidden="true" strokeWidth={1.75} />
          </Button>
          <Button
            size="icon"
            className="size-12 rounded-full"
            disabled={status === 'error'}
            aria-label={playing ? t('player.pause') : t('player.play')}
            onClick={() => player.toggle()}
          >
            {playing ? (
              <Pause aria-hidden="true" strokeWidth={2} />
            ) : (
              <Play aria-hidden="true" strokeWidth={2} />
            )}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            aria-label={t('player.next')}
            onClick={() => player.jump(1)}
          >
            <SkipForward aria-hidden="true" strokeWidth={1.75} />
          </Button>
        </div>

        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            aria-label={t('player.slower')}
            onClick={() => player.setRate(rate - RATE_STEP)}
          >
            <Minus aria-hidden="true" strokeWidth={1.75} />
          </Button>
          <output
            aria-label={t('player.rate', { rate: rate.toFixed(2) })}
            className="hud w-14 text-center text-sm"
          >
            {rate.toFixed(2)}×
          </output>
          <Button
            variant="ghost"
            size="icon"
            aria-label={t('player.faster')}
            onClick={() => player.setRate(rate + RATE_STEP)}
          >
            <Plus aria-hidden="true" strokeWidth={1.75} />
          </Button>
        </div>
      </div>

      {status === 'error' ? (
        <p role="alert" className="text-sm text-danger">
          {t('listening.audioError')}
        </p>
      ) : null}
      <p className="sr-only">{t('player.shortcuts')}</p>
    </section>
  );
}
