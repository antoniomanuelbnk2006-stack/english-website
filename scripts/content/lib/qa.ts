import type { Lesson, LessonDraft } from '../../../src/lib/content/schema';
import { referenceTexts } from '../../../src/lib/content/invariants';
import { LEVEL_PROFILE } from './metrics';
import { CEFR, type Cefr } from './wordlists';

// Comprobaciones deterministas de calidad (docs/05-contenido/02-control-de-calidad.md §2). Lógica pura.

export interface QaIssue {
  check:
    | 'coverage'
    | 'off-level'
    | 'glossary'
    | 'sentence-length'
    | 'length'
    | 'segment-length'
    | 'answer-position'
    | 'option-length'
    | 'literal-copy'
    | 'focus-mix'
    | 'dictation';
  message: string;
}

type AnyLesson = LessonDraft | Lesson;

export interface LessonMetrics {
  /** Fracción de tokens contables de nivel ≤ el de la lección. */
  coverageAtLevel: number;
  offLevelLemmas: string[];
  /** Lemas fuera de nivel que no están ni en el glosario ni en pre_teach. */
  unglossedLemmas: string[];
  avgSentenceWords: number;
  wordCount: number;
}

const pct = (value: number) => `${(value * 100).toFixed(1).replace('.', ',')} %`;

/** Capa 2 · perfil léxico, sintaxis y longitud según el nivel. */
export function checkProfile(lesson: AnyLesson, metrics: LessonMetrics): QaIssue[] {
  const issues: QaIssue[] = [];
  const profile = LEVEL_PROFILE[lesson.level];

  if (profile.minCoverage !== null && metrics.coverageAtLevel < profile.minCoverage) {
    issues.push({
      check: 'coverage',
      message: `cobertura del nivel ${lesson.level}: ${pct(metrics.coverageAtLevel)} (mínimo ${pct(profile.minCoverage)})`,
    });
  }

  if (profile.maxOffLevelPer100 !== null && metrics.wordCount > 0) {
    const per100 = (metrics.offLevelLemmas.length / metrics.wordCount) * 100;
    if (per100 > profile.maxOffLevelPer100) {
      issues.push({
        check: 'off-level',
        message: `${per100.toFixed(1).replace('.', ',')} lemas fuera de nivel por cada 100 palabras (máximo ${profile.maxOffLevelPer100}): ${metrics.offLevelLemmas.join(', ')}`,
      });
    }
  }

  if (profile.glossAllOffLevel && metrics.unglossedLemmas.length > 0) {
    issues.push({
      check: 'glossary',
      message: `fuera de nivel y sin glosar (ni en pre_teach): ${metrics.unglossedLemmas.join(', ')}`,
    });
  }

  if (profile.maxSentenceWords !== null && metrics.avgSentenceWords > profile.maxSentenceWords) {
    issues.push({
      check: 'sentence-length',
      message: `media de ${metrics.avgSentenceWords} palabras por frase (máximo ${profile.maxSentenceWords} en ${lesson.level})`,
    });
  }

  const range = lesson.skill === 'listening' ? profile.listeningWords : profile.readingWords;
  if (range) {
    const [min, max] = range;
    if (metrics.wordCount < min || (max !== null && metrics.wordCount > max)) {
      issues.push({
        check: 'length',
        message: `${metrics.wordCount} palabras (rango de ${lesson.level}: ${min}–${max ?? '∞'})`,
      });
    }
  }

  return issues;
}

const STOPWORDS = new Set(
  `a an the and or but if so of to in on at by for from with about into over after before up down
   out off as than then that this these those it its he she they them his her their we you i me my
   your our us is are was were be been being am do does did done have has had will would can could
   should may might must not no yes there here what which who whom when where why how all any some
   more most very just only also too each every`.split(/\s+/),
);

/** Números y horas se repiten por fuerza: «forty minutes» no se puede parafrasear. */
const NUMBER_WORDS = new Set(
  `one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen
   seventeen eighteen nineteen twenty thirty forty fifty sixty seventy eighty ninety hundred hundreds
   thousand thousands million half quarter first second third a.m. p.m. am pm o'clock noon midnight`.split(
    /\s+/,
  ),
);

const isContentWord = (word: string) =>
  word.length > 2 && !STOPWORDS.has(word) && !NUMBER_WORDS.has(word) && !/\d/.test(word);

/** Palabras de contenido en minúsculas; la mayúscula inicial delata los nombres propios. */
function contentWords(text: string, skipProperNouns: boolean): string[] {
  const words = text.match(/[\p{L}\p{N}'’-]+/gu) ?? [];
  return words
    .filter((word, index) => !(skipProperNouns && index > 0 && /^\p{Lu}/u.test(word)))
    .map((word) => word.toLowerCase().replace(/[’']s$/, ''))
    .filter(isContentWord);
}

/** Raíz muy aproximada: basta para ver si «changes» y «changed» repiten la misma palabra. */
const stem = (word: string) => word.replace(/(?:ing|ed|es|s|ly)$/, '');

/** Fracción de las palabras de contenido de `option` que ya están, tal cual, en la evidencia. */
export function literalOverlap(option: string, evidence: string): number | null {
  const optionWords = contentWords(option, true);
  if (optionWords.length < 3) return null;
  const evidenceStems = new Set(contentWords(evidence, false).map(stem));
  const repeated = optionWords.filter((word) => evidenceStems.has(stem(word))).length;
  return repeated / optionWords.length;
}

/** Capa 3 · las tareas miden comprensión y no suerte. */
export function checkTasks(lesson: AnyLesson): QaIssue[] {
  const issues: QaIssue[] = [];
  const texts = referenceTexts(lesson);
  const mcqs = lesson.tasks.filter((task) => task.type === 'mcq');

  // Posición de la respuesta: ninguna letra acierta más de la mitad de las veces.
  if (mcqs.length >= 4) {
    const counts = new Map<string, number>();
    for (const task of mcqs) counts.set(task.answer, (counts.get(task.answer) ?? 0) + 1);
    for (const [letter, count] of counts) {
      if (count / mcqs.length > 0.5) {
        issues.push({
          check: 'answer-position',
          message: `la opción «${letter}» es la correcta en ${count} de ${mcqs.length} preguntas (máximo 50 %)`,
        });
      }
    }
  }

  // Longitud: la correcta no es la más larga en más del 40 % de las preguntas.
  if (mcqs.length >= 4) {
    const longest = mcqs.filter((task) => {
      const correct = task.options.find((o) => o.id === task.answer);
      return (
        correct !== undefined &&
        task.options.every((o) => o.id === correct.id || o.text.length < correct.text.length)
      );
    });
    if (longest.length / mcqs.length > 0.4) {
      issues.push({
        check: 'option-length',
        message: `la respuesta correcta es la opción más larga en ${longest.length} de ${mcqs.length} preguntas (máximo 40 %): ${longest.map((t) => t.id).join(', ')}`,
      });
    }
  }

  // Copia literal: la correcta se parafrasea, no se «caza» por coincidencia de palabras.
  for (const task of mcqs) {
    const correct = task.options.find((o) => o.id === task.answer);
    if (!correct) continue;
    const evidence = task.evidence.map((ref) => texts.get(ref) ?? '').join(' ');
    const overlap = literalOverlap(correct.text, evidence);
    if (overlap !== null && overlap >= 0.6) {
      issues.push({
        check: 'literal-copy',
        message: `tarea ${task.id}: la opción correcta repite el ${Math.round(overlap * 100)} % de las palabras de su evidencia (máximo 60 %)`,
      });
    }
  }

  // Reparto de focos: desde B1, al menos una pregunta de inferencia o de actitud.
  if (CEFR.indexOf(lesson.level as Cefr) >= CEFR.indexOf('B1')) {
    const deep = lesson.tasks.some(
      (task) => task.focus === 'inference' || task.focus === 'attitude_opinion',
    );
    if (!deep) {
      issues.push({
        check: 'focus-mix',
        message: `falta al menos una pregunta de inferencia o de actitud (nivel ${lesson.level})`,
      });
    }
  }

  if (lesson.skill === 'listening') {
    // Segmentos fáciles de decir y de dictar: como mucho 20 palabras.
    for (const segment of lesson.segments) {
      const words = segment.text.match(/[\p{L}\p{N}'’-]+/gu)?.length ?? 0;
      if (words > 20) {
        issues.push({
          check: 'segment-length',
          message: `segmento ${segment.id}: ${words} palabras (máximo 20)`,
        });
      }
    }

    // Dictado: de 2 a 4 frases, cada una con algún rasgo de habla conectada marcado.
    const dictations = lesson.tasks.filter((task) => task.type === 'dictation');
    const featured = new Set(lesson.connected_speech.map((feature) => feature.ref));
    if (dictations.length > 0 && (dictations.length < 2 || dictations.length > 4)) {
      issues.push({
        check: 'dictation',
        message: `hay ${dictations.length} dictado(s); deben ser entre 2 y 4`,
      });
    }
    for (const task of dictations) {
      if (!featured.has(task.segment)) {
        issues.push({
          check: 'dictation',
          message: `tarea ${task.id}: el segmento ${task.segment} no tiene ningún rasgo de habla conectada marcado`,
        });
      }
    }
  }

  return issues;
}
