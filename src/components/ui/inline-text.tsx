import { Fragment } from 'react';

export interface InlinePart {
  text: string;
  /** Término marcado con *asteriscos* en el contenido: casi siempre una palabra en inglés. */
  term: boolean;
}

/**
 * Las explicaciones del contenido (`rationale_es`, `explanation_es`, `note_es`) marcan los
 * términos en inglés con *asteriscos*. Devuelve los tramos para pintarlos sin los asteriscos.
 */
export function parseInline(text: string): InlinePart[] {
  const parts: InlinePart[] = [];
  for (const piece of text.split(/(\*[^*\n]+\*)/)) {
    if (piece === '') continue;
    const term = piece.length > 2 && piece.startsWith('*') && piece.endsWith('*');
    parts.push({ text: term ? piece.slice(1, -1) : piece, term });
  }
  return parts;
}

/** Texto en español con los términos en inglés en cursiva y marcados con `lang="en"`. */
export function InlineText({ text }: { text: string }) {
  return (
    <>
      {parseInline(text).map((part, index) =>
        part.term ? (
          <em key={index} lang="en" className="text-text">
            {part.text}
          </em>
        ) : (
          <Fragment key={index}>{part.text}</Fragment>
        ),
      )}
    </>
  );
}
