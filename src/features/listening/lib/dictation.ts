// Dictado diagnóstico (docs/01-pedagogia/03-listening.md §4): normaliza con equivalencias,
// alinea palabra a palabra y propone por qué se escapó cada fallo. Lógica pura.

export const CAUSES = [
  'unknown_word',
  'not_recognized',
  'boundaries',
  'speed',
  'accent',
  'attention',
] as const;
export type Cause = (typeof CAUSES)[number];

export interface DiagnoseInput {
  /** Texto exacto del segmento. */
  reference: string;
  /** Lo que ha escrito el usuario. */
  typed: string;
  /** Lemas que el usuario conoce. */
  knownLemmas: ReadonlySet<string>;
  /** Lema de cada palabra de la referencia (en minúsculas), si viene anotada. */
  lemmas?: Readonly<Record<string, string>>;
  /** Rasgos de habla conectada marcados en el segmento. */
  features?: readonly string[];
  /** Acento del hablante (`en-GB`, `en-AU`…). */
  accent?: string;
  /** La misma frase se acertó en la escalera de velocidad a 0,75×. */
  passedAtSlowSpeed?: boolean;
}

export type WordStatus = 'ok' | 'typo' | 'wrong' | 'missing';

export interface ReferenceWord {
  /** Palabra tal como está en la referencia, con su puntuación. */
  text: string;
  status: WordStatus;
  /** Lo que se escribió en su lugar (en `typo` y `wrong`). */
  typed?: string;
}

export interface DictationError {
  /** Tramo de la referencia que falló. */
  expected: string;
  /** Lo que se escribió en ese tramo, o `null` si se omitió. */
  typed: string | null;
  cause: Cause;
  /** Índices de las palabras de la referencia afectadas. */
  words: number[];
}

export interface Diagnosis {
  /** Palabras correctas / palabras de la referencia (tras normalizar), de 0 a 1. */
  accuracy: number;
  words: ReferenceWord[];
  /** Palabras escritas que no están en la referencia. */
  extra: string[];
  errors: DictationError[];
}

// ───────────── Normalización ─────────────

const REDUCTIONS: Record<string, string[]> = {
  gonna: ['going', 'to'],
  wanna: ['want', 'to'],
  gotta: ['got', 'to'],
  hafta: ['have', 'to'],
  kinda: ['kind', 'of'],
  sorta: ['sort', 'of'],
  outta: ['out', 'of'],
  lemme: ['let', 'me'],
  gimme: ['give', 'me'],
  dunno: ['do', 'not', 'know'],
};

const CONTRACTIONS: Record<string, string[]> = {
  "won't": ['will', 'not'],
  "can't": ['can', 'not'],
  cannot: ['can', 'not'],
  "shan't": ['shall', 'not'],
  "let's": ['let', 'us'],
  "i'm": ['i', 'am'],
  "ain't": ['is', 'not'],
};

/** `'d` y `'s` son ambiguas: valen por cualquiera de sus formas completas. */
const D = "'d";
const S = "'s";
const AMBIGUOUS: Record<string, readonly string[]> = {
  [D]: ['would', 'had', 'did'],
  [S]: ['is', 'has'],
};

const UNITS = [
  'zero',
  'one',
  'two',
  'three',
  'four',
  'five',
  'six',
  'seven',
  'eight',
  'nine',
  'ten',
  'eleven',
  'twelve',
  'thirteen',
  'fourteen',
  'fifteen',
  'sixteen',
  'seventeen',
  'eighteen',
  'nineteen',
];
const TENS = ['twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];
const NUMBER_WORDS = new Map<string, number>([
  ...UNITS.map((word, value) => [word, value] as const),
  ...TENS.map((word, index) => [word, (index + 2) * 10] as const),
]);

/** Ortografía británica → estadounidense (las dos son correctas en un dictado). */
const UK_TO_US: Record<string, string> = {
  grey: 'gray',
  centre: 'center',
  metre: 'meter',
  litre: 'liter',
  theatre: 'theater',
  programme: 'program',
  travelling: 'traveling',
  travelled: 'traveled',
  cancelled: 'canceled',
  defence: 'defense',
  licence: 'license',
  practise: 'practice',
  dialogue: 'dialog',
  catalogue: 'catalog',
  aeroplane: 'airplane',
  mum: 'mom',
  okay: 'ok',
};

function americanize(word: string): string {
  const mapped = UK_TO_US[word];
  if (mapped) return mapped;
  if (word.length >= 6) {
    if (/our(s|ed|ing|ite|ites)?$/.test(word))
      return word.replace(/our(s|ed|ing|ite|ites)?$/, 'or$1');
    if (/is(e|es|ed|ing|ation)$/.test(word)) return word.replace(/is(e|es|ed|ing|ation)$/, 'iz$1');
    if (/ys(e|es|ed|ing)$/.test(word)) return word.replace(/ys(e|es|ed|ing)$/, 'yz$1');
  }
  return word;
}

/** Palabras de un texto: minúsculas, apóstrofos rectos y sin puntuación (se conserva `11:30`). */
function rawWords(text: string): string[] {
  return (
    text
      .normalize('NFKC')
      .replace(/[‘’ʼ`´]/g, "'")
      .toLowerCase()
      .match(/[\p{L}\p{N}]+(?:[':.][\p{L}\p{N}]+)*/gu) ?? []
  );
}

/**
 * Contracciones escritas sin apóstrofo («thats», «dont»): es puntuación, no oído. Se restauran
 * solo las que están en la referencia y cuya forma sin apóstrofo no es otra palabra de la frase
 * («were» no pasa a «we're» si la frase también dice «were»).
 */
function restoreApostrophes(typed: readonly string[], reference: readonly string[]): string[] {
  const present = new Set(reference);
  const restore = new Map<string, string>();
  for (const word of reference) {
    if (!word.includes("'")) continue;
    const bare = word.replace(/'/g, '');
    if (!present.has(bare)) restore.set(bare, word);
  }
  return typed.map((word) => restore.get(word) ?? word);
}

/** Expande una palabra a sus tokens canónicos (sin mirar a las vecinas). */
function expandWord(word: string): string[] {
  const time = /^(\d{1,2})[:.](\d{2})$/.exec(word);
  if (time) return [String(Number(time[1])), time[2] ?? ''];

  if (REDUCTIONS[word]) return REDUCTIONS[word];
  if (CONTRACTIONS[word]) return CONTRACTIONS[word];
  if (word.endsWith("n't")) return [word.slice(0, -3), 'not'];
  if (word.endsWith("'ll")) return [word.slice(0, -3), 'will'];
  if (word.endsWith("'ve")) return [word.slice(0, -3), 'have'];
  if (word.endsWith("'re")) return [word.slice(0, -3), 'are'];
  if (word.endsWith("'d")) return [word.slice(0, -2), D];
  if (word.endsWith("'s")) return [word.slice(0, -2), S];

  const number = NUMBER_WORDS.get(word);
  if (number !== undefined) return [String(number)];
  if (/^\d+$/.test(word)) return [String(Number(word))];

  return [americanize(word.replace(/\./g, ''))];
}

interface CanonicalToken {
  value: string;
  /** Índice de la palabra original de la que sale. */
  origin: number;
}

/**
 * Tokens canónicos de un texto, recordando de qué palabra original viene cada uno.
 * `groups[i]` son las palabras de la palabra original `i` («open-source» son dos).
 */
function canonicalize(groups: readonly (readonly string[])[]): CanonicalToken[] {
  let tokens: CanonicalToken[] = groups.flatMap((words, origin) =>
    words.flatMap((word) => expandWord(word).map((value) => ({ value, origin }))),
  );

  // «twenty one» → 21.
  const merged: CanonicalToken[] = [];
  for (const token of tokens) {
    const previous = merged.at(-1);
    const tens = previous ? Number(previous.value) : Number.NaN;
    const units = Number(token.value);
    if (
      previous &&
      /^\d+$/.test(previous.value) &&
      /^\d+$/.test(token.value) &&
      tens >= 20 &&
      tens % 10 === 0 &&
      tens < 100 &&
      units >= 1 &&
      units <= 9
    ) {
      previous.value = String(tens + units);
    } else {
      merged.push({ ...token });
    }
  }
  tokens = merged;

  // Horas: «half past eleven» y «half eleven» (británico) → 11 30; «quarter past six» → 6 15.
  const out: CanonicalToken[] = [];
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    if (!token) continue;
    const fraction = token.value === 'half' ? '30' : token.value === 'quarter' ? '15' : null;
    const next = tokens[i + 1];
    const afterNext = tokens[i + 2];
    const isHour = (t: CanonicalToken | undefined) =>
      t !== undefined && /^\d+$/.test(t.value) && Number(t.value) >= 1 && Number(t.value) <= 12;

    if (fraction && next?.value === 'past' && isHour(afterNext) && afterNext) {
      out.push(
        { value: afterNext.value, origin: afterNext.origin },
        { value: fraction, origin: token.origin },
      );
      i += 2;
    } else if (fraction === '30' && isHour(next) && next) {
      out.push(
        { value: next.value, origin: next.origin },
        { value: fraction, origin: token.origin },
      );
      i += 1;
    } else {
      out.push(token);
    }
  }
  return out;
}

// ───────────── Alineación ─────────────

function editDistance(a: string, b: string): number {
  if (a === b) return 0;
  const previous = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    let diagonal = previous[0] ?? 0;
    previous[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const above = previous[j] ?? 0;
      const left = previous[j - 1] ?? 0;
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      previous[j] = Math.min(above + 1, left + 1, diagonal + cost);
      diagonal = above;
    }
  }
  return previous[b.length] ?? 0;
}

const sameToken = (expected: string, typed: string) =>
  expected === typed ||
  AMBIGUOUS[expected]?.includes(typed) ||
  AMBIGUOUS[typed]?.includes(expected);

/** Error ortográfico leve: una letra de diferencia en palabras de cinco letras o más. */
const isTypo = (expected: string, typed: string) =>
  expected.length >= 5 && /^\p{L}+$/u.test(expected) && editDistance(expected, typed) === 1;

/** Coste de sustituir: menor si las palabras se parecen (lo normal cuando se oye mal). */
function substitutionCost(expected: string, typed: string): number {
  if (sameToken(expected, typed)) return 0;
  if (isTypo(expected, typed)) return 0.2;
  const distance = editDistance(expected, typed);
  return distance / Math.max(expected.length, typed.length) <= 0.5 ? 0.7 : 1;
}

type Op =
  | { type: 'match' | 'typo' | 'sub'; ref: number; typed: number }
  | { type: 'del'; ref: number }
  | { type: 'ins'; typed: number };

/** Alineación global (Needleman–Wunsch) entre tokens de la referencia y tokens escritos. */
function align(reference: readonly string[], typed: readonly string[]): Op[] {
  const rows = reference.length + 1;
  const cols = typed.length + 1;
  const cost: number[][] = Array.from({ length: rows }, () => new Array<number>(cols).fill(0));
  for (let i = 0; i < rows; i++) (cost[i] as number[])[0] = i;
  for (let j = 0; j < cols; j++) (cost[0] as number[])[j] = j;

  const at = (i: number, j: number) => cost[i]?.[j] ?? Infinity;
  for (let i = 1; i < rows; i++) {
    for (let j = 1; j < cols; j++) {
      const sub = at(i - 1, j - 1) + substitutionCost(reference[i - 1] ?? '', typed[j - 1] ?? '');
      (cost[i] as number[])[j] = Math.min(sub, at(i - 1, j) + 1, at(i, j - 1) + 1);
    }
  }

  const ops: Op[] = [];
  let i = reference.length;
  let j = typed.length;
  while (i > 0 || j > 0) {
    const expected = reference[i - 1] ?? '';
    const written = typed[j - 1] ?? '';
    if (i > 0 && j > 0 && at(i, j) === at(i - 1, j - 1) + substitutionCost(expected, written)) {
      const type = sameToken(expected, written)
        ? 'match'
        : isTypo(expected, written)
          ? 'typo'
          : 'sub';
      ops.push({ type, ref: i - 1, typed: j - 1 });
      i--;
      j--;
    } else if (i > 0 && at(i, j) === at(i - 1, j) + 1) {
      ops.push({ type: 'del', ref: i - 1 });
      i--;
    } else {
      ops.push({ type: 'ins', typed: j - 1 });
      j--;
    }
  }
  return ops.reverse();
}

// ───────────── Causas ─────────────

const IRREGULAR: Record<string, string> = {
  am: 'be',
  is: 'be',
  are: 'be',
  was: 'be',
  were: 'be',
  been: 'be',
  being: 'be',
  has: 'have',
  had: 'have',
  having: 'have',
  does: 'do',
  did: 'do',
  done: 'do',
  doing: 'do',
  going: 'go',
  goes: 'go',
  went: 'go',
  gone: 'go',
  got: 'get',
  gotten: 'get',
  made: 'make',
  said: 'say',
  saw: 'see',
  seen: 'see',
  took: 'take',
  taken: 'take',
  came: 'come',
  knew: 'know',
  known: 'know',
  thought: 'think',
  left: 'leave',
  found: 'find',
  told: 'tell',
  gave: 'give',
  given: 'give',
  children: 'child',
  men: 'man',
  women: 'woman',
  people: 'person',
  us: 'we',
  me: 'i',
  him: 'he',
  her: 'she',
  them: 'they',
  [D]: 'would',
  [S]: 'be',
  not: 'not',
};

/** Formas base posibles de una palabra cuando no viene su lema anotado. */
function baseForms(word: string): string[] {
  const forms = [word];
  if (IRREGULAR[word]) forms.push(IRREGULAR[word]);
  if (word.endsWith('ies')) forms.push(`${word.slice(0, -3)}y`);
  if (word.endsWith('es')) forms.push(word.slice(0, -2));
  if (word.endsWith('s')) forms.push(word.slice(0, -1));
  for (const suffix of ['ing', 'ed']) {
    if (!word.endsWith(suffix)) continue;
    const stem = word.slice(0, -suffix.length);
    forms.push(stem, `${stem}e`);
    if (/(.)\1$/.test(stem)) forms.push(stem.slice(0, -1));
  }
  if (word.endsWith('d')) forms.push(word.slice(0, -1));
  return forms;
}

const STANDARD_ACCENTS = new Set(['en-US', 'en-GB']);
const letters = (words: readonly string[]) => words.join('').replace(/[^\p{L}\p{N}]/gu, '');

/** ¿Se oyeron los sonidos pero se cortaron las palabras por otro sitio? */
function isRecut(expected: readonly string[], written: readonly string[]): boolean {
  if (written.length === 0) return false;
  const distance = editDistance(letters(expected), letters(written));
  // Palabras unidas o partidas: se tolera una letra de diferencia.
  if (written.length !== expected.length) return distance <= 1;
  // Mismo número de palabras: solo si las letras son idénticas y el corte, distinto.
  return expected.length >= 2 && distance === 0;
}

// ───────────── Diagnóstico ─────────────

export function diagnose(input: DiagnoseInput): Diagnosis {
  const originals = input.reference.trim().split(/\s+/).filter(Boolean);
  // Cada «palabra» de la referencia (con su puntuación) se normaliza por separado para saber
  // de cuál viene cada token canónico.
  const referenceWords = originals.map(rawWords);
  const refs = canonicalize(referenceWords);
  const typedTokens = canonicalize(
    restoreApostrophes(rawWords(input.typed), referenceWords.flat()).map((word) => [word]),
  );

  const ops = align(
    refs.map((t) => t.value),
    typedTokens.map((t) => t.value),
  );

  // Estado de cada palabra original: la peor de las de sus tokens.
  const words: ReferenceWord[] = originals.map((text) => ({ text, status: 'ok' }));
  const typedFor = new Map<number, string[]>();
  let correct = 0;
  const rank: Record<WordStatus, number> = { ok: 0, typo: 1, wrong: 2, missing: 3 };
  const mark = (origin: number, status: WordStatus, written?: string) => {
    const word = words[origin];
    if (!word) return;
    if (rank[status] > rank[word.status]) word.status = status;
    if (written !== undefined) typedFor.set(origin, [...(typedFor.get(origin) ?? []), written]);
  };

  const extra: string[] = [];
  /** Tokens de la referencia que fallaron, con lo escrito en su lugar. */
  const failures: { ref: number; typed: string | null }[] = [];
  /** Inserciones pegadas a un fallo: sirven para detectar cortes mal puestos. */
  const insertedNear = new Map<number, string[]>();
  let lastRef = -1;

  for (const op of ops) {
    if (op.type === 'ins') {
      const written = typedTokens[op.typed]?.value ?? '';
      extra.push(written);
      insertedNear.set(lastRef, [...(insertedNear.get(lastRef) ?? []), written]);
      continue;
    }
    lastRef = op.ref;
    const origin = refs[op.ref]?.origin ?? 0;
    if (op.type === 'match') {
      correct++;
      mark(origin, 'ok');
    } else if (op.type === 'typo') {
      correct++;
      mark(origin, 'typo', typedTokens[op.typed]?.value);
    } else if (op.type === 'sub') {
      const written = typedTokens[op.typed]?.value ?? '';
      mark(origin, 'wrong', written);
      failures.push({ ref: op.ref, typed: written });
    } else {
      mark(origin, 'missing');
      failures.push({ ref: op.ref, typed: null });
    }
  }
  for (const [origin, written] of typedFor) {
    const word = words[origin];
    if (word && word.status !== 'ok') word.typed = written.join(' ');
  }

  // Fallos contiguos se diagnostican juntos.
  const groups: { ref: number; typed: string | null }[][] = [];
  for (const failure of failures) {
    const group = groups.at(-1);
    const last = group?.at(-1);
    if (group && last && failure.ref === last.ref + 1) group.push(failure);
    else groups.push([failure]);
  }

  const isKnown = (token: string): boolean => {
    if (/^\d+$/.test(token)) return true; // un número no es vocabulario
    const lemma = input.lemmas?.[token];
    if (lemma && input.knownLemmas.has(lemma)) return true;
    return baseForms(token).some((form) => input.knownLemmas.has(form));
  };

  const features = input.features ?? [];
  const errors: DictationError[] = groups.map((group) => {
    const first = group[0]?.ref ?? 0;
    const last = group.at(-1)?.ref ?? first;
    const expected = group.map((f) => refs[f.ref]?.value ?? '');
    const written = [
      ...(insertedNear.get(first - 1) ?? []),
      ...group.flatMap((f) => (f.typed === null ? [] : [f.typed])),
      ...group.flatMap((f) => insertedNear.get(f.ref) ?? []),
    ];
    const omittedAll = group.every((f) => f.typed === null) && written.length === 0;

    let cause: Cause;
    if (omittedAll && last === refs.length - 1 && group.length >= 3) {
      // Se quedó sin el final de la frase: atención o memoria, no decodificación.
      cause = 'attention';
    } else if (isRecut(expected, written)) {
      // Mismas letras, distinto corte: «a nice» por «an ice», «alot» por «a lot».
      cause = 'boundaries';
    } else if (expected.some((token) => !isKnown(token))) {
      cause = 'unknown_word';
    } else if (features.length > 0) {
      cause = 'not_recognized';
    } else if (input.passedAtSlowSpeed) {
      cause = 'speed';
    } else if (input.accent !== undefined && !STANDARD_ACCENTS.has(input.accent)) {
      cause = 'accent';
    } else {
      // Palabras conocidas que no se reconocieron: la causa típica en B1.
      cause = 'not_recognized';
    }

    const origins = [...new Set(group.map((f) => refs[f.ref]?.origin ?? 0))];
    return {
      expected: origins.map((origin) => rawWords(originals[origin] ?? '').join('')).join(' '),
      typed: written.length > 0 ? written.join(' ') : null,
      cause,
      words: origins,
    };
  });

  return {
    accuracy: refs.length === 0 ? 1 : Number((correct / refs.length).toFixed(4)),
    words,
    extra,
    errors,
  };
}

/** Mejor diagnóstico entre la referencia y sus variantes aceptadas. */
export function diagnoseBest(input: DiagnoseInput, variants: readonly string[] = []): Diagnosis {
  let best = diagnose(input);
  for (const variant of variants) {
    if (best.accuracy === 1) break;
    const candidate = diagnose({ ...input, reference: variant });
    if (candidate.accuracy > best.accuracy) {
      // La corrección se muestra siempre sobre el texto que suena, no sobre la variante.
      best = { ...best, accuracy: candidate.accuracy, errors: candidate.errors };
      if (candidate.accuracy === 1) {
        best.words = best.words.map((word) => ({ text: word.text, status: 'ok' }));
        best.extra = [];
      }
    }
  }
  return best;
}
