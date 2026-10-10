'use client';

import { useCallback, useMemo, useState, useSyncExternalStore } from 'react';
import { z } from 'zod';
import type { Answers } from './part-view';

// Una prueba en curso: cuándo empezó y qué se ha respondido. La de Reading se guarda en este
// navegador para que recargar la página no la pierda (el reloj sigue corriendo, como en el
// examen). La de Listening no: la cinta no se puede reanudar a medias.

const Stored = z.object({
  /** Identifica la entrega (repetir el envío no la guarda dos veces). */
  id: z.uuid(),
  startedAt: z.number().int().positive(),
  answers: z.record(z.string(), z.union([z.string(), z.number()])),
});
export type Sitting = z.infer<typeof Stored>;

const listeners = new Set<() => void>();

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function read(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    // Almacenamiento bloqueado: la prueba vive solo en esta página.
    return null;
  }
}

function write(key: string, sitting: Sitting | null): void {
  try {
    if (sitting === null) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, JSON.stringify(sitting));
  } catch {
    // Sin almacenamiento no hay nada que avisar: el estado en memoria sigue valiendo.
  }
  for (const listener of listeners) listener();
}

function parse(raw: string | null): Sitting | null {
  if (raw === null) return null;
  try {
    return Stored.safeParse(JSON.parse(raw)).data ?? null;
  } catch {
    return null;
  }
}

export interface SittingControls {
  sitting: Sitting | null;
  answers: Answers;
  start: () => void;
  answer: (n: number, value: string | number) => void;
  clear: () => void;
}

/**
 * El estado de una prueba. Con `persist`, vive en el almacenamiento del navegador; en el
 * servidor y en el primer pintado no hay ninguna (sin desajuste de hidratación).
 */
export function useSitting(paperId: string, version: number, persist: boolean): SittingControls {
  const key = `senal:exam:${paperId}:v${version}`;
  const raw = useSyncExternalStore(
    subscribe,
    () => (persist ? read(key) : null),
    () => null,
  );
  const stored = useMemo(() => parse(raw), [raw]);
  const [local, setLocal] = useState<Sitting | null>(null);
  // Si el almacenamiento falla, lo último que se escribió sigue en memoria.
  const sitting = persist ? (stored ?? local) : local;

  const save = useCallback(
    (next: Sitting | null) => {
      setLocal(next);
      if (persist) write(key, next);
    },
    [key, persist],
  );

  const start = useCallback(() => {
    save({ id: crypto.randomUUID(), startedAt: Date.now(), answers: {} });
  }, [save]);

  const answer = useCallback(
    (n: number, value: string | number) => {
      if (!sitting) return;
      save({ ...sitting, answers: { ...sitting.answers, [String(n)]: value } });
    },
    [save, sitting],
  );

  const clear = useCallback(() => save(null), [save]);

  const answers = useMemo<Answers>(
    () =>
      Object.fromEntries(
        Object.entries(sitting?.answers ?? {}).map(([n, value]) => [Number(n), value]),
      ),
    [sitting],
  );

  return { sitting, answers, start, answer, clear };
}
