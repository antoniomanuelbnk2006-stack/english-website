'use client';

import { useMemo, useSyncExternalStore } from 'react';
import { z } from 'zod';

// Borrador de un writing, guardado solo en este dispositivo (FR-W-02). Nada de esto pasa por
// el servidor hasta que se entrega.

const Draft = z.object({
  text: z.string(),
  plan: z.array(z.string()).length(3),
});
export type Draft = z.infer<typeof Draft>;

export const EMPTY_PLAN = ['', '', ''];

const key = (promptId: string) => `senal:writing:draft:${promptId}`;
const listeners = new Set<() => void>();

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function read(promptId: string): string | null {
  try {
    return window.localStorage.getItem(key(promptId));
  } catch {
    // Almacenamiento bloqueado (modo privado, ajustes del navegador): se escribe sin borrador.
    return null;
  }
}

/** Guarda el borrador, o lo borra si es `null`. */
export function writeDraft(promptId: string, draft: Draft | null): void {
  try {
    if (draft === null || (draft.text === '' && draft.plan.every((idea) => idea === ''))) {
      window.localStorage.removeItem(key(promptId));
    } else {
      window.localStorage.setItem(key(promptId), JSON.stringify(draft));
    }
  } catch {
    return;
  }
  for (const listener of listeners) listener();
}

function parse(raw: string | null): Draft | null {
  if (raw === null) return null;
  try {
    return Draft.safeParse(JSON.parse(raw)).data ?? null;
  } catch {
    return null;
  }
}

/**
 * El borrador guardado de una consigna. En el servidor (y en el primer pintado) no hay
 * ninguno: se lee del navegador sin provocar un desajuste de hidratación.
 */
export function useStoredDraft(promptId: string): Draft | null {
  const raw = useSyncExternalStore(
    subscribe,
    () => read(promptId),
    () => null,
  );
  return useMemo(() => parse(raw), [raw]);
}
