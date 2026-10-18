import 'server-only';
import { readFileSync } from 'node:fs';
import type { Locale } from '@/lib/i18n';
import { localize } from './help';
import { assertLanguage, inLanguage, type PracticeLanguage } from './language';
import { listLevelFiles } from './language-dirs';
import { CONTENT_ROOT } from './index';
import { UoeSet, type RawUoeSet } from './uoe-schema';

// Ejercicios de Use of English publicados. El contenido no cambia mientras el servidor está en
// marcha: se lee una vez y se guarda en memoria.

// Se guardan tal cual (con las ayudas sin resolver); cada acceso las resuelve al idioma pedido.
let sets: Map<string, RawUoeSet> | null = null;

function loadAll(): Map<string, RawUoeSet> {
  if (sets) return sets;
  const all = new Map<string, RawUoeSet>();
  // Todos los idiomas: `content/use-of-english/` y `content/<idioma>/use-of-english/` (ADR-0035).
  for (const file of listLevelFiles(CONTENT_ROOT, 'use-of-english', '.json')) {
    const set = UoeSet.parse(JSON.parse(readFileSync(file.path, 'utf8')));
    assertLanguage(set.id, file.language, file.path);
    if (set.status === 'published') all.set(set.id, set);
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

/** Índice de los ejercicios publicados, por nivel, parte e id, con las ayudas en `locale`. */
export function getUoeIndex(locale: Locale, language: PracticeLanguage): UoeMeta[] {
  return inLanguage([...loadAll().values()], language)
    .map((set) => localize(set, locale))
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

export function findUoeSet(id: string, locale: Locale): UoeSet | null {
  const set = loadAll().get(id);
  return set ? localize(set, locale) : null;
}
