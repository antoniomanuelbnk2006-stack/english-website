'use client';

import { useCallback, useMemo, useState } from 'react';
import type { CefrLevel } from '@/features/level/lib/bands';
import { isKnown, type LexemeStatus } from '@/features/lexicon/lib/known';
import { setLexemeStatus } from '@/features/lexicon/server/actions';
import { addCards } from '@/features/srs/server/actions';

/** Lo que el servidor sabe del usuario sobre las palabras de una lección. */
export interface LexiconSnapshot {
  userLevel: CefrLevel;
  /** Nivel MCER de los lemas de la lección que están en las listas. */
  levels: Record<string, CefrLevel>;
  /** Estado en el léxico personal de los lemas de la lección que ya están en él. */
  statuses: Record<string, LexemeStatus>;
  /** Claves de cosecha que ya tienen tarjeta (`word:release`, `audio:s16`). */
  cardKeys: string[];
}

export const EMPTY_LEXICON: LexiconSnapshot = {
  userLevel: 'B1',
  levels: {},
  statuses: {},
  cardKeys: [],
};

export type CardRequest = { kind: 'word'; lemma: string } | { kind: 'audio'; segmentId: string };

/**
 * Léxico de una lección en curso: estados, consultas, marcas y tarjetas. Los cambios se ven al
 * momento y se guardan en segundo plano; si el guardado falla, se deshacen.
 */
export function useLexiconSession(lessonId: string, initial: LexiconSnapshot = EMPTY_LEXICON) {
  const [snapshot, setSnapshot] = useState(initial);
  const [statuses, setStatuses] = useState(initial.statuses);
  const [cardKeys, setCardKeys] = useState(() => new Set(initial.cardKeys));
  /** Lemas consultados o marcados en esta sesión: tienen prioridad en la cosecha. */
  const [marked, setMarked] = useState(() => new Set<string>());
  const [failed, setFailed] = useState(false);

  /** Carga los datos del servidor cuando llegan más tarde (lección de escucha). */
  const load = useCallback((next: LexiconSnapshot) => {
    setSnapshot(next);
    setStatuses((current) => ({ ...next.statuses, ...current }));
    setCardKeys((current) => new Set([...next.cardKeys, ...current]));
  }, []);

  const statusOf = useCallback((lemma: string) => statuses[lemma], [statuses]);
  const levelOf = useCallback((lemma: string) => snapshot.levels[lemma], [snapshot.levels]);

  const knows = useCallback(
    (lemma: string, pos?: string) =>
      isKnown({
        status: statuses[lemma],
        pos,
        level: snapshot.levels[lemma],
        userLevel: snapshot.userLevel,
      }),
    [statuses, snapshot],
  );

  const mark = useCallback((lemma: string) => {
    setMarked((current) => (current.has(lemma) ? current : new Set(current).add(lemma)));
  }, []);

  const setStatus = useCallback(
    async (lemma: string, status: 'new' | 'known' | 'ignored') => {
      const previous = statuses[lemma];
      const next: LexemeStatus =
        status === 'new' && [...cardKeys].some((key) => key.endsWith(`:${lemma}`))
          ? 'learning'
          : status;
      setFailed(false);
      setStatuses((current) => ({ ...current, [lemma]: next }));
      if (status === 'new') mark(lemma);
      const result = await setLexemeStatus({ lemmas: [lemma], status }).catch(() => null);
      if (!result?.ok) {
        setFailed(true);
        setStatuses((current) => {
          const copy = { ...current };
          if (previous) copy[lemma] = previous;
          else delete copy[lemma];
          return copy;
        });
      }
    },
    [statuses, cardKeys, mark],
  );

  /** Crea tarjetas. Devuelve cuántas se han añadido, o `null` si no se pudo. */
  const addToReview = useCallback(
    async (items: readonly CardRequest[]): Promise<number | null> => {
      if (items.length === 0) return 0;
      setFailed(false);
      const result = await addCards({ lessonId, items }).catch(() => null);
      if (!result?.ok) {
        setFailed(true);
        return null;
      }
      setCardKeys((current) => {
        const next = new Set(current);
        for (const item of items) {
          if (item.kind === 'audio') next.add(`audio:${item.segmentId}`);
          else next.add(`word:${item.lemma}`).add(`chunk:${item.lemma}`);
        }
        return next;
      });
      setStatuses((current) => {
        const next = { ...current };
        for (const item of items) if (item.kind === 'word') next[item.lemma] = 'learning';
        return next;
      });
      return result.data.added;
    },
    [lessonId],
  );

  const hasCard = useCallback((key: string) => cardKeys.has(key), [cardKeys]);

  return useMemo(
    () => ({
      userLevel: snapshot.userLevel,
      load,
      statusOf,
      levelOf,
      knows,
      marked,
      mark,
      setStatus,
      addToReview,
      hasCard,
      failed,
    }),
    [
      snapshot.userLevel,
      load,
      statusOf,
      levelOf,
      knows,
      marked,
      mark,
      setStatus,
      addToReview,
      hasCard,
      failed,
    ],
  );
}

export type LexiconSession = ReturnType<typeof useLexiconSession>;
