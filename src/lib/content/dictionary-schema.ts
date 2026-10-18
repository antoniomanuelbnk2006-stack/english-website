import { z } from 'zod';
import { helpText, type Localized } from './help';
import { Cefr } from './schema';

// Mazo de palabras por nivel (ADR-0015): `content/dictionary/{nivel}.json`. Los lemas y su nivel
// salen de las listas abiertas de `content/wordlists`; la traducción y el ejemplo son originales.

export const DICTIONARY_POS = [
  'noun',
  'verb',
  'adjective',
  'adverb',
  'preposition',
  'pronoun',
  'determiner',
  'conjunction',
  'number',
  'interjection',
  'modal',
  'auxiliary',
  'particle',
] as const;
export type DictionaryPos = (typeof DICTIONARY_POS)[number];

/** Traducción: acepciones separadas por `;`, sinónimos por comas. */
const Translation = z.string().min(1).max(140);

const EntryBase = z.object({
  /** Tal como se escribe: `abandon`, `April`, `carbon dioxide`. */
  lemma: z.string().min(1).max(60),
  pos: z.array(z.enum(DICTIONARY_POS)).min(1),
  example: z.string().min(1).max(200),
  /** La palabra tal como aparece en el ejemplo, para resaltarla. */
  surface: z.string().min(1).max(60),
  /** Posición en la NGSL (1 = la más frecuente), si está en ella. */
  rank: z.number().int().positive().optional(),
});

/**
 * Una palabra del mazo. La traducción es una ayuda (ADR-0034): en el contenido nuevo va en
 * `translation`, una por idioma de interfaz; el mazo de inglés la tiene en `es`, en español. Las
 * dos formas se leen igual: con `translation`.
 */
export const DictionaryEntry = z.union([
  EntryBase.extend({ translation: helpText(Translation) }),
  EntryBase.extend({ es: Translation }).transform(({ es, ...entry }) => ({
    ...entry,
    translation: es,
  })),
]);
export type RawDictionaryEntry = z.infer<typeof DictionaryEntry>;
export type DictionaryEntry = Localized<RawDictionaryEntry>;

export const DictionaryFile = z.object({
  level: Cefr,
  entries: z.array(DictionaryEntry),
});
export type RawDictionaryFile = z.infer<typeof DictionaryFile>;

/** Clave de una palabra en el léxico personal y en las tarjetas: el lema en minúsculas. */
export const lemmaKey = (lemma: string): string => lemma.trim().toLowerCase();

/** Reglas que el esquema no expresa. Devuelve los problemas encontrados (vacío = correcto). */
export function checkDictionaryFile(file: RawDictionaryFile): string[] {
  const problems: string[] = [];
  const seen = new Set<string>();
  for (const entry of file.entries) {
    const key = lemmaKey(entry.lemma);
    if (seen.has(key)) problems.push(`«${entry.lemma}» está repetida`);
    seen.add(key);
    if (!entry.example.includes(entry.surface)) {
      problems.push(`«${entry.lemma}»: el ejemplo no contiene «${entry.surface}»`);
    }
    if (!/[.!?"]$/.test(entry.example.trim())) {
      problems.push(`«${entry.lemma}»: el ejemplo no termina en puntuación`);
    }
  }
  return problems;
}
