'use client';

import { useEffect, useMemo, useRef } from 'react';
import { ActiveClock } from './active-time';

export interface ActiveClockHandle {
  /** Milisegundos activos acumulados. */
  total: () => number;
  /** Devuelve lo acumulado y vuelve a cero. */
  take: () => number;
  /** Para que el reproductor avise de que hay audio sonando. */
  setPlaying: (playing: boolean) => void;
}

/**
 * Mide el tiempo activo en la página: cuenta mientras hay teclas, toques o scroll recientes
 * (o audio sonando) y se detiene con la pestaña oculta.
 */
export function useActiveClock(): ActiveClockHandle {
  const clockRef = useRef<ActiveClock | null>(null);

  useEffect(() => {
    const clock = new ActiveClock(Date.now());
    clockRef.current = clock;

    const onInteract = () => clock.interact(Date.now());
    const onVisibility = () => clock.setPaused(document.hidden, Date.now());
    const events = ['pointerdown', 'keydown', 'scroll', 'wheel', 'touchmove'] as const;

    for (const name of events) window.addEventListener(name, onInteract, { passive: true });
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      for (const name of events) window.removeEventListener(name, onInteract);
      document.removeEventListener('visibilitychange', onVisibility);
      clockRef.current = null;
    };
  }, []);

  return useMemo(
    () => ({
      total: () => clockRef.current?.totalMs(Date.now()) ?? 0,
      take: () => clockRef.current?.take(Date.now()) ?? 0,
      setPlaying: (playing: boolean) => clockRef.current?.setPlaying(playing, Date.now()),
    }),
    [],
  );
}
