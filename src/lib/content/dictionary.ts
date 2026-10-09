import 'server-only';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import type { z } from 'zod';
import { DictionaryFile, lemmaKey, type DictionaryEntry } from './dictionary-schema';
import { CONTENT_ROOT } from './index';
import type { Cefr } from './schema';

// Mazo de palabras por nivel. El contenido no cambia mientras el servidor está en marcha: se
// lee una vez y se guarda en memoria.

type Level = z.infer<typeof Cefr>;
const LEVELS: readonly Level[] = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];

interface Loaded {
  byLevel: Map<Level, readonly DictionaryEntry[]>;
  byKey: Map<string, { entry: DictionaryEntry; level: Level }>;
}

let loaded: Loaded | null = null;

function load(): Loaded {
  if (loaded) return loaded;
  const byLevel = new Map<Level, readonly DictionaryEntry[]>();
  const byKey = new Map<string, { entry: DictionaryEntry; level: Level }>();
  for (const level of LEVELS) {
    const file = path.join(CONTENT_ROOT, 'dictionary', `${level.toLowerCase()}.json`);
    if (!existsSync(file)) continue;
    const { entries } = DictionaryFile.parse(JSON.parse(readFileSync(file, 'utf8')));
    byLevel.set(level, entries);
    for (const entry of entries) {
      const key = lemmaKey(entry.lemma);
      // Una palabra pertenece al nivel más bajo en el que aparece.
      if (!byKey.has(key)) byKey.set(key, { entry, level });
    }
  }
  loaded = { byLevel, byKey };
  return loaded;
}

/** Palabras de un nivel, en orden alfabético. Vacío si aún no hay ninguna. */
export function getDictionary(level: Level): readonly DictionaryEntry[] {
  return load().byLevel.get(level) ?? [];
}

/** Cuántas palabras hay de cada nivel. */
export function dictionarySizes(): Record<Level, number> {
  const { byLevel } = load();
  return Object.fromEntries(LEVELS.map((level) => [level, byLevel.get(level)?.length ?? 0])) as Record<
    Level,
    number
  >;
}

/** Entrada de una palabra y su nivel, o `null` si no está en el mazo. */
export function findDictionaryEntry(
  lemma: string,
): { entry: DictionaryEntry; level: Level } | null {
  return load().byKey.get(lemmaKey(lemma)) ?? null;
}
