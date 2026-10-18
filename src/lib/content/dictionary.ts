import 'server-only';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import type { z } from 'zod';
import type { Locale } from '@/lib/i18n';
import {
  DictionaryFile,
  lemmaKey,
  type DictionaryEntry,
  type RawDictionaryEntry,
} from './dictionary-schema';
import { localize } from './help';
import { CONTENT_ROOT } from './index';
import type { PracticeLanguage } from './language';
import { languageRoot } from './language-dirs';
import type { Cefr } from './schema';

// Mazo de palabras por idioma y nivel: `content/dictionary/` (inglés) y
// `content/<idioma>/dictionary/` (ADR-0035). Cada idioma va aparte: «come» no es la misma palabra
// en inglés que en español. El contenido no cambia mientras el servidor está en marcha: se lee
// una vez y se guarda en memoria.

type Level = z.infer<typeof Cefr>;
const LEVELS: readonly Level[] = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];

// Se guardan tal cual (con las traducciones sin resolver); cada acceso las resuelve al idioma pedido.
interface Loaded {
  byLevel: Map<Level, readonly RawDictionaryEntry[]>;
  byKey: Map<string, { entry: RawDictionaryEntry; level: Level }>;
}

const loaded = new Map<PracticeLanguage, Loaded>();

function load(language: PracticeLanguage): Loaded {
  const cached = loaded.get(language);
  if (cached) return cached;
  const dir = path.join(languageRoot(CONTENT_ROOT, language), 'dictionary');
  const byLevel = new Map<Level, readonly RawDictionaryEntry[]>();
  const byKey = new Map<string, { entry: RawDictionaryEntry; level: Level }>();
  for (const level of LEVELS) {
    const file = path.join(dir, `${level.toLowerCase()}.json`);
    if (!existsSync(file)) continue;
    const { entries } = DictionaryFile.parse(JSON.parse(readFileSync(file, 'utf8')));
    byLevel.set(level, entries);
    for (const entry of entries) {
      const key = lemmaKey(entry.lemma);
      // Una palabra pertenece al nivel más bajo en el que aparece.
      if (!byKey.has(key)) byKey.set(key, { entry, level });
    }
  }
  const result = { byLevel, byKey };
  loaded.set(language, result);
  return result;
}

/**
 * Palabras de un nivel de `language`, en orden alfabético, con la traducción en `locale`. Vacío
 * si aún no hay ninguna.
 */
export function getDictionary(
  level: Level,
  locale: Locale,
  language: PracticeLanguage,
): readonly DictionaryEntry[] {
  return localize(load(language).byLevel.get(level) ?? [], locale);
}

/** Cuántas palabras de `language` hay de cada nivel. */
export function dictionarySizes(language: PracticeLanguage): Record<Level, number> {
  const { byLevel } = load(language);
  return Object.fromEntries(LEVELS.map((level) => [level, byLevel.get(level)?.length ?? 0])) as Record<
    Level,
    number
  >;
}

/**
 * Entrada de una palabra de `language` (con la traducción en `locale`) y su nivel, o `null` si no
 * está en el mazo.
 */
export function findDictionaryEntry(
  lemma: string,
  locale: Locale,
  language: PracticeLanguage,
): { entry: DictionaryEntry; level: Level } | null {
  const found = load(language).byKey.get(lemmaKey(lemma));
  return found ? { entry: localize(found.entry, locale), level: found.level } : null;
}
