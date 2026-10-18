import { SPANISH_NAMES, SPANISH_VOWELS, type Lexicon, type Upos } from './es-lexicon';
import { normalizeText, type TokenT } from './nlp';

// Tokenización, lemas y categoría gramatical del español con el léxico de `es-lexicon.ts`.
// Determinista y sin modelo: lo que no está en el léxico sale con categoría «X» y el pipeline
// lo avisa (ver `unknownWords`), en vez de adivinarlo.

const TOKEN = /[\p{L}\p{M}]+(?:['’-][\p{L}\p{M}]+)*|\d+(?:[.,:]\d+)*|[^\s\p{L}\p{N}]/gu;

/** No cuentan para la cobertura: puntuación, números, nombres propios, símbolos e interjecciones. */
const UNCOUNTABLE_POS = new Set<string>(['PUNCT', 'NUM', 'PROPN', 'SYM', 'INTJ', 'X', 'SPACE']);
const SENTENCE_END = new Set(['.', '!', '?', '…', '¿', '¡']);

/** «Como» es el verbo (yo como) o la conjunción (tan alto como tú): se decide por la palabra anterior. */
const COMO_CONJUNCTION_AFTER = new Set(['tan', 'tanto', 'tanta', 'tantos', 'tantas', 'así', 'igual', 'tal']);

export function tokenizeEs(
  rawText: string,
  lexicon: Lexicon,
  lessonLemmas: ReadonlySet<string> = new Set(),
): TokenT[] {
  const text = normalizeText(rawText);
  const matches = [...text.matchAll(TOKEN)];
  let sentenceStart = true;
  let previousWord = '';
  let wordBefore = '';

  return matches.map((match, index): TokenT => {
    const surface = match[0];
    const lower = surface.toLowerCase();
    const after = text[(match.index ?? 0) + surface.length];
    const spaced = after !== undefined && /\s/.test(after);
    const hasLetter = /\p{L}/u.test(surface);

    let lemma = lower;
    let pos: Upos | 'PUNCT' | 'X' = 'PUNCT';
    if (/^\d/.test(surface)) {
      pos = 'NUM';
    } else if (hasLetter) {
      const known = lexicon.get(lower);
      if (lower === 'como') {
        const verb =
          lexicon.get('como') &&
          !COMO_CONJUNCTION_AFTER.has(previousWord) &&
          !COMO_CONJUNCTION_AFTER.has(wordBefore);
        lemma = verb ? 'comer' : 'como';
        pos = verb ? 'VERB' : 'SCONJ';
      } else if (
        /^\p{Lu}/u.test(surface) &&
        SPANISH_NAMES.has(lower) &&
        (!sentenceStart || /[,:;!?]/.test(after ?? ''))
      ) {
        // «Hola, Leo:» es un nombre; «Leo un libro» (a principio de frase, sin coma) es el verbo.
        pos = 'PROPN';
      } else if (known) {
        lemma = known.lemma;
        pos = known.pos;
      } else if (lessonLemmas.has(lower)) {
        pos = 'NOUN';
      } else if (/^\p{Lu}/u.test(surface) && !sentenceStart) {
        pos = 'PROPN';
      } else {
        pos = 'X';
      }
      wordBefore = previousWord;
      previousWord = lower;
    }

    if (hasLetter || pos === 'NUM') sentenceStart = false;
    if (SENTENCE_END.has(surface)) sentenceStart = true;
    if (!hasLetter && pos !== 'NUM') {
      previousWord = '';
      wordBefore = '';
    }

    const next = matches[index + 1];
    const countable = hasLetter && !UNCOUNTABLE_POS.has(pos);
    const out: TokenT = { t: surface, l: lemma, p: pos, w: countable };
    if (spaced && next) out.sp = true;
    return out;
  });
}

/** Formas que el léxico no conoce, en orden y sin repetir. */
export function unknownWords(tokens: readonly TokenT[]): string[] {
  return [...new Set(tokens.filter((token) => token.p === 'X' && /\p{L}/u.test(token.t)).map((t) => t.t))];
}

// ───────────── Sílabas y legibilidad ─────────────
const isStrong = (letter: string) => 'aeoáéó'.includes(letter);
const isAccentedWeak = (letter: string) => 'íú'.includes(letter);

/** Sílabas de una palabra española: los diptongos (vocal fuerte + débil sin tilde) cuentan una. */
export function countSyllablesEs(word: string): number {
  const w = word.toLowerCase().replace(/[^a-záéíóúüñ]/g, '');
  const runs = w.match(new RegExp(`[${SPANISH_VOWELS}]+`, 'g')) ?? [];
  let syllables = 0;
  for (const run of runs) {
    let count = 1;
    for (let i = 1; i < run.length; i++) {
      const previous = run[i - 1] as string;
      const current = run[i] as string;
      // Hiato: dos vocales fuertes, o una débil con tilde junto a una fuerte.
      if (
        (isStrong(previous) && isStrong(current)) ||
        (isAccentedWeak(previous) && isStrong(current)) ||
        (isStrong(previous) && isAccentedWeak(current))
      ) {
        count++;
      }
    }
    syllables += count;
  }
  return Math.max(1, syllables);
}

/** Legibilidad de Fernández Huerta (el Flesch del español): más alto = más fácil. */
export function fernandezHuerta(words: string[], sentences: number): number {
  if (words.length === 0 || sentences === 0) return 0;
  const syllables = words.reduce((sum, word) => sum + countSyllablesEs(word), 0);
  const value = 206.84 - 60 * (syllables / words.length) - 1.02 * (words.length / sentences);
  return Number(value.toFixed(1));
}
