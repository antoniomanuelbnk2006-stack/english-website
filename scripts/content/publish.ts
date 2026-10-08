// pnpm content:publish --ids b1-lis-002[,…] [--by "<quién revisa>"]
// Marca como publicadas lecciones ya revisadas: `status: "published"` y `provenance.reviewed_by`.
// No comprueba nada por sí mismo: después hay que pasar `content:validate` y `content:index`
// (la validación es la que bloquea si la lección no cumple).
import { parseArgs } from 'node:util';
import { listLessonFiles, readJson, splitIds, writeContent } from './lib/io';

function main(): number {
  const { values } = parseArgs({
    options: { ids: { type: 'string', multiple: true }, by: { type: 'string' } },
  });
  const ids = new Set(splitIds(values.ids));
  if (ids.size === 0) {
    console.error('Uso: pnpm content:publish --ids <id>[,<id>…] [--by "<quién revisa>"]');
    return 2;
  }
  const files = listLessonFiles().filter((file) => ids.has(file.id));
  const missing = [...ids].filter((id) => !files.some((file) => file.id === id));
  if (missing.length > 0) {
    console.error(`No existen estas lecciones: ${missing.join(', ')}`);
    return 2;
  }

  const reviewer = values.by ?? 'claude (revisión manual; pendiente de la revisión del dueño)';
  for (const { file, id } of files) {
    const lesson = readJson(file) as { status?: string; provenance?: Record<string, unknown> };
    if (lesson.status === 'published') {
      console.log(`${id}: ya estaba publicada.`);
      continue;
    }
    lesson.status = 'published';
    lesson.provenance = { ...lesson.provenance, reviewed_by: reviewer };
    writeContent(file, lesson);
    console.log(`${id}: publicada (revisada por: ${reviewer}).`);
  }
  console.log('\nAhora: pnpm content:validate --offline && pnpm content:index');
  return 0;
}

process.exit(main());
