import { z } from 'zod';
import { WritingId } from '@/lib/content/writing-schema';
import { MAX_SCORE } from './schema';

// Lo que llega del navegador al entregar un writing. Lo comparten la acción de la revisión
// sin IA y el Route Handler de la corrección con IA.

/** Menos que esto no es un texto que revisar. */
export const MIN_CHARS = 20;
/** El mismo tope que la columna `writing_submissions.text`. */
export const MAX_CHARS = 6000;

const Text = z.string().trim().min(MIN_CHARS).max(MAX_CHARS);

export const SubmissionInput = z.object({
  promptId: WritingId,
  text: Text,
  /** Se escribió en modo examen (con tiempo y sin ayudas). */
  examMode: z.boolean().default(false),
  /** Tiempo activo escribiendo, medido en el navegador. */
  activeSeconds: z
    .number()
    .int()
    .min(0)
    .max(4 * 3600)
    .default(0),
});
export type SubmissionInput = z.infer<typeof SubmissionInput>;

const Score = z.number().int().min(0).max(MAX_SCORE);

export const SelfAssessmentInput = z.object({
  submissionId: z.uuid(),
  scores: z
    .object({
      content: Score,
      communicative_achievement: Score,
      organisation: Score,
      language: Score,
    })
    .nullable(),
  points: z.array(z.boolean()).max(4),
});

export const RewriteInput = z.object({ submissionId: z.uuid(), text: Text });

export const CardsInput = z.object({
  submissionId: z.uuid(),
  /** Posiciones, dentro de las tarjetas propuestas, de las que se quieren añadir. */
  items: z.array(z.number().int().min(0).max(9)).min(1).max(5),
});
