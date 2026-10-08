import 'server-only';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { z } from 'zod';
import { CONTENT_ROOT } from './index';
import { Cefr } from './schema';

type Level = z.infer<typeof Cefr>;

let cache: Map<string, Level> | null = null;

/** Lema → nivel MCER, de `levels.generated.json` (lo genera `pnpm content:index`). */
function levels(): Map<string, Level> {
  if (cache) return cache;
  const file = path.join(CONTENT_ROOT, 'wordlists', 'levels.generated.json');
  if (!existsSync(file)) {
    throw new Error('Falta wordlists/levels.generated.json. Ejecuta: pnpm content:index');
  }
  const byLevel = z
    .partialRecord(Cefr, z.array(z.string()))
    .parse(JSON.parse(readFileSync(file, 'utf8')));
  cache = new Map();
  for (const [level, lemmas] of Object.entries(byLevel)) {
    for (const lemma of lemmas ?? []) cache.set(lemma, level as Level);
  }
  return cache;
}

/** Nivel MCER de un lema, o `undefined` si no está en ninguna lista. */
export function levelOfLemma(lemma: string): Level | undefined {
  return levels().get(lemma);
}
