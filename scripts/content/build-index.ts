// pnpm content:index
// Genera content/index.generated.json con los metadatos de las lecciones publicadas.
// La app lo importa para las bibliotecas y el plan diario; nunca se edita a mano.
import type { z } from 'zod';
import { Lesson, LessonMeta } from '../../src/lib/content/schema';
import path from 'node:path';
import { existsSync, mkdirSync, readdirSync, readFileSync } from 'node:fs';
import { DictionaryFile, lemmaKey } from '../../src/lib/content/dictionary-schema';
import { assertLanguage, PREFIXED_LANGUAGES } from '../../src/lib/content/language';
import { languageRoot } from '../../src/lib/content/language-dirs';
import { CONTENT_DIR, INDEX_FILE, listLessonFiles, readJson, writeContent } from './lib/io';
import { countWords } from './lib/nlp';
import { CEFR, REDUCTIONS, levelOf, loadWordLists, type Cefr } from './lib/wordlists';

type Meta = z.infer<typeof LessonMeta>;

const index: Meta[] = [];
const skipped: string[] = [];

for (const { file, contentPath, id, language } of listLessonFiles()) {
  const raw = readJson(file) as { status?: string };
  if (raw.status !== 'published') {
    skipped.push(`${id} (${raw.status ?? 'sin estado'})`);
    continue;
  }
  const parsed = Lesson.safeParse(raw);
  if (!parsed.success) {
    console.error(`✗ ${id}: publicada pero no cumple el esquema. Ejecuta pnpm content:validate.`);
    process.exit(1);
  }
  const lesson = parsed.data;
  assertLanguage(lesson.id, language, contentPath);

  const base = {
    id: lesson.id,
    version: lesson.version,
    skill: lesson.skill,
    level: lesson.level,
    unit: lesson.unit,
    series: lesson.series,
    title: lesson.title,
    summary_es: lesson.summary_es,
    topic: lesson.topic,
    genre: lesson.genre,
    est_minutes: lesson.est_minutes,
    difficulty: lesson.difficulty,
    lemmas: lesson.lemmas,
    path: contentPath,
  };

  index.push(
    LessonMeta.parse(
      lesson.skill === 'listening'
        ? {
            ...base,
            accents: [...new Set(lesson.speakers.map((speaker) => speaker.accent))],
            duration_s: lesson.audio.duration_s,
            word_count: lesson.segments.reduce((sum, s) => sum + countWords(s.tokens), 0),
            wpm: lesson.audio.wpm,
          }
        : {
            ...base,
            // El acento solo se conoce si el texto tiene audio; el pipeline lo deja en `audio.voices`.
            accents: [],
            duration_s: lesson.audio?.duration_s,
            word_count: lesson.word_count,
            wpm: lesson.audio?.wpm,
          },
    ),
  );
}

index.sort((a, b) => a.id.localeCompare(b.id));
writeContent(INDEX_FILE, index);

console.log(`index.generated.json: ${index.length} lección(es) publicada(s).`);

// Nivel MCER de cada lema, para que la app sepa qué palabras dar por conocidas según tu nivel
// (derivado de las listas con licencia abierta; ver content/wordlists/LICENSES.md).
const lists = loadWordLists();
const byLevel = Object.fromEntries(CEFR.map((level) => [level, [] as string[]])) as Record<
  Cefr,
  string[]
>;
for (const lemma of new Set([...lists.levels.keys(), ...lists.ngslRank.keys(), ...REDUCTIONS])) {
  byLevel[levelOf(lists, lemma, 'NOUN').level].push(lemma);
}
for (const level of CEFR) byLevel[level].sort();
writeContent(path.join(CONTENT_DIR, 'wordlists', 'levels.generated.json'), byLevel);
console.log(
  `levels.generated.json: ${CEFR.map((level) => `${level} ${byLevel[level].length}`).join(' · ')} lemas.`,
);
// Los demás idiomas no tienen listas abiertas de niveles: de momento, el nivel de una palabra es
// el del mazo en el que está (content/<idioma>/dictionary/<nivel>.json).
for (const language of PREFIXED_LANGUAGES) {
  const dir = path.join(languageRoot(CONTENT_DIR, language), 'dictionary');
  if (!existsSync(dir)) continue;
  const levels = Object.fromEntries(CEFR.map((level) => [level, [] as string[]])) as Record<
    Cefr,
    string[]
  >;
  for (const file of readdirSync(dir).filter((name) => name.endsWith('.json'))) {
    const deck = DictionaryFile.parse(JSON.parse(readFileSync(path.join(dir, file), 'utf8')));
    for (const entry of deck.entries) levels[deck.level].push(lemmaKey(entry.lemma));
  }
  for (const level of CEFR) levels[level] = [...new Set(levels[level])].sort();
  mkdirSync(path.join(languageRoot(CONTENT_DIR, language), 'wordlists'), { recursive: true });
  writeContent(path.join(languageRoot(CONTENT_DIR, language), 'wordlists', 'levels.generated.json'), levels);
  console.log(
    `${language}/wordlists/levels.generated.json: ${CEFR.map((level) => `${level} ${levels[level].length}`).join(' · ')} lemas.`,
  );
}
if (skipped.length > 0) console.log(`Sin publicar (no entran en el índice): ${skipped.join(', ')}`);
