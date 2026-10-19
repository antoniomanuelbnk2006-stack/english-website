import { z } from 'zod';
import { kindOfEntry, type NewCard } from '@/features/srs/lib/cards';
import { lemmaKey } from '@/lib/content/dictionary-schema';
import type { PracticeLanguage } from '@/lib/content/language';

// Diccionario completo de consulta (ADR-0016): lo que devuelve Wiktionary, convertido en algo
// que la app puede enseñar. Lógica pura: no hace peticiones. Todo lo que llega de fuera pasa
// por Zod y se reduce a texto plano; nunca se pinta HTML ajeno.
// Se consulta el Wiktionary en inglés también para el español (ADR-0041): sus entradas de
// palabras españolas traen los significados en inglés, la pronunciación y las formas.

/** Lo que se puede buscar: una palabra o expresión, sin signos raros. */
export const LookupTerm = z
  .string()
  .trim()
  .min(1)
  .max(60)
  .regex(/^[\p{L}\p{N}][\p{L}\p{N} '’.-]*$/u);

/** `GET /api/rest_v1/page/definition/{palabra}`: definiciones por idioma. */
export const DefinitionResponse = z.record(
  z.string(),
  z.array(
    z.object({
      partOfSpeech: z.string(),
      language: z.string().optional(),
      definitions: z.array(
        z.object({ definition: z.string(), examples: z.array(z.string()).optional() }),
      ),
    }),
  ),
);
export type DefinitionResponse = z.infer<typeof DefinitionResponse>;

/** `GET /w/api.php?action=parse&prop=wikitext`: el texto fuente de la página. */
export const WikitextResponse = z.object({
  parse: z.object({ title: z.string(), wikitext: z.string() }),
});

/** `GET /w/api.php?action=opensearch`: títulos parecidos. */
export const SuggestResponse = z.tuple([z.string(), z.array(z.string())]).rest(z.unknown());

export interface LookupSense {
  text: string;
  example?: string;
}
export interface LookupGroup {
  /** Categoría tal como la da Wiktionary, en inglés: `Noun`, `Verb`… */
  pos: string;
  senses: LookupSense[];
}
export interface LookupTranslation {
  /** A qué acepción corresponde, en inglés. */
  gloss: string;
  terms: string[];
}
export interface LookupEntry {
  /** La palabra tal como se titula en Wiktionary (`house`, `April`, `give up`). */
  word: string;
  ipa: string | null;
  groups: LookupGroup[];
  translations: LookupTranslation[];
}

export type LookupResult =
  | { status: 'found'; entry: LookupEntry }
  | { status: 'not_found'; suggestions: string[] }
  | { status: 'unavailable' };

const MAX_GROUPS = 6;
const MAX_SENSES = 4;
const MAX_SENSE_CHARS = 320;
const MAX_EXAMPLE_CHARS = 200;
const MAX_TRANSLATIONS = 8;
const MAX_TERMS = 4;

const ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
  ndash: '–',
  mdash: '—',
  hellip: '…',
  lsquo: '‘',
  rsquo: '’',
  ldquo: '“',
  rdquo: '”',
};

const codePoint = (value: number, fallback: string): string =>
  Number.isInteger(value) && value > 0 && value <= 0x10ffff
    ? String.fromCodePoint(value)
    : fallback;

/** HTML de Wiktionary → texto plano: sin etiquetas, sin hojas de estilo y con las entidades resueltas. */
export function plainText(html: string): string {
  return html
    .replace(/<(style|script)\b[^>]*>[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<[^>]*>/g, '')
    .replace(/&#(\d+);/g, (match, digits: string) => codePoint(Number(digits), match))
    .replace(/&#x([0-9a-f]+);/gi, (match, hex: string) =>
      codePoint(Number.parseInt(hex, 16), match),
    )
    .replace(/&([a-z]+);/gi, (match, name: string) => ENTITIES[name.toLowerCase()] ?? match)
    .replace(/\s+/g, ' ')
    .replace(/\s+([;,.:!?)])/g, '$1')
    .replace(/\(\s+/g, '(')
    .trim();
}

const clip = (text: string, max: number): string =>
  text.length <= max ? text : `${text.slice(0, max - 1).trimEnd()}…`;

/** Nombre del idioma en Wiktionary («English», «Spanish»): bajo cada código vienen también otras entradas. */
const WIKTIONARY_LANGUAGE: Record<PracticeLanguage, string> = {
  en: 'English',
  es: 'Spanish',
  fr: 'French',
  zh: 'Chinese',
  ja: 'Japanese',
};

/**
 * Definiciones (siempre en inglés) de la palabra en el idioma que se practica, agrupadas por
 * categoría y recortadas a lo que cabe en pantalla.
 */
export function parseDefinitions(
  response: DefinitionResponse,
  language: PracticeLanguage = 'en',
): LookupGroup[] {
  const groups = new Map<string, LookupSense[]>();
  for (const entry of response[language] ?? []) {
    // Bajo `en` vienen también las entradas «Translingual» (símbolos, códigos): no son inglés.
    if (entry.language !== undefined && entry.language !== WIKTIONARY_LANGUAGE[language]) continue;
    const pos = plainText(entry.partOfSpeech) || 'Other';
    const senses = groups.get(pos) ?? [];
    for (const item of entry.definitions) {
      if (senses.length >= MAX_SENSES) break;
      const text = plainText(item.definition);
      if (!text) continue;
      const example = plainText(item.examples?.[0] ?? '');
      senses.push({
        text: clip(text, MAX_SENSE_CHARS),
        ...(example && example.length <= MAX_EXAMPLE_CHARS ? { example } : {}),
      });
    }
    if (senses.length > 0) groups.set(pos, senses);
  }
  return [...groups].slice(0, MAX_GROUPS).map(([pos, senses]) => ({ pos, senses }));
}

/** Pronunciación en AFI; en inglés, si hay varias, la británica. */
export function parseIpa(wikitext: string, language: PracticeLanguage = 'en'): string | null {
  const found = [
    ...wikitext.matchAll(new RegExp(`\\{\\{IPA\\|${language}\\|([^}]*)\\}\\}`, 'g')),
  ].map((match) => (match[1] ?? '').split('|'));
  const british = found.find((params) => params.some((param) => /^a=.*\b(RP|UK)\b/.test(param)));
  for (const params of british ? [british, ...found] : found) {
    const ipa = params.find((param) => /^\/.+\/$/.test(param.trim()));
    if (ipa) return ipa.trim();
  }
  return null;
}

/** ¿Las traducciones de alguna categoría están en la subpágina `/translations`? */
export function needsTranslationSubpage(wikitext: string): boolean {
  return /\{\{see translation subpage/.test(wikitext);
}

/** Marcado de wiki → texto: `[[a|b]]` → b, `[[a]]` → a, sin plantillas ni comillas de énfasis. */
function unwiki(text: string): string {
  return text
    .replace(/\[\[(?:[^\]|]*\|)?([^\]]*)\]\]/g, '$1')
    .replace(/\{\{[^{}]*\}\}/g, '')
    .replace(/'{2,}/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Traducciones al español de la sección de traducciones, acepción por acepción. Cada bloque
 * empieza en `{{trans-top|acepción}}` (o `trans-top-see`, que además remite a otra página) y
 * lleva una línea `* Spanish: {{t+|es|casa|f}}, …`.
 */
export function parseSpanish(wikitext: string): LookupTranslation[] {
  const translations: LookupTranslation[] = [];
  for (const block of wikitext.split(/\{\{trans-top(?:-see|-also)?(?![-\w])/).slice(1)) {
    if (translations.length >= MAX_TRANSLATIONS) break;
    const head = block.slice(0, Math.max(0, block.indexOf('}}')));
    const end = block.indexOf('{{trans-bottom');
    const body = end < 0 ? block : block.slice(0, end);
    const line = /^\*:?\s*Spanish:(.*)$/m.exec(body)?.[1];
    if (!line) continue;

    const terms = new Set<string>();
    for (const match of line.matchAll(/\{\{tt?\+?(?:[-+]check)?\|es\|([^|}]+)/g)) {
      const term = unwiki(match[1] ?? '');
      if (term) terms.add(term);
    }
    if (terms.size === 0) continue;

    // La acepción es el primer parámetro sin nombre; los siguientes son páginas relacionadas.
    const gloss = unwiki(head.split('|').find((part) => part && !/^[a-z0-9]+=/.test(part)) ?? '');
    translations.push({ gloss, terms: [...terms].slice(0, MAX_TERMS) });
  }
  return translations;
}

const FORM_OF =
  /^(?:(?:alternative|standard|nonstandard|obsolete|archaic|dated|rare|uncommon|US|UK|British|American|Commonwealth)\b[^.]*\b(?:spelling|form)|plural|simple past(?: and past participle)?|past participle|present participle(?: and gerund)?|third-person singular[^.]*|comparative(?: form)?|superlative(?: form)?) of ([A-Za-z][A-Za-z' -]*?)\.?$/i;

/**
 * Formas de una palabra española: «plural of casa», «first-person singular preterite indicative
 * of hablar», «inflection of comer: third-person singular…».
 */
const SPANISH_FORM_OF =
  /^[^.]*?\b(?:plural|singular|masculine|feminine|participle|gerund|preterite|imperfect|present|future|conditional|subjunctive|indicative|imperative|inflection|diminutive|augmentative|superlative)\b[^.]*? of ([\p{L}]+(?:[ -][\p{L}]+)*)(?:[.:].*)?$/iu;

/**
 * Si la entrada es solo una forma de otra palabra (*went* → *go*, *colour* → *color*,
 * *houses* → *house*; *casas* → *casa*, *hablé* → *hablar*), devuelve esa palabra: es donde
 * están el significado y la traducción.
 */
export function baseWord(entry: LookupEntry, language: PracticeLanguage = 'en'): string | null {
  const first = entry.groups[0]?.senses[0]?.text ?? '';
  const base = (language === 'es' ? SPANISH_FORM_OF : FORM_OF).exec(first.trim())?.[1]?.trim();
  return base && base.toLowerCase() !== entry.word.toLowerCase() ? base : null;
}

/** Las traducciones principales, sin repetir, para un resumen de una línea. */
export function mainTranslations(entry: LookupEntry, max = 4): string[] {
  const terms = new Set<string>();
  for (const translation of entry.translations) {
    const [first] = translation.terms;
    if (first) terms.add(first);
    if (terms.size >= max) break;
  }
  return [...terms];
}

/** Categorías de Wiktionary que coinciden con las del mazo, para traducir su nombre. */
const POS_NAMES = new Set([
  'noun',
  'verb',
  'adjective',
  'adverb',
  'preposition',
  'pronoun',
  'determiner',
  'conjunction',
  'interjection',
]);
export function posKey(pos: string): string | null {
  const key = pos.trim().toLowerCase();
  return POS_NAMES.has(key) ? key : null;
}

export const NO_TRANSLATION_ES = 'Wiktionary no trae traducción al español de esta palabra.';

/**
 * Tarjeta de repaso de una palabra buscada: delante, un ejemplo que la contenga (o la palabra
 * sola si no hay ninguno); detrás, la primera definición y las traducciones principales. En
 * español, los significados (en inglés) son la traducción.
 */
export function buildLookupCard(entry: LookupEntry, language: PracticeLanguage = 'en'): NewCard {
  const key = lemmaKey(entry.word);
  const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const whole = new RegExp(`[\\p{L}'-]*${escaped}[\\p{L}'-]*`, 'iu');
  let front = { sentence: entry.word, surface: entry.word };
  for (const sense of entry.groups.flatMap((group) => group.senses)) {
    const surface = sense.example ? whole.exec(sense.example)?.[0] : undefined;
    if (sense.example && surface) {
      front = { sentence: sense.example, surface };
      break;
    }
  }

  const definition = entry.groups[0]?.senses[0]?.text;
  const translations = mainTranslations(entry);
  if (language !== 'en') {
    const meanings = (entry.groups[0]?.senses ?? []).slice(0, 3).map((sense) => sense.text);
    return {
      kind: kindOfEntry({ lemma: entry.word, pos: '' }),
      lemma: key,
      source_lesson_id: null,
      source_segment_id: `wikt:${key}`,
      front,
      back: {
        pos: entry.groups.map((group) => group.pos.toLowerCase()).join(', '),
        def_es: clip(meanings.join('; ') || entry.word, MAX_SENSE_CHARS),
      },
    };
  }
  return {
    kind: kindOfEntry({ lemma: entry.word, pos: '' }),
    lemma: key,
    source_lesson_id: null,
    source_segment_id: `wikt:${key}`,
    front,
    back: {
      pos: entry.groups.map((group) => group.pos.toLowerCase()).join(', '),
      ...(definition ? { def_en: definition } : {}),
      def_es: translations.length > 0 ? translations.join('; ') : NO_TRANSLATION_ES,
    },
  };
}
