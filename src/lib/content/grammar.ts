import 'server-only';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { cache } from 'react';
import { parseFicha, type GrammarMeta, type ParsedFicha } from './grammar-schema';
import { CONTENT_ROOT, getLessonIndex } from './index';

// Fichas de gramática y su relación con las lecciones. El contenido no cambia mientras el
// servidor está en marcha, así que se lee una vez y se guarda en memoria.

const GRAMMAR_ROOT = path.join(CONTENT_ROOT, 'grammar');

let fichas: Map<string, ParsedFicha> | null = null;

function loadAll(): Map<string, ParsedFicha> {
  if (fichas) return fichas;
  const all = new Map<string, ParsedFicha>();
  if (existsSync(GRAMMAR_ROOT)) {
    for (const level of readdirSync(GRAMMAR_ROOT)) {
      const dir = path.join(GRAMMAR_ROOT, level);
      for (const file of readdirSync(dir).filter((name) => name.endsWith('.mdx'))) {
        const ficha = parseFicha(readFileSync(path.join(dir, file), 'utf8'));
        all.set(ficha.meta.id, ficha);
      }
    }
  }
  fichas = all;
  return all;
}

/** Todas las fichas, por nivel y título. */
export function getGrammarIndex(): GrammarMeta[] {
  return [...loadAll().values()]
    .map((ficha) => ficha.meta)
    .sort((a, b) => a.level.localeCompare(b.level) || a.title.localeCompare(b.title));
}

export function findFicha(id: string): ParsedFicha | null {
  return loadAll().get(id) ?? null;
}

let focusByLesson: Map<string, string[]> | null = null;

/** `grammar_focus` de cada lección publicada (no va en el índice: se lee de cada lección). */
function grammarFocus(): Map<string, string[]> {
  if (focusByLesson) return focusByLesson;
  const map = new Map<string, string[]>();
  for (const meta of getLessonIndex()) {
    const raw = JSON.parse(readFileSync(path.join(CONTENT_ROOT, meta.path), 'utf8')) as {
      grammar_focus?: unknown;
    };
    const focus = Array.isArray(raw.grammar_focus)
      ? raw.grammar_focus.filter((id): id is string => typeof id === 'string')
      : [];
    map.set(meta.id, focus);
  }
  focusByLesson = map;
  return map;
}

/** Lecciones publicadas donde aparece la estructura de una ficha. */
export function lessonsWithGrammar(grammarId: string) {
  const focus = grammarFocus();
  return getLessonIndex().filter((meta) => focus.get(meta.id)?.includes(grammarId));
}

/** Fichas existentes enlazadas desde una lección. */
export function fichasOfLesson(lessonId: string): { id: string; title: string }[] {
  return (grammarFocus().get(lessonId) ?? []).flatMap((id) => {
    const ficha = findFicha(id);
    return ficha ? [{ id, title: ficha.meta.title }] : [];
  });
}

/** Compila el cuerpo MDX de una ficha a un componente de React (en el servidor). */
export const compileFicha = cache(async (id: string) => {
  const ficha = findFicha(id);
  if (!ficha) return null;
  const [{ evaluate }, runtime, { default: remarkGfm }] = await Promise.all([
    import('@mdx-js/mdx'),
    import('react/jsx-runtime'),
    import('remark-gfm'),
  ]);
  const { default: Content } = await evaluate(ficha.body, {
    ...runtime,
    remarkPlugins: [remarkGfm],
  });
  return Content;
});
