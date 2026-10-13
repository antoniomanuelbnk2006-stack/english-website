import { segment, type Span } from '@/features/writing/lib/highlight';

/**
 * Un texto en inglés con los tramos corregidos resaltados y numerados (el número enlaza, a la
 * vista, con la lista de correcciones). Conserva los saltos de párrafo tal como se escribieron.
 */
export function MarkedText({ text, spans }: { text: string; spans: readonly (Span | null)[] }) {
  return (
    <p lang="en" className="prose-reading whitespace-pre-wrap">
      {segment(text, spans).map((piece, position) =>
        piece.index === null ? (
          piece.text
        ) : (
          <mark key={position} className="rounded-structure bg-accent/30 px-0.5 text-text">
            {piece.text}
            <sup className="tabular-nums ml-0.5 text-caption text-accent-text">
              {piece.index + 1}
            </sup>
          </mark>
        ),
      )}
    </p>
  );
}
