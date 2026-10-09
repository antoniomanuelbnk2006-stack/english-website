import { z } from 'zod';
import { Cefr } from './schema';

// Ejercicios de pronunciación (ADR-0015): `content/pronunciation/{nivel}/{id}.json`. Cada uno
// trabaja un sonido o un problema típico de quien habla español, con palabras y frases para decir
// en voz alta.

export const PronunciationId = z.string().regex(/^(a1|a2|b1|b2|c1|c2)-pro-\d{3}$/);

export const PRONUNCIATION_FOCUS = [
  'vowels',
  'consonants',
  'clusters',
  'endings',
  'stress',
  'spelling',
  'sentences',
] as const;
export type PronunciationFocus = (typeof PRONUNCIATION_FOCUS)[number];

/** Lo que el reconocimiento suele oír cuando el sonido sale mal, y qué hacer para corregirlo. */
const Confusion = z.object({
  heard: z.string().min(1).max(60),
  tip_es: z.string().min(1).max(240),
});

export const PronunciationItem = z.object({
  id: z.string().regex(/^i\d{1,2}$/),
  /** Lo que hay que decir: una palabra o una frase corta. */
  text: z.string().min(1).max(140),
  ipa: z.string().min(1).max(160).optional(),
  es: z.string().min(1).max(160).optional(),
  confusions: z.array(Confusion).max(4).default([]),
});
export type PronunciationItem = z.infer<typeof PronunciationItem>;

export const PronunciationSet = z.object({
  id: PronunciationId,
  version: z.number().int().positive(),
  status: z.enum(['draft', 'published']),
  level: Cefr,
  title: z.string().min(1).max(80),
  summary_es: z.string().min(1).max(240),
  focus: z.enum(PRONUNCIATION_FOCUS),
  /** Sonidos que se trabajan, en AFI: `ɪ`, `iː`. */
  sounds: z.array(z.string().min(1).max(8)).max(6).default([]),
  /** Cómo se hace el sonido, explicado para quien habla español. */
  tip_es: z.string().min(1).max(600),
  est_minutes: z.number().int().positive().max(30),
  items: z.array(PronunciationItem).min(4).max(16),
});
export type PronunciationSet = z.infer<typeof PronunciationSet>;

/** Reglas que el esquema no expresa. Devuelve los problemas encontrados (vacío = correcto). */
export function checkPronunciationSet(set: PronunciationSet): string[] {
  const problems: string[] = [];
  if (!set.id.startsWith(`${set.level.toLowerCase()}-`)) {
    problems.push(`el id ${set.id} no corresponde al nivel ${set.level}`);
  }
  const ids = new Set<string>();
  for (const item of set.items) {
    if (ids.has(item.id)) problems.push(`el ítem ${item.id} está repetido`);
    ids.add(item.id);
    for (const confusion of item.confusions) {
      if (confusion.heard.trim().toLowerCase() === item.text.trim().toLowerCase()) {
        problems.push(`ítem ${item.id}: la confusión «${confusion.heard}» es igual que el texto`);
      }
    }
  }
  return problems;
}
