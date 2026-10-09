// Resaltar en el texto los tramos a los que se refiere cada corrección.

export interface Span {
  start: number;
  end: number;
}

/**
 * Dónde está cada fragmento en el texto. Cada uno ocupa un sitio distinto: si un fragmento
 * aparece dos veces y hay dos correcciones iguales, la segunda señala la segunda aparición.
 * `null` si no se encuentra o si pisa a uno anterior.
 */
export function locate(text: string, fragments: readonly string[]): (Span | null)[] {
  const taken: Span[] = [];
  return fragments.map((fragment) => {
    if (fragment === '') return null;
    let from = 0;
    for (;;) {
      const start = text.indexOf(fragment, from);
      if (start === -1) return null;
      const span = { start, end: start + fragment.length };
      if (taken.every((other) => span.end <= other.start || span.start >= other.end)) {
        taken.push(span);
        return span;
      }
      from = start + 1;
    }
  });
}

export interface Piece {
  text: string;
  /** Posición, en la lista de tramos, del que cubre este trozo; `null` si es texto normal. */
  index: number | null;
}

/** Parte el texto en trozos normales y resaltados, en orden. Los tramos que se pisan se ignoran. */
export function segment(text: string, spans: readonly (Span | null)[]): Piece[] {
  const ordered = spans
    .map((span, index) => ({ span, index }))
    .filter((item): item is { span: Span; index: number } => item.span !== null)
    .sort((a, b) => a.span.start - b.span.start);

  const pieces: Piece[] = [];
  let cursor = 0;
  for (const { span, index } of ordered) {
    if (span.start < cursor || span.end > text.length || span.end <= span.start) continue;
    if (span.start > cursor) pieces.push({ text: text.slice(cursor, span.start), index: null });
    pieces.push({ text: text.slice(span.start, span.end), index });
    cursor = span.end;
  }
  if (cursor < text.length) pieces.push({ text: text.slice(cursor), index: null });
  return pieces;
}
