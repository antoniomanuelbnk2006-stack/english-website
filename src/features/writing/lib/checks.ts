import { BASE_LANGUAGE, type PracticeLanguage } from '@/lib/content/language';
import { countWords, splitParagraphs, type WritingTaskType } from '@/lib/content/writing-schema';
import { RULES, type CorrectionType, type Rule } from './rules';

// Revisión automática de un writing, sin IA: errores típicos (reglas de `rules.ts`) y
// comprobaciones de forma (longitud, párrafos, saludo, conectores…). Determinista: el mismo
// texto da siempre el mismo resultado, así que no hace falta guardarlo.

export type Level = 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2';

export interface Hint {
  /** Regla que lo ha encontrado. */
  rule: string;
  type: CorrectionType;
  severity: 'major' | 'minor' | 'check';
  /** Posición del tramo marcado dentro del texto. */
  start: number;
  end: number;
  /** El tramo, tal como está escrito. */
  match: string;
  /** Sustitución propuesta, o `null` si solo es un aviso. */
  suggestion: string | null;
  explanation_es: string;
  /** Ficha de gramática relacionada, o cadena vacía. */
  grammar_ref: string;
  /** ¿Da para una tarjeta de repaso? */
  card: boolean;
}

/** En estos textos se espera registro formal (sin contracciones ni coloquialismos). */
const FORMAL_TASKS: ReadonlySet<WritingTaskType> = new Set(['essay', 'report', 'proposal']);

export const isFormal = (taskType: WritingTaskType): boolean => FORMAL_TASKS.has(taskType);

/** Como mucho, estas apariciones de una misma regla: el resto sería ruido. */
const MAX_PER_RULE = 3;

function capitalizeLike(source: string, replacement: string): string {
  return /^[A-Z]/.test(source) && /^[a-z]/.test(replacement)
    ? `${replacement.charAt(0).toUpperCase()}${replacement.slice(1)}`
    : replacement;
}

/** Lo que una sola regla encuentra en el texto. */
export function applyRule(rule: Rule, text: string): Hint[] {
  const found: Hint[] = [];
  const pattern = new RegExp(rule.pattern.source, rule.pattern.flags);
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(text)) !== null) {
    if (match[0] === '') {
      pattern.lastIndex++;
      continue;
    }
    const result = rule.find(match, {
      before: text.slice(0, match.index),
      after: text.slice(match.index + match[0].length),
    });
    if (!result) continue;

    const start = match.index + (result.start ?? 0);
    const end = match.index + (result.end ?? match[0].length);
    const fragment = text.slice(start, end);
    const suggestion =
      result.suggestion === null ? null : capitalizeLike(fragment, result.suggestion);
    if (suggestion === fragment) continue;

    found.push({
      rule: rule.id,
      type: rule.type,
      severity: rule.severity,
      start,
      end,
      match: fragment,
      suggestion,
      explanation_es: rule.explanation_es,
      grammar_ref: rule.grammar_ref ?? '',
      card: rule.card !== false && suggestion !== null,
    });
    if (found.length >= MAX_PER_RULE) break;
  }
  return found;
}

/** Posibles errores del texto, en orden de aparición y sin solaparse. */
export function findHints(
  text: string,
  options: { formal: boolean; language?: PracticeLanguage },
): Hint[] {
  // Las reglas son de inglés (errores típicos de quien lo aprende): en otro idioma no aplican.
  if ((options.language ?? BASE_LANGUAGE) !== BASE_LANGUAGE) return [];
  const found = RULES.filter((rule) => options.formal || !rule.formalOnly).flatMap((rule) =>
    applyRule(rule, text),
  );

  // Si dos reglas marcan lo mismo, se queda la primera (y, a igualdad, la más larga).
  found.sort((a, b) => a.start - b.start || b.end - a.end);
  const hints: Hint[] = [];
  for (const hint of found) {
    const previous = hints.at(-1);
    if (previous && hint.start < previous.end) continue;
    hints.push(hint);
  }
  return hints;
}

/** El texto con las sustituciones propuestas aplicadas (los avisos sin propuesta se dejan). */
export function applySuggestions(
  text: string,
  hints: readonly Pick<Hint, 'start' | 'end' | 'suggestion'>[],
): string {
  let result = text;
  for (const hint of [...hints].sort((a, b) => b.start - a.start)) {
    if (hint.suggestion === null) continue;
    result = `${result.slice(0, hint.start)}${hint.suggestion}${result.slice(hint.end)}`;
  }
  return result;
}

// ───────────── Frases ─────────────

export interface Sentence {
  text: string;
  start: number;
  end: number;
}

/**
 * Frases del texto con su posición. Corta en la puntuación final seguida de mayúscula (o del
 * final del texto) y en los saltos de línea: «at 9 a.m. and…» sigue siendo una sola frase.
 */
export function splitSentences(text: string): Sentence[] {
  const sentences: Sentence[] = [];
  const push = (from: number, to: number) => {
    const raw = text.slice(from, to);
    const trimmed = raw.trim();
    if (trimmed === '') return;
    const start = from + (raw.length - raw.trimStart().length);
    sentences.push({ text: trimmed, start, end: start + trimmed.length });
  };

  const boundary = /([.!?]+)(?=\s+["'“‘(]?[A-Z0-9]|\s*$)|\n+/g;
  let cursor = 0;
  let match: RegExpExecArray | null;
  while ((match = boundary.exec(text)) !== null) {
    push(cursor, match.index + (match[1]?.length ?? 0));
    cursor = match.index + match[0].length;
  }
  push(cursor, text.length);
  return sentences;
}

// ───────────── Comprobaciones de forma ─────────────

export type FormCheck =
  | { id: 'length'; ok: boolean; words: number; min: number; max: number }
  | { id: 'paragraphs'; ok: boolean; count: number; expected: number }
  | { id: 'greeting'; ok: boolean }
  | { id: 'closing'; ok: boolean }
  | { id: 'headings'; ok: boolean; count: number; expected: number }
  | { id: 'linkers'; ok: boolean; found: string[]; expected: number }
  | { id: 'overused'; ok: boolean; words: { word: string; count: number }[] }
  | { id: 'long_sentences'; ok: boolean; count: number; limit: number };

const ORDER: readonly Level[] = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
const atLeast = (level: Level, min: Level) => ORDER.indexOf(level) >= ORDER.indexOf(min);

/** Párrafos que pide, como mínimo, cada tipo de texto a partir de cada nivel. */
export function expectedParagraphs(taskType: WritingTaskType, level: Level): number {
  if (!atLeast(level, 'B1')) return 1;
  switch (taskType) {
    case 'message':
      return 1;
    case 'story':
      return 2;
    case 'email':
    case 'article':
      return level === 'B1' ? 3 : 4;
    case 'report':
    case 'proposal':
      return 3;
    default:
      return 4;
  }
}

const GREETING = /^\s*(hi|hello|hey|dear|good\s+(?:morning|afternoon|evening)|to\s+whom)\b/i;
const CLOSING =
  /\b(best\s+wishes|best\s+regards|kind\s+regards|regards|yours\s+(?:sincerely|faithfully)|yours|love|lots\s+of\s+love|see\s+you|take\s+care|thanks|thank\s+you|cheers|all\s+the\s+best|bye|write\s+(?:back\s+)?soon|speak\s+soon|hope\s+to\s+hear|looking\s+forward|look\s+forward|let\s+me\s+know)\b/i;

/** Conectores que se buscan. Los cuatro primeros son tan básicos que solo cuentan hasta A2. */
const BASIC_LINKERS = ['and', 'but', 'because', 'so'];
const LINKERS = [
  'also',
  'then',
  'first',
  'firstly',
  'secondly',
  'finally',
  'for example',
  'for instance',
  'however',
  'although',
  'even though',
  'though',
  'as well',
  'while',
  'whereas',
  'moreover',
  'furthermore',
  'in addition',
  'besides',
  'on the other hand',
  'on the one hand',
  'therefore',
  'as a result',
  'consequently',
  'thus',
  'hence',
  'despite',
  'in spite of',
  'nevertheless',
  'nonetheless',
  'in conclusion',
  'to sum up',
  'to conclude',
  'overall',
  'in fact',
  'indeed',
  'in other words',
  'that said',
  'having said that',
  'by contrast',
  'in contrast',
  'similarly',
  'instead',
  'otherwise',
  'unless',
  'so that',
  'in order to',
  'as long as',
  'provided that',
  'not only',
  'above all',
  'in my opinion',
  'in my view',
  'admittedly',
  'granted',
  'what is more',
  'after that',
  'later',
  'suddenly',
  'eventually',
  'meanwhile',
  'at first',
  'in the end',
  'since',
  'first of all',
  'to begin with',
  'all in all',
  'all things considered',
  'on balance',
  'yet',
  'even so',
  'namely',
];

const escapeRegExp = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Conectores distintos que aparecen en el texto. */
export function linkersIn(text: string, level: Level): string[] {
  const candidates = atLeast(level, 'B1') ? LINKERS : [...BASIC_LINKERS, ...LINKERS];
  return candidates.filter((linker) =>
    new RegExp(`\\b${escapeRegExp(linker).replace(/ /g, '\\s+')}\\b`, 'i').test(text),
  );
}

const EXPECTED_LINKERS: Record<Level, number> = { A1: 0, A2: 2, B1: 3, B2: 4, C1: 4, C2: 4 };

/**
 * Conectores distintos que se esperan. Un relato, un artículo o una reseña se sostienen menos
 * en conectores explícitos que un ensayo, así que se les pide uno menos.
 */
export function expectedLinkers(taskType: WritingTaskType, level: Level): number {
  const base = EXPECTED_LINKERS[level];
  const looser = taskType === 'story' || taskType === 'article' || taskType === 'review';
  return looser ? Math.max(Math.min(base, 2), base - 1) : base;
}

/** Palabras comodín: si se repiten mucho, el texto suena pobre. */
const WEAK_WORDS = ['good', 'bad', 'nice', 'very', 'really', 'thing', 'things', 'important', 'big'];

export function overusedWords(text: string): { word: string; count: number }[] {
  const total = countWords(text);
  const threshold = Math.max(3, Math.ceil(total / 50));
  const counts = new Map<string, number>();
  for (const token of text.toLowerCase().match(/[a-z]+/g) ?? []) {
    const word = token === 'things' ? 'thing' : token;
    if (WEAK_WORDS.includes(token)) counts.set(word, (counts.get(word) ?? 0) + 1);
  }
  return [...counts.entries()]
    .filter(([, count]) => count >= threshold)
    .map(([word, count]) => ({ word, count }))
    .sort((a, b) => b.count - a.count || a.word.localeCompare(b.word));
}

/** Líneas que hacen de título de sección: cortas y sin punto final. */
function countHeadings(text: string): number {
  return text
    .split(/\n+/)
    .map((line) => line.trim())
    .filter((line) => line !== '' && countWords(line) <= 6 && !/[.!?,;]$/.test(line)).length;
}

export interface FormInput {
  /** Idioma del texto; inglés si no se dice. */
  language?: PracticeLanguage;
  level: Level;
  taskType: WritingTaskType;
  wordsMin: number;
  wordsMax: number;
}

/** Comprobaciones de forma que tocan según el nivel y el tipo de texto. */
export function checkForm(text: string, task: FormInput): FormCheck[] {
  const checks: FormCheck[] = [];
  const words = countWords(text);
  checks.push({
    id: 'length',
    ok: words >= task.wordsMin && words <= task.wordsMax,
    words,
    min: task.wordsMin,
    max: task.wordsMax,
  });

  // Saludo, despedida, conectores y palabras repetidas se comprueban con listas de inglés: en otro
  // idioma solo valen las comprobaciones que no dependen de la lengua (longitud, párrafos, frases).
  const english = (task.language ?? BASE_LANGUAGE) === BASE_LANGUAGE;
  const letter = task.taskType === 'email' || task.taskType === 'message';
  const sectioned = task.taskType === 'report' || task.taskType === 'proposal';
  const paragraphs = splitParagraphs(text);

  const expected = expectedParagraphs(task.taskType, task.level);
  if (expected > 1) {
    // En un informe los títulos no son párrafos; en un correo, el saludo y la firma tampoco.
    const body = paragraphs.filter((block) => countWords(block) > (sectioned || letter ? 6 : 0));
    checks.push({ id: 'paragraphs', ok: body.length >= expected, count: body.length, expected });
  }

  if (letter && english) {
    checks.push({ id: 'greeting', ok: GREETING.test(text) });
    checks.push({ id: 'closing', ok: CLOSING.test(paragraphs.slice(-3).join('\n')) });
  }
  if (sectioned && english) {
    const count = countHeadings(text);
    checks.push({ id: 'headings', ok: count >= 3, count, expected: 3 });
  }

  const wanted = english ? expectedLinkers(task.taskType, task.level) : 0;
  if (wanted > 0) {
    const found = linkersIn(text, task.level);
    checks.push({ id: 'linkers', ok: found.length >= wanted, found, expected: wanted });
  }

  if (english && atLeast(task.level, 'A2')) {
    const overused = overusedWords(text);
    checks.push({ id: 'overused', ok: overused.length === 0, words: overused });
  }

  if (atLeast(task.level, 'B1')) {
    const limit = atLeast(task.level, 'C1') ? 45 : 35;
    const count = splitSentences(text).filter(
      (sentence) => countWords(sentence.text) > limit,
    ).length;
    checks.push({ id: 'long_sentences', ok: count === 0, count, limit });
  }

  return checks;
}

export interface SelfReview {
  words: number;
  checks: FormCheck[];
  hints: Hint[];
}

/** La revisión completa sin IA de un texto para una consigna. */
export function reviewText(text: string, task: FormInput): SelfReview {
  return {
    words: countWords(text),
    checks: checkForm(text, task),
    hints: findHints(text, { formal: isFormal(task.taskType), language: task.language }),
  };
}
