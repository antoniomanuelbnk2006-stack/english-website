import 'server-only';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { z } from 'zod';
import { LessonMeta as LessonMetaSchema, UnitId } from './schema';

export type LessonMeta = z.infer<typeof LessonMetaSchema>;

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
const lessons: LessonMeta[] = z.array(LessonMetaSchema).parse(readJson('index.generated.json'));
const byId = new Map(lessons.map((meta) => [meta.id, meta]));

const Unit = z.object({ id: UnitId, title_es: z.string().min(1) });
const unitTitles = new Map(
  z
    .array(Unit)
    .parse(readJson('units.json'))
    .map((unit) => [unit.id, unit.title_es]),
);

/** Metadatos de todas las lecciones publicadas. */
export function getLessonIndex(): readonly LessonMeta[] {
  return lessons;
}

export function findLessonMeta(id: string): LessonMeta | undefined {
  return byId.get(id);
}

/** Título de la unidad del currículo («Cielo nocturno»); si falta, su identificador. */
export function unitTitle(unitId: string): string {
  return unitTitles.get(unitId) ?? unitId;
}
