import 'server-only';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { z } from 'zod';
import { CONTENT_ROOT } from './index';
import { BASE_LANGUAGE, type PracticeLanguage } from './language';
import { languageRoot } from './language-dirs';
import { Cefr } from './schema';

type Level = z.infer<typeof Cefr>;

const cache = new Map<PracticeLanguage, Map<string, Level>>();

/**
 * Lema → nivel MCER de un idioma, de `levels.generated.json` (lo genera `pnpm content:index`).
 * Los idiomas que aún no tienen listas (todos menos el inglés) no dan nivel a ninguna palabra.
 */
function levels(language: PracticeLanguage): Map<string, Level> {
  const cached = cache.get(language);
  if (cached) return cached;
  const file = path.join(languageRoot(CONTENT_ROOT, language), 'wordlists', 'levels.generated.json');
  if (!existsSync(file)) {
    if (language !== BASE_LANGUAGE) {
      const empty = new Map<string, Level>();
      cache.set(language, empty);
      return empty;
    }
    throw new Error('Falta wordlists/levels.generated.json. Ejecuta: pnpm content:index');
  }
  const byLevel = z
    .partialRecord(Cefr, z.array(z.string()))
    .parse(JSON.parse(readFileSync(file, 'utf8')));
  const map = new Map<string, Level>();
  for (const [level, lemmas] of Object.entries(byLevel)) {
    for (const lemma of lemmas ?? []) map.set(lemma, level as Level);
  }
  cache.set(language, map);
  return map;
}

/** Nivel MCER de un lema de `language` (inglés por defecto), o `undefined` si no está en ninguna lista. */
export function levelOfLemma(
  lemma: string,
  language: PracticeLanguage = BASE_LANGUAGE,
): Level | undefined {
  return levels(language).get(lemma);
}
