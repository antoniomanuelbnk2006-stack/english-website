import model from 'wink-eng-lite-web-model';
import winkNLP, { type ItemToken } from 'wink-nlp';
import type { z } from 'zod';
import type { Token } from '../../../src/lib/content/schema';
import {
  REDUCTIONS,
  baseFormCandidates,
  baseFormIn,
  isKnownToLists,
  type WordLists,
} from './wordlists';

// Tokenización, lemas y categoría gramatical con wink-nlp (docs/05-contenido/01-pipeline.md §3.3).
// El modelo ligero falla en casos conocidos; aquí se corrigen los que afectan a la cobertura.

export type TokenT = z.infer<typeof Token>;

const nlp = winkNLP(model);
const its = nlp.its;

/** No cuentan para la cobertura: puntuación, números, nombres propios, símbolos e interjecciones. */
const UNCOUNTABLE_POS = new Set(['PUNCT', 'NUM', 'PROPN', 'SYM', 'INTJ', 'X', 'SPACE']);
const CONTENT_POS = new Set(['NOUN', 'VERB', 'ADJ', 'ADV']);
const SENTENCE_END = new Set(['.', '!', '?', '…']);

const REDUCTION_POS: Record<string, string> = { kinda: 'ADV', sorta: 'ADV', outta: 'ADP' };

/** Los apóstrofos tipográficos impiden reconocer las contracciones. */
export function normalizeText(text: string): string {
  return text.replace(/[‘’ʼ]/g, "'").replace(/[“”]/g, '"');
}

/**
 * @param lessonLemmas Lemas propios de la lección (glosario y palabras previas): permiten reducir
 *   «modders» o «modding» aunque «modder» y «mod» no estén en ninguna lista.
 */
export function tokenize(
  rawText: string,
  lists: WordLists,
  lessonLemmas: ReadonlySet<string> = new Set(),
): TokenT[] {
  const text = normalizeText(rawText);
  const known = (lemma: string) => isKnownToLists(lists, lemma) || lessonLemmas.has(lemma);
  const baseForm = (word: string) =>
    baseFormIn(lists, word) ?? baseFormCandidates(word).find((c) => lessonLemmas.has(c)) ?? null;
  const raw: { t: string; l: string; p: string; spaced: boolean }[] = [];
  nlp
    .readDoc(text)
    .tokens()
    .each((token: ItemToken) => {
      const surface = token.out();
      // wink toma «no.» por la abreviatura de «number»: al final de frase son «no» y el punto.
      if (/^no\.$/i.test(surface)) {
        const spaced = String(token.out(its.precedingSpaces)).length > 0;
        raw.push({ t: surface.slice(0, 2), l: 'no', p: 'INTJ', spaced });
        raw.push({ t: '.', l: '.', p: 'PUNCT', spaced: false });
        return;
      }
      raw.push({
        t: surface,
        // Los tipos de wink declaran mal `its.lemma` (tres parámetros en vez de cuatro); funciona.
        l: String(token.out(its.lemma as unknown as typeof its.pos)).toLowerCase(),
        p: String(token.out(its.pos)),
        // wink devuelve los espacios anteriores como texto («», « »), no como número.
        spaced: String(token.out(its.precedingSpaces)).length > 0,
      });
    });

  let sentenceStart = true;
  return raw.map((token, index): TokenT => {
    let { l, p } = token;
    const lower = token.t.toLowerCase();
    const hasLetter = /\p{L}/u.test(token.t);

    if (REDUCTIONS.has(lower)) {
      l = lower;
      p = REDUCTION_POS[lower] ?? 'AUX';
    } else if (p === 'PROPN' && sentenceStart) {
      // «Perfect.» u «Others are…»: la mayúscula inicial engaña al etiquetador.
      const base = baseForm(lower);
      if (base) {
        l = base;
        p = lists.pos.get(base) ?? 'NOUN';
      }
    } else if (CONTENT_POS.has(p) && !known(l)) {
      // Palabras que el lematizador deja sin reducir: «modders», «raining».
      l = baseForm(l) ?? l;
    }

    if (hasLetter || p === 'NUM') sentenceStart = false;
    if (SENTENCE_END.has(token.t)) sentenceStart = true;

    const next = raw[index + 1];
    // El posesivo «'s» no es una palabra: no cuenta para la cobertura.
    const countable = hasLetter && !UNCOUNTABLE_POS.has(p) && !l.startsWith("'");
    const out: TokenT = { t: token.t, l, p, w: countable };
    if (next?.spaced) out.sp = true;
    return out;
  });
}

/** Reconstruye el texto a partir de los tokens (para comprobar que no se ha perdido nada). */
export function detokenize(tokens: TokenT[]): string {
  return tokens.map((token) => token.t + (token.sp ? ' ' : '')).join('');
}

/** Palabras «de verdad» de un texto: todo lo que no es puntuación ni símbolo. */
export function countWords(tokens: TokenT[]): number {
  return tokens.filter((token) => /[\p{L}\p{N}]/u.test(token.t) && !isClitic(token.t)).length;
}

/** «'ll», «n't», «'s»: forman una sola palabra con la anterior. */
function isClitic(text: string): boolean {
  return /^(?:n't|'(?:ll|ve|re|m|d|s))$/i.test(text);
}

export function countSentences(tokens: TokenT[]): number {
  let sentences = 0;
  let open = false;
  for (const token of tokens) {
    if (SENTENCE_END.has(token.t)) {
      if (open) sentences++;
      open = false;
    } else if (/[\p{L}\p{N}]/u.test(token.t)) {
      open = true;
    }
  }
  return sentences + (open ? 1 : 0);
}
