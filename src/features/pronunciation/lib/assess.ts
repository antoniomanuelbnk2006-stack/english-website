// Valorar lo que el reconocimiento de voz ha entendido frente a lo que había que decir.
// Lógica pura. No mide sonidos: mide si un reconocedor entrenado con hablantes nativos entiende
// cada palabra, que es una buena aproximación a «se me entiende» (ADR-0015).

/** Una de las hipótesis que devuelve el reconocedor, de más a menos probable. */
export interface Alternative {
  transcript: string;
  confidence?: number;
}

export type WordStatus = 'ok' | 'wrong' | 'missing';

export interface WordResult {
  /** La palabra tal como está escrita en el texto que había que decir. */
  text: string;
  status: WordStatus;
  /** Lo que se oyó en su lugar, si se oyó otra cosa. */
  heard?: string;
}

/** `good`: entendido a la primera. `close`: casi, o entendido con dudas. `retry`: no entendido. */
export type Verdict = 'good' | 'close' | 'retry';

export interface Confusion {
  heard: string;
  tip_es: string;
}

export interface Assessment {
  verdict: Verdict;
  /** Parte de las palabras que se han entendido, de 0 a 1. */
  score: number;
  words: WordResult[];
  /** Lo que más probable le pareció al reconocedor. */
  heard: string;
  /** La hipótesis buena no era la primera: lo entendió, pero dudando. */
  hesitant: boolean;
  /** Confusión típica detectada, con su consejo. */
  confusion: Confusion | null;
}

const DIGITS: Record<string, string> = {
  '0': 'zero',
  '1': 'one',
  '2': 'two',
  '3': 'three',
  '4': 'four',
  '5': 'five',
  '6': 'six',
  '7': 'seven',
  '8': 'eight',
  '9': 'nine',
  '10': 'ten',
  '11': 'eleven',
  '12': 'twelve',
  '13': 'thirteen',
  '14': 'fourteen',
  '15': 'fifteen',
  '16': 'sixteen',
  '17': 'seventeen',
  '18': 'eighteen',
  '19': 'nineteen',
  '20': 'twenty',
  '30': 'thirty',
  '40': 'forty',
  '50': 'fifty',
  '60': 'sixty',
  '70': 'seventy',
  '80': 'eighty',
  '90': 'ninety',
  '100': 'hundred',
};

/** Contracciones que el reconocedor puede devolver desplegadas, o al revés. */
const CONTRACTIONS: Record<string, string[]> = {
  "i'm": ['i', 'am'],
  "can't": ['can', 'not'],
  cannot: ['can', 'not'],
  "won't": ['will', 'not'],
  "shan't": ['shall', 'not'],
  "let's": ['let', 'us'],
  its: ['it', 'is'],
  gonna: ['going', 'to'],
  wanna: ['want', 'to'],
};

const SUFFIXES: [string, string][] = [
  ["n't", 'not'],
  ["'re", 'are'],
  ["'ve", 'have'],
  ["'ll", 'will'],
  ["'d", 'would'],
  ["'s", 'is'],
];

/** Palabras que suenan igual o que solo cambian de grafía: valen como la misma. */
const SAME_SOUND: string[][] = [
  ['to', 'too', 'two'],
  ['there', 'their'],
  ['right', 'write'],
  ['see', 'sea'],
  ['hear', 'here'],
  ['know', 'no'],
  ['one', 'won'],
  ['son', 'sun'],
  ['meet', 'meat'],
  ['week', 'weak'],
  ['hour', 'our'],
  ['buy', 'by', 'bye'],
  ['for', 'four'],
  ['flower', 'flour'],
  ['wait', 'weight'],
  ['eight', 'ate'],
  ['wear', 'where'],
  ['whole', 'hole'],
  ['new', 'knew'],
  ['peace', 'piece'],
  ['sale', 'sail'],
  ['male', 'mail'],
  ['plane', 'plain'],
  ['road', 'rode'],
  ['steal', 'steel'],
  ['tail', 'tale'],
  ['waste', 'waist'],
  ['which', 'witch'],
  ['wood', 'would'],
  ['be', 'bee'],
  ['knight', 'night'],
  ['ok', 'okay'],
  ['colour', 'color'],
  ['favourite', 'favorite'],
  ['centre', 'center'],
  ['theatre', 'theater'],
  ['grey', 'gray'],
  ['mr', 'mister'],
  ['mrs', 'missus'],
  ['dr', 'doctor'],
  ['colonel', 'kernel'],
  ['queue', 'cue'],
  ['draught', 'draft'],
  ['segue', 'segway'],
  ['heard', 'herd'],
];
const CANONICAL = new Map<string, string>();
for (const group of SAME_SOUND) {
  for (const word of group) CANONICAL.set(word, group[0] ?? word);
}

/** Texto en palabras sueltas: minúsculas, sin puntuación, con los guiones como espacios. */
function tokens(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[‘’ʼ]/g, "'")
    .replace(/[^a-z0-9' ]+/g, ' ')
    .split(/\s+/)
    .map((word) => word.replace(/^'+|'+$/g, ''))
    .filter(Boolean);
}

/** Forma canónica de una palabra: cifras en letra, contracciones desplegadas y homófonos unidos. */
function canonical(word: string): string[] {
  const same = (part: string) => CANONICAL.get(part) ?? part;
  const spelled = DIGITS[word] ?? word;
  const whole = CONTRACTIONS[spelled];
  if (whole) return whole.map(same);
  for (const [suffix, full] of SUFFIXES) {
    if (spelled.length > suffix.length && spelled.endsWith(suffix)) {
      return [...canonical(spelled.slice(0, -suffix.length)), same(full)];
    }
  }
  return [same(spelled)];
}

/** Palabras canónicas de un texto: lo que se compara. */
export function canonicalWords(text: string): string[] {
  return tokens(text).flatMap(canonical);
}

type Step = 'match' | 'substitute' | 'delete' | 'insert';

/**
 * Alinea lo esperado con lo oído (distancia de edición por palabras). Para cada palabra
 * esperada dice si se oyó, si se oyó otra en su lugar o si faltó.
 */
function align(
  expected: readonly string[],
  heard: readonly string[],
): { status: WordStatus; heard?: string }[] {
  const rows = expected.length + 1;
  const cols = heard.length + 1;
  const cost: number[][] = Array.from({ length: rows }, () => new Array<number>(cols).fill(0));
  for (let i = 0; i < rows; i++) (cost[i] as number[])[0] = i;
  for (let j = 0; j < cols; j++) (cost[0] as number[])[j] = j;
  const at = (i: number, j: number) => cost[i]?.[j] ?? 0;

  for (let i = 1; i < rows; i++) {
    for (let j = 1; j < cols; j++) {
      const same = expected[i - 1] === heard[j - 1];
      (cost[i] as number[])[j] = Math.min(
        at(i - 1, j - 1) + (same ? 0 : 1),
        at(i - 1, j) + 1,
        at(i, j - 1) + 1,
      );
    }
  }

  const result: { status: WordStatus; heard?: string }[] = [];
  let i = expected.length;
  let j = heard.length;
  while (i > 0) {
    const same = j > 0 && expected[i - 1] === heard[j - 1];
    let step: Step;
    if (j > 0 && at(i, j) === at(i - 1, j - 1) + (same ? 0 : 1))
      step = same ? 'match' : 'substitute';
    else if (at(i, j) === at(i - 1, j) + 1) step = 'delete';
    else step = 'insert';

    if (step === 'insert') {
      j -= 1;
      continue;
    }
    if (step === 'match') result.push({ status: 'ok' });
    else if (step === 'substitute') result.push({ status: 'wrong', heard: heard[j - 1] });
    else result.push({ status: 'missing' });
    i -= 1;
    if (step !== 'delete') j -= 1;
  }
  return result.reverse();
}

interface Scored {
  words: WordResult[];
  score: number;
}

function scoreAgainst(target: string, transcript: string): Scored {
  // Cada palabra escrita puede ser varias canónicas («don't» → do + not): vale si valen todas.
  const display = target.split(/\s+/).filter((word) => tokens(word).length > 0);
  const groups = display.map((word) => tokens(word).flatMap(canonical));
  const heardWords = canonicalWords(transcript);
  // «sea shells» y «seashells» son lo mismo dicho: si solo cambian los espacios, está bien.
  if (display.length > 0 && tokens(target).join('') === tokens(transcript).join('')) {
    return { words: display.map((text) => ({ text, status: 'ok' })), score: 1 };
  }
  const aligned = align(groups.flat(), heardWords);

  let offset = 0;
  const words = display.map((text, index): WordResult => {
    const size = groups[index]?.length ?? 0;
    const part = aligned.slice(offset, offset + size);
    offset += size;
    if (part.every((piece) => piece.status === 'ok')) return { text, status: 'ok' };
    const heardInstead = part.flatMap((piece) => (piece.heard ? [piece.heard] : []));
    if (heardInstead.length > 0) return { text, status: 'wrong', heard: heardInstead.join(' ') };
    return { text, status: 'missing' };
  });
  const ok = words.filter((word) => word.status === 'ok').length;
  return { words, score: words.length === 0 ? 0 : ok / words.length };
}

/** A partir de esta parte de palabras entendidas, el intento cuenta como «casi». */
export const CLOSE_THRESHOLD = 0.7;

/**
 * Valora un intento. Se queda con la hipótesis del reconocedor que mejor encaja: si la buena
 * no era la primera, lo ha entendido pero dudando. Si lo que más le sonó es una confusión
 * típica del ejercicio (decir *sheep* por *ship*), devuelve su consejo.
 */
export function assess(
  target: string,
  alternatives: readonly Alternative[],
  confusions: readonly Confusion[] = [],
): Assessment {
  const heard = alternatives[0]?.transcript.trim() ?? '';
  let best: Scored = scoreAgainst(target, heard);
  let bestIndex = 0;
  alternatives.forEach((alternative, index) => {
    const scored = scoreAgainst(target, alternative.transcript);
    if (scored.score > best.score) {
      best = scored;
      bestIndex = index;
    }
  });

  // Lo que más le sonó contiene una confusión típica: aunque haya entendido la palabra, algo
  // ha sonado de más o distinto («a school» por «school»), así que no cuenta como perfecto.
  const top = canonicalWords(heard).join(' ');
  const confusion =
    confusions.find((candidate) => {
      const wanted = canonicalWords(candidate.heard).join(' ');
      return wanted !== '' && ` ${top} `.includes(` ${wanted} `);
    }) ?? null;

  const understood = best.words.length > 0 && best.score === 1;
  const hesitant = understood && bestIndex > 0;
  const verdict: Verdict =
    understood && !hesitant && !confusion
      ? 'good'
      : best.score >= CLOSE_THRESHOLD
        ? 'close'
        : 'retry';

  return { verdict, score: best.score, words: best.words, heard, hesitant, confusion };
}
