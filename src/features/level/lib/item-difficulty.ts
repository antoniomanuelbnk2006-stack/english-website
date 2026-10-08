// Dificultad de un ítem en la escala del rating
// (docs/01-pedagogia/08-evaluacion-y-nivel.md §3.2): D = dificultad_lección + ajuste_foco + ajuste_fase.

const FOCUS_ADJUSTMENT: Record<string, number> = {
  gist: -60,
  detail: 0,
  decoding: 0,
  reference: 20,
  vocab_in_context: 20,
  inference: 60,
  purpose_function: 60,
  attitude_opinion: 80,
  text_structure: 80,
};

/** Solo en listening: la primera escucha es más difícil; tras ver el texto, más fácil. */
const PHASE_ADJUSTMENT: Record<string, number> = {
  listen_1: 40,
  listen_2: 0,
  post: -20,
};

export interface ItemDifficultyInput {
  lessonDifficulty: number;
  skill: 'listening' | 'reading';
  focus: string;
  phase: string;
  /** Ajuste manual de la tarea (`difficulty_offset`). */
  offset?: number;
}

export function itemDifficulty({
  lessonDifficulty,
  skill,
  focus,
  phase,
  offset = 0,
}: ItemDifficultyInput): number {
  const focusAdjustment = FOCUS_ADJUSTMENT[focus] ?? 0;
  const phaseAdjustment = skill === 'listening' ? (PHASE_ADJUSTMENT[phase] ?? 0) : 0;
  return lessonDifficulty + focusAdjustment + phaseAdjustment + offset;
}
