import 'server-only';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { CONTENT_ROOT, type LessonMeta } from './index';

// Recuento de palabras de cada lección, para calcular la cobertura («para ti: 96 %») de toda
// una biblioteca sin cargar y validar cada lección en cada petición. El contenido no cambia
// mientras el servidor está en marcha: cada fichero se lee una sola vez.

export interface TokenCount {
  /** Lema. */
  l: string;
  /** Categoría gramatical. */
  p: string;
  /** Siempre `true`: aquí solo se guardan los tokens contables. */
  w: true;
  /** Veces que aparece en el texto. */
  n: number;
}

interface RawToken {
  l?: unknown;
  p?: unknown;
  w?: unknown;
}

interface RawLesson {
  segments?: { tokens?: RawToken[] }[];
  paragraphs?: { sentences?: { tokens?: RawToken[] }[] }[];
}

const cache = new Map<string, TokenCount[]>();

/** Tokens contables de una lección publicada, agrupados por lema y categoría. */
export function lessonTokenCounts(meta: Pick<LessonMeta, 'id' | 'version' | 'path'>): TokenCount[] {
  const key = `${meta.id}@${meta.version}`;
  const cached = cache.get(key);
  if (cached) return cached;

  const raw = JSON.parse(readFileSync(path.join(CONTENT_ROOT, meta.path), 'utf8')) as RawLesson;
  const tokens = [
    ...(raw.segments ?? []).flatMap((segment) => segment.tokens ?? []),
    ...(raw.paragraphs ?? []).flatMap((paragraph) =>
      (paragraph.sentences ?? []).flatMap((sentence) => sentence.tokens ?? []),
    ),
  ];

  const counts = new Map<string, TokenCount>();
  for (const token of tokens) {
    if (token.w !== true || typeof token.l !== 'string' || typeof token.p !== 'string') continue;
    const id = `${token.l}\u0000${token.p}`;
    const current = counts.get(id);
    if (current) current.n++;
    else counts.set(id, { l: token.l, p: token.p, w: true, n: 1 });
  }

  const result = [...counts.values()];
  cache.set(key, result);
  return result;
}
