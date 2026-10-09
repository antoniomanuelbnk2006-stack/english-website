import { z } from 'zod';
import { Cefr, Topic } from './schema';

// Consignas de writing por nivel (docs/01-pedagogia/07-writing-y-speaking.md §2).
// Viven en `content/writing/{nivel}/{id}.json`. Textos originales, con el formato de las
// tareas de los exámenes pero sin copiar ninguna.

export const WritingId = z.string().regex(/^(a1|a2|b1|b2|c1|c2)-wri-\d{3}$/);

export const WRITING_TASK_TYPES = [
  'message',
  'email',
  'story',
  'review',
  'article',
  'essay',
  'report',
  'proposal',
] as const;
export const WritingTaskType = z.enum(WRITING_TASK_TYPES);
export type WritingTaskType = z.infer<typeof WritingTaskType>;

type Level = z.infer<typeof Cefr>;

/** Longitud de los textos de cada nivel (07-writing §2.1). */
export const WRITING_WORDS: Record<Level, { min: number; max: number }> = {
  A1: { min: 25, max: 50 },
  A2: { min: 35, max: 80 },
  B1: { min: 100, max: 150 },
  B2: { min: 140, max: 250 },
  C1: { min: 220, max: 320 },
  C2: { min: 280, max: 400 },
};

/** Tipos de texto que se trabajan en cada nivel (07-writing §2.1). */
export const WRITING_TYPES_BY_LEVEL: Record<Level, readonly WritingTaskType[]> = {
  A1: ['message'],
  A2: ['email', 'message', 'article'],
  B1: ['email', 'story', 'article'],
  B2: ['essay', 'review', 'article', 'report', 'email'],
  C1: ['essay', 'proposal', 'report', 'email', 'review'],
  C2: ['essay', 'article', 'review', 'report'],
};

export const WritingPrompt = z.object({
  id: WritingId,
  version: z.number().int().positive(),
  status: z.enum(['draft', 'published']),
  level: Cefr,
  task_type: WritingTaskType,
  /** Título corto de la tarea, en inglés. */
  title: z.string().min(1),
  topic: Topic,
  /** La situación, en español: quién escribe, a quién y para qué. */
  context_es: z.string().min(1),
  /** La consigna, en inglés, tal como aparecería en un examen. */
  prompt_en: z.string().min(1),
  /** Lo que el texto tiene que cubrir. */
  points: z.array(z.string().min(1)).min(2).max(4),
  words_min: z.number().int().positive(),
  words_max: z.number().int().positive(),
  /** Minutos del modo examen. */
  time_min: z.number().int().min(5).max(90),
  /** Expresiones que encajan en este tipo de texto. */
  useful_language: z.array(z.string().min(1)).min(3).max(10),
  /** Consejos de formato y registro, en español. */
  tips_es: z.array(z.string().min(1)).min(1).max(4),
  /** Una respuesta posible. Solo se enseña después de entregar la tuya. */
  model_answer: z.string().min(1),
  provenance: z.object({
    origin: z.enum(['human', 'ai']),
    model: z.string().optional(),
    created_at: z.string(),
    reviewed_by: z.string().optional(),
  }),
});
export type WritingPrompt = z.infer<typeof WritingPrompt>;

/** Lo que ve el navegador antes de entregar: todo menos la respuesta modelo. */
export type PublicWritingPrompt = Omit<WritingPrompt, 'model_answer' | 'provenance' | 'status'>;

export function toPublicPrompt(prompt: WritingPrompt): PublicWritingPrompt {
  return {
    id: prompt.id,
    version: prompt.version,
    level: prompt.level,
    task_type: prompt.task_type,
    title: prompt.title,
    topic: prompt.topic,
    context_es: prompt.context_es,
    prompt_en: prompt.prompt_en,
    points: prompt.points,
    words_min: prompt.words_min,
    words_max: prompt.words_max,
    time_min: prompt.time_min,
    useful_language: prompt.useful_language,
    tips_es: prompt.tips_es,
  };
}

/**
 * Palabras de un texto como se cuentan en un examen: lo que va entre espacios. Una
 * contracción o una palabra con guion valen por una; los signos sueltos no cuentan.
 */
export function countWords(text: string): number {
  return text.split(/\s+/).filter((token) => /[\p{L}\p{N}]/u.test(token)).length;
}

/** Párrafos del texto: bloques separados por una línea en blanco o un salto de línea. */
export function splitParagraphs(text: string): string[] {
  return text
    .split(/\n+/)
    .map((block) => block.trim())
    .filter((block) => block !== '');
}

/** Comprobaciones que el esquema no puede expresar. Devuelve los problemas encontrados. */
export function checkWritingPrompt(
  prompt: WritingPrompt,
  expected: { id: string; level: string },
): string[] {
  const issues: string[] = [];
  const level = prompt.level.toLowerCase();
  if (prompt.id !== expected.id) issues.push(`el id «${prompt.id}» no coincide con el fichero`);
  if (level !== expected.level) {
    issues.push(`el nivel ${prompt.level} no coincide con la carpeta ${expected.level}`);
  }
  if (!prompt.id.startsWith(`${level}-`)) issues.push(`el id debe empezar por «${level}-»`);

  if (!WRITING_TYPES_BY_LEVEL[prompt.level].includes(prompt.task_type)) {
    issues.push(`el tipo «${prompt.task_type}» no se trabaja en ${prompt.level}`);
  }

  const range = WRITING_WORDS[prompt.level];
  if (prompt.words_min >= prompt.words_max) issues.push('words_min debe ser menor que words_max');
  if (prompt.words_min < range.min || prompt.words_max > range.max) {
    issues.push(
      `la longitud ${prompt.words_min}–${prompt.words_max} se sale de la de ${prompt.level} (${range.min}–${range.max})`,
    );
  }

  const words = countWords(prompt.model_answer);
  if (words < prompt.words_min || words > prompt.words_max) {
    issues.push(
      `la respuesta modelo tiene ${words} palabras (la consigna pide ${prompt.words_min}–${prompt.words_max})`,
    );
  }

  const same = (list: readonly string[]) =>
    new Set(list.map((item) => item.trim().toLowerCase())).size !== list.length;
  if (same(prompt.points)) issues.push('hay puntos repetidos');
  if (same(prompt.useful_language)) issues.push('hay expresiones útiles repetidas');
  return issues;
}
