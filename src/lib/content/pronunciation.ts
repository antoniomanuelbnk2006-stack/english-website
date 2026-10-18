import 'server-only';
import { readFileSync } from 'node:fs';
import type { Locale } from '@/lib/i18n';
import { localize } from './help';
import { assertLanguage, inLanguage, type PracticeLanguage } from './language';
import { listLevelFiles } from './language-dirs';
import { CONTENT_ROOT } from './index';
import { PronunciationSet, type RawPronunciationSet } from './pronunciation-schema';

// Ejercicios de pronunciación publicados. El contenido no cambia mientras el servidor está en
// marcha: se lee una vez y se guarda en memoria.

// Se guardan tal cual (con las ayudas sin resolver); cada acceso las resuelve al idioma pedido.
let sets: Map<string, RawPronunciationSet> | null = null;

function loadAll(): Map<string, RawPronunciationSet> {
  if (sets) return sets;
  const all = new Map<string, RawPronunciationSet>();
  // Todos los idiomas: `content/pronunciation/` y `content/<idioma>/pronunciation/` (ADR-0035).
  for (const file of listLevelFiles(CONTENT_ROOT, 'pronunciation', '.json')) {
    const set = PronunciationSet.parse(JSON.parse(readFileSync(file.path, 'utf8')));
    assertLanguage(set.id, file.language, file.path);
    if (set.status === 'published') all.set(set.id, set);
  }
  sets = all;
  return all;
}

export type PronunciationMeta = Pick<
  PronunciationSet,
  'id' | 'level' | 'title' | 'summary_es' | 'focus' | 'sounds' | 'est_minutes'
> & { items: number };

/** Índice de los ejercicios publicados, por id (que ordena por nivel), con las ayudas en `locale`. */
export function getPronunciationIndex(
  locale: Locale,
  language: PracticeLanguage,
): PronunciationMeta[] {
  return inLanguage([...loadAll().values()], language)
    .map((set) => localize(set, locale))
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

export function findPronunciationSet(id: string, locale: Locale): PronunciationSet | null {
  const set = loadAll().get(id);
  return set ? localize(set, locale) : null;
}
