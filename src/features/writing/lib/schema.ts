import { z } from 'zod';
import { CORRECTION_TYPES } from './rules';

// Feedback de un writing (docs/04-arquitectura/06-ia.md §3.1).

export const CRITERIA = [
  'content',
  'communicative_achievement',
  'organisation',
  'language',
] as const;
export type Criterion = (typeof CRITERIA)[number];
export type Scores = Record<Criterion, number>;

export const LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'] as const;
export type Level = (typeof LEVELS)[number];
const SEVERITIES = ['minor', 'major'] as const;

export const MAX_SCORE = 5;
/** Topes que se aplican en código tras recibir la respuesta (la API no admite min/max). */
export const MAX_CORRECTIONS = 6;
export const MAX_UPGRADES = 4;
export const MAX_SRS_CANDIDATES = 3;

/**
 * Esquema que se envía a la API. Sin restricciones numéricas ni de longitud y con todo
 * obligatorio. Las listas cerradas van como texto con sus valores en la descripción: el SDK
 * no las envía como restricción, así que el modelo podría devolver «Grammar» en vez de
 * «grammar» y una validación estricta tiraría toda la corrección. Se ajusta todo después,
 * en `normalizeFeedback`.
 */
export const WritingFeedbackOutput = z.object({
  overall_es: z.string(),
  estimated_level: z.string().describe(`One of: ${LEVELS.join(', ')}`),
  scores: z.object({
    content: z.number().int(), // 0–5
    communicative_achievement: z.number().int(), // 0–5
    organisation: z.number().int(), // 0–5
    language: z.number().int(), // 0–5
  }),
  corrections: z.array(
    z.object({
      original: z.string(), // subcadena exacta del texto
      corrected: z.string(),
      type: z.string().describe(`One of: ${CORRECTION_TYPES.join(', ')}`),
      severity: z.string().describe(`One of: ${SEVERITIES.join(', ')}`),
      explanation_es: z.string(),
      grammar_ref: z.string(), // id de ficha de gramática o ''
    }),
  ),
  corrected_text: z.string(),
  upgrades: z.array(z.object({ from: z.string(), to: z.string(), why_es: z.string() })),
  focus_next_es: z.string(),
  srs_candidates: z.array(z.object({ front: z.string(), back: z.string() })),
});
export type WritingFeedbackOutput = z.infer<typeof WritingFeedbackOutput>;

const StoredScores = z.object({
  content: z.number().int().min(0).max(MAX_SCORE),
  communicative_achievement: z.number().int().min(0).max(MAX_SCORE),
  organisation: z.number().int().min(0).max(MAX_SCORE),
  language: z.number().int().min(0).max(MAX_SCORE),
});

/** El feedback ya ajustado: el que usa la app y el que se guarda. */
export const WritingFeedback = z.object({
  overall_es: z.string(),
  estimated_level: z.enum(LEVELS),
  scores: StoredScores,
  corrections: z
    .array(
      z.object({
        original: z.string().min(1),
        corrected: z.string(),
        type: z.enum(CORRECTION_TYPES),
        severity: z.enum(SEVERITIES),
        explanation_es: z.string(),
        grammar_ref: z.string(),
      }),
    )
    .max(MAX_CORRECTIONS),
  corrected_text: z.string(),
  upgrades: z
    .array(z.object({ from: z.string(), to: z.string(), why_es: z.string() }))
    .max(MAX_UPGRADES),
  focus_next_es: z.string(),
  srs_candidates: z
    .array(z.object({ front: z.string(), back: z.string() }))
    .max(MAX_SRS_CANDIDATES),
});
export type WritingFeedback = z.infer<typeof WritingFeedback>;
export type Correction = WritingFeedback['corrections'][number];

const clamp = (n: number) => Math.max(0, Math.min(MAX_SCORE, Math.round(n)));

export function clampScores(scores: Scores): Scores {
  return {
    content: clamp(scores.content),
    communicative_achievement: clamp(scores.communicative_achievement),
    organisation: clamp(scores.organisation),
    language: clamp(scores.language),
  };
}

/** El valor de una lista cerrada, sin distinguir mayúsculas ni espacios; si no está, `fallback`. */
function oneOf<T extends string>(allowed: readonly T[], value: string, fallback: T): T {
  const wanted = value
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_');
  return allowed.find((option) => option.toLowerCase() === wanted) ?? fallback;
}

/**
 * Ajustes posteriores a la respuesta del modelo (código, no esquema): notas dentro de 0–5,
 * solo correcciones cuyo original aparece literalmente en el texto, los topes de cada lista y
 * los valores de las listas cerradas. Las fichas de gramática que no existen se quitan.
 */
export function normalizeFeedback(
  output: WritingFeedbackOutput,
  text: string,
  options: { targetLevel: Level; grammarIds?: ReadonlySet<string> },
): WritingFeedback {
  const grammarIds = options.grammarIds ?? new Set<string>();
  return {
    overall_es: output.overall_es.trim(),
    estimated_level: oneOf(LEVELS, output.estimated_level, options.targetLevel),
    scores: clampScores(output.scores),
    corrections: output.corrections
      .filter(
        (c) => c.original.trim() !== '' && c.original !== c.corrected && text.includes(c.original),
      )
      .slice(0, MAX_CORRECTIONS)
      .map((c) => ({
        original: c.original,
        corrected: c.corrected,
        type: oneOf(CORRECTION_TYPES, c.type, 'grammar'),
        severity: oneOf(SEVERITIES, c.severity, 'minor'),
        explanation_es: c.explanation_es.trim(),
        grammar_ref: grammarIds.has(c.grammar_ref) ? c.grammar_ref : '',
      })),
    corrected_text: output.corrected_text,
    upgrades: output.upgrades
      .filter((u) => u.from.trim() !== '' && u.to.trim() !== '')
      .slice(0, MAX_UPGRADES),
    focus_next_es: output.focus_next_es.trim(),
    srs_candidates: output.srs_candidates
      .filter((card) => card.front.trim() !== '' && card.back.trim() !== '')
      .slice(0, MAX_SRS_CANDIDATES),
  };
}

// ───────────── Lo que se guarda en `writing_submissions.feedback` ─────────────

/** Corrección de la IA, con la versión del prompt que la produjo. */
const AiStored = WritingFeedback.extend({ prompt_version: z.string() });

/**
 * Revisión sin IA: la autoevaluación del usuario. Los posibles errores no se guardan: se
 * recalculan del texto, que es determinista (ADR-0014).
 */
export const SelfAssessment = z.object({
  kind: z.literal('self'),
  /** Notas que se pone el usuario con la rúbrica, o `null` si aún no lo ha hecho. */
  scores: StoredScores.nullable(),
  /** Puntos de la consigna que el usuario marca como cubiertos, en su orden. */
  points: z.array(z.boolean()).max(4),
});
export type SelfAssessment = z.infer<typeof SelfAssessment>;

export type StoredFeedback =
  | { kind: 'ai'; feedback: WritingFeedback; promptVersion: string }
  | { kind: 'self'; scores: Scores | null; points: boolean[] };

/** Lee el JSON guardado. Devuelve `null` si no hay feedback (envío pendiente o con error). */
export function parseStoredFeedback(value: unknown): StoredFeedback | null {
  const self = SelfAssessment.safeParse(value);
  if (self.success) return { kind: 'self', scores: self.data.scores, points: self.data.points };
  const ai = AiStored.safeParse(value);
  if (ai.success) {
    const { prompt_version: promptVersion, ...feedback } = ai.data;
    return { kind: 'ai', feedback, promptVersion };
  }
  return null;
}

/** Media de los cuatro criterios, de 0 a 5 con un decimal. */
export function overallScore(scores: Scores): number {
  const sum = CRITERIA.reduce((total, criterion) => total + scores[criterion], 0);
  return Math.round((sum / CRITERIA.length) * 10) / 10;
}
