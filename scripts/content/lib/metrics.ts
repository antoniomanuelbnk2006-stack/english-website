import { CEFR, type Cefr } from './wordlists';

// Métricas deterministas del contenido (docs/05-contenido/02-control-de-calidad.md §2 y §5). Lógica pura.

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const round = (value: number, digits: number) => Number(value.toFixed(digits));

export interface LeveledToken {
  lemma: string;
  level: Cefr;
}

/** Fracción acumulada de tokens contables de nivel ≤ X, para cada nivel. */
export function coverageByLevel(tokens: LeveledToken[]): Record<Cefr, number> {
  const total = tokens.length;
  const coverage = {} as Record<Cefr, number>;
  let accumulated = 0;
  for (const level of CEFR) {
    accumulated += tokens.filter((t) => t.level === level).length;
    coverage[level] = total === 0 ? 1 : round(accumulated / total, 4);
  }
  return coverage;
}

/** Lemas (únicos, ordenados) por encima del nivel de la lección. */
export function offLevelLemmas(tokens: LeveledToken[], lessonLevel: Cefr): string[] {
  const limit = CEFR.indexOf(lessonLevel);
  return [
    ...new Set(tokens.filter((t) => CEFR.indexOf(t.level) > limit).map((t) => t.lemma)),
  ].sort();
}

/** Sílabas aproximadas de una palabra inglesa (grupos de vocales, con la «e» muda final). */
export function countSyllables(word: string): number {
  const w = word.toLowerCase().replace(/[^a-z]/g, '');
  if (w.length <= 3) return w.length === 0 ? 0 : 1;
  const trimmed = w.replace(/(?:[^laeiouy]es|[^laeiouy]ed|[^laeiouy]e)$/, '').replace(/^y/, '');
  return Math.max(1, (trimmed.match(/[aeiouy]{1,2}/g) ?? []).length);
}

/** Legibilidad de Flesch: más alto = más fácil (señal secundaria). */
export function fleschReadingEase(words: string[], sentences: number): number {
  if (words.length === 0 || sentences === 0) return 0;
  const syllables = words.reduce((sum, word) => sum + countSyllables(word), 0);
  return round(206.835 - 1.015 * (words.length / sentences) - 84.6 * (syllables / words.length), 1);
}

const LEVEL_CENTER: Record<Cefr, number> = {
  A1: 700,
  A2: 900,
  B1: 1100,
  B2: 1300,
  C1: 1500,
  C2: 1700,
};
const MEAN_WPM: Record<Cefr, number> = { A1: 100, A2: 115, B1: 135, B2: 155, C1: 175, C2: 195 };
const MEAN_SENTENCE_WORDS: Record<Cefr, number> = { A1: 7, A2: 10, B1: 14, B2: 18, C1: 22, C2: 25 };
const STANDARD_ACCENTS = new Set(['en-US', 'en-GB']);

export type DifficultyInput = {
  level: Cefr;
  /** Fracción de tokens contables de nivel ≤ el de la lección. */
  coverageAtLevel: number;
} & (
  | { skill: 'listening'; wpm: number; accents: string[] }
  | { skill: 'reading'; avgSentenceWords: number }
);

/**
 * Dificultad de la lección en la escala del rating:
 * centro del nivel + léxico (±40) + velocidad (±40) o sintaxis (±30) + acento (+15),
 * recortada a la banda del nivel ± 50.
 */
export function lessonDifficulty(input: DifficultyInput): number {
  const base = LEVEL_CENTER[input.level];
  const lexical = clamp((0.97 - input.coverageAtLevel) * 1000, -40, 40);
  const form =
    input.skill === 'listening'
      ? clamp((input.wpm - MEAN_WPM[input.level]) * 1.5, -40, 40)
      : clamp((input.avgSentenceWords - MEAN_SENTENCE_WORDS[input.level]) * 4, -30, 30);
  const accent =
    input.skill === 'listening' && input.accents.some((a) => !STANDARD_ACCENTS.has(a)) ? 15 : 0;

  const bandStart = base - 100;
  return Math.round(clamp(base + lexical + form + accent, bandStart - 50, bandStart + 200 + 50));
}

/** Umbrales del perfil léxico y de sintaxis por nivel (§2.1 y §2.2). */
export const LEVEL_PROFILE: Record<
  Cefr,
  {
    minCoverage: number | null;
    maxOffLevelPer100: number | null;
    maxSentenceWords: number | null;
    listeningWords: [number, number] | null;
    readingWords: [number, number | null];
    /** Todos los lemas fuera de nivel deben estar en el glosario o en pre_teach. */
    glossAllOffLevel: boolean;
  }
> = {
  A1: {
    minCoverage: 0.97,
    maxOffLevelPer100: 1,
    maxSentenceWords: 8,
    listeningWords: [40, 110],
    readingWords: [50, 150],
    glossAllOffLevel: true,
  },
  A2: {
    minCoverage: 0.96,
    maxOffLevelPer100: 2,
    maxSentenceWords: 11,
    listeningWords: [60, 200],
    readingWords: [150, 300],
    glossAllOffLevel: true,
  },
  B1: {
    minCoverage: 0.95,
    maxOffLevelPer100: 3,
    maxSentenceWords: 15,
    listeningWords: [150, 450],
    readingWords: [300, 600],
    glossAllOffLevel: true,
  },
  B2: {
    minCoverage: 0.94,
    maxOffLevelPer100: 4,
    maxSentenceWords: 20,
    listeningWords: [300, 850],
    readingWords: [500, 900],
    glossAllOffLevel: true,
  },
  C1: {
    minCoverage: 0.92,
    maxOffLevelPer100: 5,
    maxSentenceWords: 25,
    listeningWords: [500, 1800],
    readingWords: [700, 1200],
    glossAllOffLevel: false,
  },
  C2: {
    minCoverage: null,
    maxOffLevelPer100: null,
    maxSentenceWords: null,
    listeningWords: null,
    readingWords: [900, null],
    glossAllOffLevel: false,
  },
};
