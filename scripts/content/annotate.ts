// pnpm content:annotate --ids b1-lis-001,b1-rea-001   (o --all)
// Tokeniza, lematiza, calcula cobertura, legibilidad y dificultad, y escribe las anotaciones.
import { parseArgs } from 'node:util';
import { annotateLesson } from './lib/annotate-lesson';
import { listLessonFiles, readJson, splitIds, writeContent } from './lib/io';
import { loadWordLists } from './lib/wordlists';

const { values } = parseArgs({
  options: {
    ids: { type: 'string', multiple: true },
    all: { type: 'boolean', default: false },
  },
});

const ids = new Set(splitIds(values.ids));
if (!values.all && ids.size === 0) {
  console.error('Uso: pnpm content:annotate --ids <id>[,<id>…]   |   pnpm content:annotate --all');
  process.exit(2);
}

const files = listLessonFiles().filter((file) => values.all || ids.has(file.id));
const missing = [...ids].filter((id) => !files.some((file) => file.id === id));
if (missing.length > 0) {
  console.error(`No existen estas lecciones en content/lessons: ${missing.join(', ')}`);
  process.exit(2);
}

const lists = loadWordLists();
const now = new Date();
const percent = (value: number) => `${(value * 100).toFixed(1)} %`;
let withIssues = 0;

for (const { file, id } of files) {
  try {
    const { lesson, metrics, issues } = annotateLesson(readJson(file), lists, now);
    writeContent(file, lesson);
    console.log(
      `\n${id}  ${metrics.wordCount} palabras · ${metrics.lemmaCount} lemas · cobertura ${percent(metrics.coverageAtLevel)} · ` +
        `${metrics.avgSentenceWords} pal./frase · Flesch ${metrics.flesch} · dificultad ${metrics.difficulty}`,
    );
    if (metrics.offLevelLemmas.length > 0) {
      console.log(`  fuera de nivel: ${metrics.offLevelLemmas.join(', ')}`);
    }
    for (const issue of issues) console.log(`  ✗ [${issue.check}] ${issue.message}`);
    if (issues.length > 0) withIssues++;
    else console.log('  ✓ supera las comprobaciones deterministas');
  } catch (error) {
    withIssues++;
    console.error(`\n${id}\n  ✗ ${error instanceof Error ? error.message : String(error)}`);
  }
}

console.log(`\n${files.length} lección(es) anotada(s); ${withIssues} con problemas de calidad.`);
process.exit(withIssues > 0 ? 1 : 0);
