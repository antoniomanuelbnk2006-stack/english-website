import { z } from 'zod';
import {
  checkInvariants,
  checkVersionBump,
  type InvariantIssue,
} from '../../../src/lib/content/invariants';
import { Lesson, LessonDraft } from '../../../src/lib/content/schema';
import { lessonLemmas, measure } from './annotate-lesson';
import { detokenize, normalizeText, tokenize, type TokenT } from './nlp';
import { checkProfile, checkTasks, type QaIssue } from './qa';
import type { WordLists } from './wordlists';

// Validación completa de una lección: esquema → invariantes → anotaciones al día → calidad.
// No toca disco ni red: lo que necesita de fuera llega por parámetros.

export interface LessonReport {
  id: string;
  status: string;
  /** Bloquean: esquema, invariantes y, en lecciones revisadas o publicadas, la calidad. */
  errors: string[];
  /** Informan: problemas de calidad en borradores. */
  warnings: string[];
}

export interface CheckOptions {
  relativePath: string;
  /** Versión anterior del mismo fichero (p. ej. en `main`), para comprobar I-12. */
  previous?: unknown;
}

const squash = (text: string) => normalizeText(text).replace(/\s+/g, ' ').trim();

/** Agrupa los errores repetidos («segments.*.start» 29 veces) para que no tapen a los demás. */
function formatZod(error: z.ZodError): string[] {
  const groups = new Map<string, { first: string; count: number }>();
  for (const issue of error.issues) {
    const exact = issue.path.join('.') || '(raíz)';
    const pattern = `${issue.path.map((part) => (typeof part === 'number' ? '*' : part)).join('.')}: ${issue.message}`;
    const group = groups.get(pattern);
    if (group) group.count++;
    else groups.set(pattern, { first: `${exact}: ${issue.message}`, count: 1 });
  }
  return [...groups.entries()]
    .slice(0, 12)
    .map(([pattern, { first, count }]) =>
      count === 1 ? `esquema · ${first}` : `esquema · ${pattern} (${count} veces)`,
    );
}

const formatInvariant = (issue: InvariantIssue) => `${issue.code} · ${issue.message}`;
const formatQa = (issue: QaIssue) => `calidad · [${issue.check}] ${issue.message}`;

/** Tokens guardados de cada unidad de texto, o `null` si la lección aún no está anotada. */
function storedTokens(
  raw: Record<string, unknown>,
  skill: string,
): { text: string; tokens: TokenT[] }[] | null {
  const units =
    skill === 'listening'
      ? (raw.segments as Record<string, unknown>[])
      : (raw.paragraphs as Record<string, unknown>[]).flatMap(
          (paragraph) => paragraph.sentences as Record<string, unknown>[],
        );
  if (!units.every((unit) => Array.isArray(unit.tokens))) return null;
  return units.map((unit) => ({ text: String(unit.text), tokens: unit.tokens as TokenT[] }));
}

export function checkLesson(input: unknown, lists: WordLists, options: CheckOptions): LessonReport {
  const status =
    typeof input === 'object' && input !== null && 'status' in input ? String(input.status) : '?';
  const id = typeof input === 'object' && input !== null && 'id' in input ? String(input.id) : '?';
  const report: LessonReport = { id, status, errors: [], warnings: [] };

  // 1 · Esquema: una lección publicada debe cumplir el esquema completo; el resto, el de borrador.
  const draftResult = LessonDraft.safeParse(input);
  if (!draftResult.success) {
    report.errors.push(...formatZod(draftResult.error));
    return report;
  }
  let lesson: LessonDraft | Lesson = draftResult.data;
  if (lesson.status === 'published') {
    const published = Lesson.safeParse(input);
    if (!published.success) {
      report.errors.push(...formatZod(published.error));
      return report;
    }
    lesson = published.data;
  }

  // 2 · Invariantes.
  report.errors.push(
    ...checkInvariants(lesson, { relativePath: options.relativePath }).map(formatInvariant),
  );
  if (options.previous !== undefined) {
    const previous = LessonDraft.safeParse(options.previous);
    if (previous.success) {
      report.errors.push(...checkVersionBump(previous.data, lesson).map(formatInvariant));
    }
  }

  // 3 · Anotaciones al día: los tokens guardados reconstruyen el texto y son los que saldrían hoy.
  const raw = input as Record<string, unknown>;
  const stored = storedTokens(raw, lesson.skill);
  const own = lessonLemmas(lesson);
  if (stored) {
    for (const unit of stored) {
      const fresh = tokenize(unit.text, lists, own);
      const same =
        squash(detokenize(unit.tokens)) === squash(unit.text) &&
        fresh.length === unit.tokens.length &&
        fresh.every((token, i) => {
          const old = unit.tokens[i];
          return old !== undefined && old.t === token.t && old.l === token.l && old.w === token.w;
        });
      if (!same) {
        report.errors.push(
          `anotaciones · «${unit.text.slice(0, 40)}…» no coincide con sus tokens: ejecuta pnpm content:annotate --ids ${lesson.id}`,
        );
        break;
      }
    }
  }

  // 4 · Calidad determinista. Bloquea en lecciones revisadas o publicadas; avisa en borradores.
  const tokensByUnit = stored
    ? stored.map((unit) => unit.tokens)
    : (lesson.skill === 'listening'
        ? lesson.segments.map((s) => s.text)
        : lesson.paragraphs.flatMap((p) => p.sentences.map((s) => s.text))
      ).map((text) => tokenize(text, lists, own));
  const audio = raw.audio as { wpm?: number } | undefined;
  const metrics = measure(lesson, tokensByUnit, lists, audio?.wpm);
  const quality = [...checkProfile(lesson, metrics), ...checkTasks(lesson)].map(formatQa);
  (lesson.status === 'draft' ? report.warnings : report.errors).push(...quality);

  return report;
}
