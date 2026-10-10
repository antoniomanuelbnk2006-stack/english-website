import type { PartFormat } from '@/lib/content/exam-formats';
import type { PublicExamPart, PublicRecording } from '@/lib/content/exam-schema';

// La prueba de Listening es una sola cinta: tiempo para leer las preguntas, cada grabación dos
// veces, una pausa y, al final, unos minutos para revisar. Aquí se monta esa secuencia a partir
// de las grabaciones y del formato del examen. Lógica pura.

/** Segundos entre la primera y la segunda escucha de una grabación. */
export const REPEAT_GAP_S = 4;
/** Segundos tras la segunda escucha, antes de lo siguiente. */
export const AFTER_GAP_S = 6;

export type ListeningStep =
  /** Tiempo para leer las preguntas. */
  | { kind: 'prep'; part: number; seconds: number }
  | { kind: 'play'; part: number; recording: PublicRecording; pass: 1 | 2; seconds: number }
  | { kind: 'pause'; part: number; seconds: number }
  /** Tiempo final para revisar las respuestas. */
  | { kind: 'review'; part: number; seconds: number };

export function recordingsOf(part: PublicExamPart): PublicRecording[] {
  if (part.type === 'mcq') return part.groups.flatMap((group) => group.recording ?? []);
  if (part.type === 'matching') return part.recording ? [part.recording] : [];
  if (part.type === 'completion') return [part.recording];
  return [];
}

export function buildSchedule(
  parts: readonly PublicExamPart[],
  formats: readonly PartFormat[],
  reviewS: number,
): ListeningStep[] {
  const steps: ListeningStep[] = [];
  parts.forEach((part, index) => {
    const format = formats[index];
    const number = index + 1;
    if (format?.prepS) steps.push({ kind: 'prep', part: number, seconds: format.prepS });
    for (const recording of recordingsOf(part)) {
      if (format?.groupPrepS) {
        steps.push({ kind: 'prep', part: number, seconds: format.groupPrepS });
      }
      const seconds = recording.duration_s;
      steps.push({ kind: 'play', part: number, recording, pass: 1, seconds });
      steps.push({ kind: 'pause', part: number, seconds: REPEAT_GAP_S });
      steps.push({ kind: 'play', part: number, recording, pass: 2, seconds });
      steps.push({ kind: 'pause', part: number, seconds: AFTER_GAP_S });
    }
  });
  steps.push({ kind: 'review', part: parts.length, seconds: reviewS });
  return steps;
}

export function scheduleSeconds(steps: readonly ListeningStep[]): number {
  return steps.reduce((total, step) => total + step.seconds, 0);
}

/** Segundos que quedan de prueba al empezar el paso `index`, más lo que quede de ese paso. */
export function remainingSeconds(
  steps: readonly ListeningStep[],
  index: number,
  leftInStep: number,
): number {
  return scheduleSeconds(steps.slice(index + 1)) + Math.max(0, leftInStep);
}
