import 'server-only';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { CONTENT_ROOT } from './index';
import { PronunciationSet } from './pronunciation-schema';

// Ejercicios de pronunciación publicados. El contenido no cambia mientras el servidor está en
// marcha: se lee una vez y se guarda en memoria.

const ROOT = path.join(CONTENT_ROOT, 'pronunciation');

let sets: Map<string, PronunciationSet> | null = null;

function loadAll(): Map<string, PronunciationSet> {
  if (sets) return sets;
  const all = new Map<string, PronunciationSet>();
  if (existsSync(ROOT)) {
    for (const level of readdirSync(ROOT)) {
      const dir = path.join(ROOT, level);
      for (const file of readdirSync(dir).filter((name) => name.endsWith('.json'))) {
        const set = PronunciationSet.parse(JSON.parse(readFileSync(path.join(dir, file), 'utf8')));
        if (set.status === 'published') all.set(set.id, set);
      }
    }
  }
  sets = all;
  return all;
}

export type PronunciationMeta = Pick<
  PronunciationSet,
  'id' | 'level' | 'title' | 'summary_es' | 'focus' | 'sounds' | 'est_minutes'
> & { items: number };

/** Índice de los ejercicios publicados, por id (que ordena por nivel). */
export function getPronunciationIndex(): PronunciationMeta[] {
  return [...loadAll().values()]
    .map(({ id, level, title, summary_es, focus, sounds, est_minutes, items }) => ({
      id,
      level,
      title,
      summary_es,
      focus,
      sounds,
      est_minutes,
      items: items.length,
    }))
    .sort((a, b) => a.id.localeCompare(b.id));
}

export function findPronunciationSet(id: string): PronunciationSet | null {
  return loadAll().get(id) ?? null;
}
