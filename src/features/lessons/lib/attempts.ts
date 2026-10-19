import { z } from 'zod';
import { itemDifficulty } from '@/features/level/lib/item-difficulty';
import { TaskResponse, grade } from '@/features/tasks/lib/grade';
import { languageOfId } from '@/lib/content/language';
import { LessonId, TaskId, type Lesson } from '@/lib/content/schema';

// Preparación de los intentos de una lección para guardarlos. Lógica pura: el servidor vuelve
// a corregir cada respuesta con las claves de la lección y calcula la dificultad de cada ítem.

export const AttemptInput = z.object({
  itemId: TaskId,
  response: TaskResponse,
  durationMs: z.number().int().min(0).max(3_600_000).optional(),
  /** UUID generado en el cliente: reintentar el envío no duplica el intento. */
  clientId: z.uuid(),
  createdAt: z.iso.datetime().optional(),
});
export type AttemptInput = z.infer<typeof AttemptInput>;

export const SubmitAttemptsInput = z.object({
  lessonId: LessonId,
  lessonVersion: z.number().int().positive(),
  attempts: z.array(AttemptInput).max(60),
  progress: z.object({
    /** Fase del ciclo alcanzada (se guarda la mayor). */
    phase: z.number().int().min(0).max(9),
    completed: z.boolean(),
    /** Segundos activos desde el envío anterior. */
    activeSeconds: z
      .number()
      .int()
      .min(0)
      .max(4 * 3600),
    readingWpm: z.number().min(40).max(700).optional(),
  }),
});
export type SubmitAttemptsInput = z.infer<typeof SubmitAttemptsInput>;

/** Fila de `item_attempts` tal como la espera la función SQL `apply_lesson_attempts`. */
export interface AttemptRow {
  item_id: string;
  skill: 'listening' | 'reading';
  task_type: string;
  focus: string;
  phase: string;
  item_difficulty: number;
  rating_before: number;
  score: number;
  response: TaskResponse;
  duration_ms: number | null;
  client_id: string;
  created_at: string | null;
}

export interface PreparedAttempts {
  rows: AttemptRow[];
  /** Ids de tareas que no existen en la lección (envío corrupto o lección cambiada). */
  unknownItems: string[];
}

export function prepareAttempts(
  lesson: Lesson,
  attempts: readonly AttemptInput[],
  ratingBefore: number,
): PreparedAttempts {
  const tasks = new Map(lesson.tasks.map((task) => [task.id, task]));
  const rows: AttemptRow[] = [];
  const unknownItems: string[] = [];

  for (const attempt of attempts) {
    const task = tasks.get(attempt.itemId);
    if (!task) {
      unknownItems.push(attempt.itemId);
      continue;
    }
    rows.push({
      item_id: `${lesson.id}:${task.id}`,
      skill: lesson.skill,
      task_type: task.type,
      focus: task.focus,
      phase: task.phase,
      item_difficulty: itemDifficulty({
        lessonDifficulty: lesson.difficulty,
        skill: lesson.skill,
        focus: task.focus,
        phase: task.phase,
        offset: task.difficulty_offset,
      }),
      rating_before: ratingBefore,
      // La nota es la del servidor, no la que diga el cliente.
      score: grade(task, attempt.response, languageOfId(lesson.id)).score,
      response: attempt.response,
      duration_ms: attempt.durationMs ?? null,
      client_id: attempt.clientId,
      created_at: attempt.createdAt ?? null,
    });
  }
  return { rows, unknownItems };
}

/**
 * Nota de la lección (0–1): media de la última respuesta a cada tarea.
 * `scores` va de más antigua a más reciente; `null` si no hay ninguna respuesta.
 */
export function lessonScore(scores: readonly { itemId: string; score: number }[]): number | null {
  const latest = new Map<string, number>();
  for (const { itemId, score } of scores) latest.set(itemId, score);
  if (latest.size === 0) return null;
  const total = [...latest.values()].reduce((sum, score) => sum + score, 0);
  return Number((total / latest.size).toFixed(4));
}
