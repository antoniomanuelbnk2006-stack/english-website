import { LessonDraft } from '../../../src/lib/content/schema';
import {
  coverageByLevel,
  fleschReadingEase,
  lessonDifficulty,
  offLevelLemmas,
  type LeveledToken,
} from './metrics';
import {
  countSentences,
  countWords,
  detokenize,
  normalizeText,
  tokenize,
  type TokenT,
} from './nlp';
import { checkProfile, checkTasks, type LessonMetrics, type QaIssue } from './qa';
import { CEFR, levelOf, type Cefr, type WordLists } from './wordlists';

// Anotación de una lección: tokens, lemas, niveles, cobertura, legibilidad y dificultad
// (docs/05-contenido/01-pipeline.md §3.3). No toca disco: recibe y devuelve datos.

type Json = Record<string, unknown>;

export interface Annotated {
  /** La lección original con las anotaciones añadidas (lista para escribirse en disco). */
  lesson: Json;
  metrics: LessonMetrics & {
    coverageByLevel: Record<Cefr, number>;
    flesch: number;
    difficulty: number;
    lemmaCount: number;
  };
  issues: QaIssue[];
}

/** Unidades de texto de la lección (segmentos o frases), en orden, con su objeto original. */
function textUnits(raw: Json, skill: 'listening' | 'reading'): Json[] {
  if (skill === 'listening') return raw.segments as Json[];
  return (raw.paragraphs as Json[]).flatMap((paragraph) => paragraph.sentences as Json[]);
}

/** Conserva los tiempos del audio si el texto del segmento no ha cambiado. */
function keepTimings(fresh: TokenT[], previous: unknown): TokenT[] {
  if (!Array.isArray(previous) || previous.length !== fresh.length) return fresh;
  const old = previous as TokenT[];
  if (!fresh.every((token, i) => old[i]?.t === token.t)) return fresh;
  return fresh.map((token, i) => {
    const { s, e } = old[i] ?? {};
    return s !== undefined && e !== undefined ? { ...token, s, e } : token;
  });
}

const squash = (text: string) => normalizeText(text).replace(/\s+/g, ' ').trim();

const wordsOf = (text: string) => text.toLowerCase().match(/[\p{L}'-]+/gu) ?? [];

/** Lemas que la propia lección define (glosario y palabras previas). */
export function lessonLemmas(lesson: LessonDraft): Set<string> {
  return new Set([
    ...lesson.glossary.flatMap((entry) => wordsOf(entry.lemma)),
    ...lesson.pre_teach.flatMap(wordsOf),
  ]);
}

/** Métricas a partir de tokens ya calculados (lo usa también la validación, sin volver a tokenizar). */
export function measure(
  lesson: LessonDraft,
  tokensByUnit: TokenT[][],
  lists: WordLists,
  wpm?: number,
): Annotated['metrics'] & { lemmas: string[] } {
  const all = tokensByUnit.flat();
  const leveled: LeveledToken[] = all
    .filter((token) => token.w)
    .map((token) => ({ lemma: token.l, level: levelOf(lists, token.l, token.p).level }));

  const coverage = coverageByLevel(leveled);
  const offLevel = offLevelLemmas(leveled, lesson.level);
  const own = lessonLemmas(lesson);

  const lemmasIn = (text: string) =>
    new Set([...wordsOf(text), ...tokenize(text, lists, own).map((token) => token.l)]);
  // Un lema fuera de nivel está cubierto si aparece en el glosario o en las palabras previas.
  const preTaught = new Set(lesson.pre_teach.flatMap((word) => [...lemmasIn(word)]));
  const glossed = new Set(preTaught);
  for (const entry of lesson.glossary) {
    for (const lemma of [...lemmasIn(entry.lemma), ...lemmasIn(entry.surface)]) glossed.add(lemma);
  }

  // Para el umbral de cobertura, las palabras previas (máx. 5, se enseñan en la fase 0) cuentan
  // como conocidas: un término del tema que el texto repite no lo vuelve «demasiado difícil».
  const limit = CEFR.indexOf(lesson.level);
  const covered = leveled.filter(
    (token) => CEFR.indexOf(token.level) <= limit || preTaught.has(token.lemma),
  ).length;
  const coverageWithPreTeach = leveled.length === 0 ? 1 : covered / leveled.length;

  const wordCount = tokensByUnit.reduce((sum, tokens) => sum + countWords(tokens), 0);
  const sentences = tokensByUnit.reduce((sum, tokens) => sum + countSentences(tokens), 0);
  const avgSentenceWords = sentences === 0 ? 0 : Number((wordCount / sentences).toFixed(1));
  const words = all.filter((token) => /\p{L}/u.test(token.t)).map((token) => token.t);
  // La dificultad usa la cobertura «de lista», sin el ajuste de las palabras previas.
  const coverageAtLevel = coverage[lesson.level];

  const difficulty =
    lesson.skill === 'listening'
      ? lessonDifficulty({
          skill: 'listening',
          level: lesson.level,
          coverageAtLevel,
          wpm: wpm ?? lesson.target_wpm,
          accents: lesson.speakers.map((speaker) => speaker.accent),
        })
      : lessonDifficulty({
          skill: 'reading',
          level: lesson.level,
          coverageAtLevel,
          avgSentenceWords,
        });

  const lemmas = [...new Set(leveled.map((token) => token.lemma))].sort();

  return {
    coverageAtLevel: Number(coverageWithPreTeach.toFixed(4)),
    coverageByLevel: coverage,
    offLevelLemmas: offLevel,
    unglossedLemmas: offLevel.filter((lemma) => !glossed.has(lemma)),
    avgSentenceWords,
    wordCount,
    flesch: fleschReadingEase(words, sentences),
    difficulty,
    lemmaCount: lemmas.length,
    lemmas,
  };
}

export function annotateLesson(input: unknown, lists: WordLists, now: Date): Annotated {
  const draft = LessonDraft.parse(input);
  // Se anota sobre una copia del JSON original para no perder campos que el borrador no conoce
  // (audio, tiempos, informe del revisor).
  const raw = structuredClone(input) as Json;
  const units = textUnits(raw, draft.skill);
  const own = lessonLemmas(draft);

  const tokensByUnit = units.map((unit) => {
    const text = String(unit.text);
    const tokens = tokenize(text, lists, own);
    if (squash(detokenize(tokens)) !== squash(text)) {
      throw new Error(`${draft.id} · ${String(unit.id)}: los tokens no reconstruyen el texto`);
    }
    return keepTimings(tokens, unit.tokens);
  });
  units.forEach((unit, i) => {
    unit.tokens = tokensByUnit[i];
  });

  const audio = raw.audio as { wpm?: number } | undefined;
  const { lemmas, ...metrics } = measure(draft, tokensByUnit, lists, audio?.wpm);

  const previousQa = (raw.qa ?? {}) as Json;
  const qa: Json = {
    coverage_by_level: metrics.coverageByLevel,
    off_level_lemmas: metrics.offLevelLemmas,
    avg_sentence_words: metrics.avgSentenceWords,
    flesch_reading_ease: metrics.flesch,
  };
  if (previousQa.reviewer !== undefined) qa.reviewer = previousQa.reviewer;
  // La fecha solo cambia si cambian las métricas: reanotar sin cambios no ensucia el diff.
  const { checked_at: previousCheck, ...previousRest } = previousQa;
  qa.checked_at =
    typeof previousCheck === 'string' && JSON.stringify(previousRest) === JSON.stringify(qa)
      ? previousCheck
      : now.toISOString();

  if (draft.skill === 'reading') raw.word_count = metrics.wordCount;
  raw.lemmas = lemmas;
  raw.difficulty = metrics.difficulty;
  raw.qa = qa;

  return { lesson: raw, metrics, issues: [...checkProfile(draft, metrics), ...checkTasks(draft)] };
}
