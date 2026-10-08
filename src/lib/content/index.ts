import 'server-only';
import { z } from 'zod';
import indexJson from '../../../content/index.generated.json';
import unitsJson from '../../../content/units.json';
import { LessonMeta as LessonMetaSchema, UnitId } from './schema';

export type LessonMeta = z.infer<typeof LessonMetaSchema>;

// El índice se genera con `pnpm content:index` y se valida al cargar el módulo: si está
// desfasado respecto al esquema, falla el arranque y no una página suelta.
const lessons: LessonMeta[] = z.array(LessonMetaSchema).parse(indexJson);
const byId = new Map(lessons.map((meta) => [meta.id, meta]));

const Unit = z.object({ id: UnitId, title_es: z.string().min(1) });
const unitTitles = new Map(z.array(Unit).parse(unitsJson).map((unit) => [unit.id, unit.title_es]));

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
