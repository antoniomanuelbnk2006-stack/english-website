import 'server-only';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { CONTENT_ROOT } from './index';
import { UoeSet } from './uoe-schema';

// Ejercicios de Use of English publicados. El contenido no cambia mientras el servidor está en
// marcha: se lee una vez y se guarda en memoria.

const ROOT = path.join(CONTENT_ROOT, 'use-of-english');

let sets: Map<string, UoeSet> | null = null;

function loadAll(): Map<string, UoeSet> {
  if (sets) return sets;
  const all = new Map<string, UoeSet>();
  if (existsSync(ROOT)) {
    for (const level of readdirSync(ROOT)) {
      const dir = path.join(ROOT, level);
      for (const file of readdirSync(dir).filter((name) => name.endsWith('.json'))) {
        const set = UoeSet.parse(JSON.parse(readFileSync(path.join(dir, file), 'utf8')));
        if (set.status === 'published') all.set(set.id, set);
      }
    }
  }
  sets = all;
  return all;
}

export interface UoeMeta {
  id: string;
  level: UoeSet['level'];
  part: UoeSet['part'];
  title: string;
  summary_es: string;
  est_minutes: number;
  /** Puntos que vale el ejercicio. */
  marks: number;
}

/** Índice de los ejercicios publicados, por nivel, parte e id. */
export function getUoeIndex(): UoeMeta[] {
  return [...loadAll().values()]
    .map((set) => ({
      id: set.id,
      level: set.level,
      part: set.part,
      title: set.title,
      summary_es: set.summary_es,
      est_minutes: set.est_minutes,
      marks: set.part === 'key_word_transformation' ? set.items.length * 2 : set.gaps.length,
    }))
    .sort((a, b) => a.id.localeCompare(b.id));
}

export function findUoeSet(id: string): UoeSet | null {
  return loadAll().get(id) ?? null;
}
