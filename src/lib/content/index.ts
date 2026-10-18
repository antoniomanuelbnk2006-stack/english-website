import 'server-only';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { z } from 'zod';
import type { Locale } from '@/lib/i18n';
import { helpText, localize, type Localized } from './help';
import { PREFIXED_LANGUAGES, assertLanguage, inLanguage, type PracticeLanguage } from './language';
import { languagesWithContent } from './language-dirs';
import { LessonMeta as LessonMetaSchema, UnitId } from './schema';

/** Los metadatos tal cual están en el índice, con las ayudas sin resolver. */
export type RawLessonMeta = z.infer<typeof LessonMetaSchema>;
/** Los metadatos con las ayudas en el idioma de la interfaz: `localize(meta, locale)`. */
export type LessonMeta = Localized<RawLessonMeta>;

/**
 * Raíz del contenido (contenido como código, ADR-0003). `CONTENT_DIR` solo se usa para apuntar
 * a contenido de prueba en los tests e2e; en la app es siempre `content/`.
 */
export const CONTENT_ROOT = path.resolve(process.cwd(), process.env.CONTENT_DIR ?? 'content');

function readJson(relative: string): unknown {
  const file = path.join(CONTENT_ROOT, relative);
  if (!existsSync(file)) {
    throw new Error(`Falta ${relative} en el contenido. Ejecuta: pnpm content:index`);
  }
  return JSON.parse(readFileSync(file, 'utf8'));
}

// El índice se genera con `pnpm content:index` y se valida al cargar el módulo: si está
// desfasado respecto al esquema, falla el arranque y no una página suelta.
const lessons: RawLessonMeta[] = z.array(LessonMetaSchema).parse(readJson('index.generated.json'));
const byId = new Map(lessons.map((meta) => [meta.id, meta]));

const Unit = z.object({ id: UnitId, title_es: helpText() });
// Las unidades del currículo de cada idioma: `content/units.json` (inglés) y
// `content/<idioma>/units.json` si ese idioma ya tiene (ADR-0035).
const unitTitles = new Map(
  [
    { language: 'en' as const, file: 'units.json' },
    ...PREFIXED_LANGUAGES.map((language) => ({ language, file: `${language}/units.json` })).filter(
      ({ file }) => existsSync(path.join(CONTENT_ROOT, file)),
    ),
  ].flatMap(({ language, file }) =>
    z
      .array(Unit)
      .parse(readJson(file))
      .map((unit) => {
        assertLanguage(unit.id, language, file);
        return [unit.id, unit.title_es] as const;
      }),
  ),
);

/** Los idiomas que tienen contenido y se pueden elegir para practicar (ADR-0036). */
export const LANGUAGES_WITH_CONTENT: readonly PracticeLanguage[] = languagesWithContent(CONTENT_ROOT);

/** Metadatos de las lecciones publicadas de un idioma (ayudas sin resolver). */
export function getLessonIndex(language: PracticeLanguage): readonly RawLessonMeta[] {
  return inLanguage(lessons, language);
}

export function findLessonMeta(id: string): RawLessonMeta | undefined {
  return byId.get(id);
}

/** Título de la unidad del currículo («Cielo nocturno»), en el idioma de la interfaz; si falta, su identificador. */
export function unitTitle(unitId: string, locale: Locale): string {
  const title = unitTitles.get(unitId);
  return title === undefined ? unitId : localize(title, locale);
}
