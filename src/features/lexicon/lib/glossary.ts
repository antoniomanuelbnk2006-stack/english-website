// Qué entrada del glosario de la lección corresponde a cada palabra del texto. Lógica pura.

export interface GlossaryRef {
  lemma: string;
  /** Tal como aparece en el texto (puede ser más de una palabra: «refuse to die»). */
  surface: string;
  /** Frase o segmento donde aparece. */
  ref: string;
}

export interface TextToken {
  /** Forma superficial. */
  t: string;
  /** Lema. */
  l: string;
  /** ¿Lleva un espacio detrás? */
  sp?: boolean;
}

const isWord = (text: string) => /[\p{L}\p{N}]/u.test(text);

/**
 * Para una frase, el índice de la entrada del glosario de cada token (o nada).
 *
 * Una entrada cubre todas las palabras de su `surface` en la frase a la que apunta, de modo
 * que tocar cualquier palabra de «keep up with» abre la expresión entera. En el resto del
 * texto, una entrada de una sola palabra se reconoce por su lema.
 */
export function glossaryForSentence(
  sentence: { id: string; text: string; tokens: readonly TextToken[] },
  glossary: readonly GlossaryRef[],
): Map<number, number> {
  const found = new Map<number, number>();
  const text = sentence.text.toLowerCase();

  // 1) Entradas que apuntan a esta frase: por posición de su `surface`.
  glossary.forEach((entry, entryIndex) => {
    if (entry.ref !== sentence.id) return;
    const from = text.indexOf(entry.surface.toLowerCase());
    if (from < 0) return;
    const to = from + entry.surface.length;
    let offset = 0;
    sentence.tokens.forEach((token, tokenIndex) => {
      // Los tokens se colocan buscándolos en el texto: así no importa cómo se separaron.
      const start = text.indexOf(token.t.toLowerCase(), offset);
      if (start < 0) return;
      offset = start + token.t.length;
      if (start < to && offset > from && isWord(token.t) && !found.has(tokenIndex)) {
        found.set(tokenIndex, entryIndex);
      }
    });
  });

  // 2) El resto: entradas de una palabra, por lema, aparezcan donde aparezcan.
  const byLemma = new Map<string, number>();
  glossary.forEach((entry, entryIndex) => {
    if (!/\s/.test(entry.lemma) && !byLemma.has(entry.lemma)) byLemma.set(entry.lemma, entryIndex);
  });
  sentence.tokens.forEach((token, tokenIndex) => {
    if (found.has(tokenIndex) || !isWord(token.t)) return;
    const entryIndex = byLemma.get(token.l);
    if (entryIndex !== undefined) found.set(tokenIndex, entryIndex);
  });

  return found;
}
