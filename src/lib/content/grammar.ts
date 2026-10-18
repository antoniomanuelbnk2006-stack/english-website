import 'server-only';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { cache } from 'react';
import { FALLBACK_LOCALE, type Locale } from '@/lib/i18n';
import {
  fichaVariant,
  parseFicha,
  type GrammarMeta,
  type ParsedFicha,
} from './grammar-schema';
import { localize, type Localized } from './help';
import {
  assertLanguage,
  inLanguage,
  languageOfId,
  PRACTICE_LANGUAGES,
  type PracticeLanguage,
} from './language';
import { listLevelFiles } from './language-dirs';
import { CONTENT_ROOT, getLessonIndex } from './index';

// Fichas de gramática y su relación con las lecciones. El contenido no cambia mientras el
// servidor está en marcha, así que se lee una vez y se guarda en memoria.

/** Una ficha con las ayudas del frontmatter en el idioma de la interfaz. */
export type Ficha = Localized<ParsedFicha>;

// Se guardan tal cual (con las ayudas sin resolver); cada acceso las resuelve al idioma pedido.
let fichas: Map<string, ParsedFicha> | null = null;
/** El cuerpo de cada ficha en otros idiomas de interfaz: `<id>.<idioma>.mdx`. */
let variants: Map<string, Partial<Record<Locale, string>>> | null = null;

function loadAll(): Map<string, ParsedFicha> {
  if (fichas) return fichas;
  const all = new Map<string, ParsedFicha>();
  const bodies = new Map<string, Partial<Record<Locale, string>>>();
  // Todos los idiomas: `content/grammar/` y `content/<idioma>/grammar/` (ADR-0035).
  for (const file of listLevelFiles(CONTENT_ROOT, 'grammar', '.mdx')) {
    const variant = fichaVariant(file.id);
    if (variant) {
      bodies.set(variant.id, { ...bodies.get(variant.id), [variant.locale]: readFileSync(file.path, 'utf8') });
      continue;
    }
    const ficha = parseFicha(readFileSync(file.path, 'utf8'));
    assertLanguage(ficha.meta.id, file.language, file.path);
    all.set(ficha.meta.id, ficha);
  }
  for (const id of bodies.keys()) {
    if (!all.has(id)) throw new Error(`gramática: hay versiones en otros idiomas de «${id}», pero no la ficha`);
  }
  fichas = all;
  variants = bodies;
  return all;
}

/**
 * El cuerpo que se enseña: el del idioma de la interfaz si existe; si no, el de inglés; y si
 * tampoco, el del archivo de la ficha (las fichas de inglés, en español).
 */
function bodyFor(id: string, ficha: ParsedFicha, locale: Locale): string {
  const bodies: Partial<Record<Locale, string>> = {
    ...variants?.get(id),
    [ficha.meta.body_locale]: ficha.body,
  };
  return bodies[locale] ?? bodies[FALLBACK_LOCALE] ?? ficha.body;
}

/** Las fichas de un idioma, por nivel y título, con las ayudas en `locale`. */
export function getGrammarIndex(locale: Locale, language: PracticeLanguage): GrammarMeta[] {
  return inLanguage([...loadAll().values()].map((ficha) => ficha.meta), language)
    .map((meta) => localize(meta, locale))
    .sort((a, b) => a.level.localeCompare(b.level) || a.title.localeCompare(b.title));
}

export function findFicha(id: string, locale: Locale): Ficha | null {
  const ficha = loadAll().get(id);
  return ficha ? localize(ficha, locale) : null;
}

let focusByLesson: Map<string, string[]> | null = null;

/** `grammar_focus` de cada lección publicada (no va en el índice: se lee de cada lección). */
function grammarFocus(): Map<string, string[]> {
  if (focusByLesson) return focusByLesson;
  const map = new Map<string, string[]>();
  for (const meta of PRACTICE_LANGUAGES.flatMap((language) => getLessonIndex(language))) {
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
  // Una ficha solo se enseña en lecciones de su idioma.
  return getLessonIndex(languageOfId(grammarId)).filter((meta) =>
    focus.get(meta.id)?.includes(grammarId),
  );
}

/** Fichas existentes enlazadas desde una lección. */
export function fichasOfLesson(lessonId: string): { id: string; title: string }[] {
  return (grammarFocus().get(lessonId) ?? []).flatMap((id) => {
    const ficha = loadAll().get(id);
    return ficha ? [{ id, title: ficha.meta.title }] : [];
  });
}

/** Compila el cuerpo MDX de una ficha, en el idioma de la interfaz, a un componente de React (en el servidor). */
export const compileFicha = cache(async (id: string, locale: Locale) => {
  const ficha = loadAll().get(id);
  if (!ficha) return null;
  const body = bodyFor(id, ficha, locale);
  const [{ evaluate }, runtime, { default: remarkGfm }] = await Promise.all([
    import('@mdx-js/mdx'),
    import('react/jsx-runtime'),
    import('remark-gfm'),
  ]);
  const { default: Content } = await evaluate(body, {
    ...runtime,
    remarkPlugins: [remarkGfm],
  });
  return Content;
});
