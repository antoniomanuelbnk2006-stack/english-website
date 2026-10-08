// pnpm content:index
// Genera content/index.generated.json con los metadatos de las lecciones publicadas.
// La app lo importa para las bibliotecas y el plan diario; nunca se edita a mano.
import type { z } from 'zod';
import { Lesson, LessonMeta } from '../../src/lib/content/schema';
import { INDEX_FILE, listLessonFiles, readJson, writeContent } from './lib/io';
import { countWords } from './lib/nlp';

type Meta = z.infer<typeof LessonMeta>;

const index: Meta[] = [];
const skipped: string[] = [];

for (const { file, relativePath, id } of listLessonFiles()) {
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
    path: `lessons/${relativePath}`,
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
if (skipped.length > 0) console.log(`Sin publicar (no entran en el índice): ${skipped.join(', ')}`);
