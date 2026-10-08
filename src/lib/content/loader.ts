import 'server-only';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { cache } from 'react';
import type { z } from 'zod';
import { findLessonMeta } from './index';
import { Lesson, type PublishedListening, type PublishedReading } from './schema';

export type ListeningLesson = z.infer<typeof PublishedListening>;
export type ReadingLesson = z.infer<typeof PublishedReading>;

/**
 * Lee una lección publicada de `content/` (contenido como código, ADR-0003).
 * Solo se cargan rutas que salen del índice generado, nunca de la URL.
 * Devuelve `null` si el id no corresponde a una lección publicada.
 */
export const loadLesson = cache(async (id: string): Promise<Lesson | null> => {
  const meta = findLessonMeta(id);
  if (!meta) return null;

  const file = path.join(process.cwd(), 'content', meta.path);
  const lesson = Lesson.parse(JSON.parse(await readFile(file, 'utf8')));
  if (lesson.status !== 'published') return null;
  return lesson;
});

export async function loadReadingLesson(id: string): Promise<ReadingLesson | null> {
  const lesson = await loadLesson(id);
  return lesson?.skill === 'reading' ? lesson : null;
}

export async function loadListeningLesson(id: string): Promise<ListeningLesson | null> {
  const lesson = await loadLesson(id);
  return lesson?.skill === 'listening' ? lesson : null;
}
