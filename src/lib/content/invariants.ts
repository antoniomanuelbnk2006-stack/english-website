import type { z } from 'zod';
import { helpLabel } from './help';
import { languageOfId, withoutLanguage } from './language';
// Las comprobaciones miran los archivos tal cual, con las ayudas sin resolver.
import type { LessonDraft, RawLesson as Lesson, RawTask as Task, Token } from './schema';

// Invariantes del contenido que el esquema Zod no puede expresar
// (docs/04-arquitectura/04-modelo-de-contenido.md §3). Lógica pura: no lee disco ni red.

export type InvariantCode =
  'I-1' | 'I-2' | 'I-3' | 'I-4' | 'I-5' | 'I-6' | 'I-7' | 'I-8' | 'I-9' | 'I-10' | 'I-11' | 'I-12';

export interface InvariantIssue {
  code: InvariantCode;
  message: string;
}

type AnyLesson = LessonDraft | Lesson;
type TokenT = z.infer<typeof Token>;

const LISTENING_PHASES = new Set(['pre', 'listen_1', 'listen_2', 'post']);
const READING_PHASES = new Set(['pre', 'skim', 'read', 'post']);

/** Apóstrofos y comillas tipográficos → rectos, y sin distinguir mayúsculas. */
const fold = (text: string) => text.replace(/[‘’ʼ]/g, "'").replace(/[“”]/g, '"').toLowerCase();

function duplicates(values: string[]): string[] {
  const seen = new Set<string>();
  const repeated = new Set<string>();
  for (const value of values) (seen.has(value) ? repeated : seen).add(value);
  return [...repeated];
}

/** Texto de cada elemento referenciable: segmentos, frases y párrafos (texto de sus frases). */
export function referenceTexts(lesson: AnyLesson): Map<string, string> {
  const texts = new Map<string, string>();
  if (lesson.skill === 'listening') {
    for (const segment of lesson.segments) texts.set(segment.id, segment.text);
  } else {
    for (const paragraph of lesson.paragraphs) {
      texts.set(paragraph.id, paragraph.sentences.map((s) => s.text).join(' '));
      for (const sentence of paragraph.sentences) texts.set(sentence.id, sentence.text);
    }
  }
  return texts;
}

function checkTaskAnswers(task: Task, issues: InvariantIssue[]): void {
  const at = `tarea ${task.id}`;
  const missing = (ids: string[], valid: Set<string>) => ids.filter((id) => !valid.has(id));

  switch (task.type) {
    case 'mcq': {
      const options = new Set(task.options.map((o) => o.id));
      if (!options.has(task.answer)) {
        issues.push({ code: 'I-4', message: `${at}: answer «${task.answer}» no es una opción` });
      }
      break;
    }
    case 'multi_select': {
      const options = new Set(task.options.map((o) => o.id));
      for (const id of missing(task.answers, options)) {
        issues.push({
          code: 'I-4',
          message: `${at}: answers incluye «${id}», que no es una opción`,
        });
      }
      break;
    }
    case 'matching': {
      const left = new Set(task.left.map((o) => o.id));
      const right = new Set(task.right.map((o) => o.id));
      for (const [from, to] of Object.entries(task.pairs)) {
        if (!left.has(from)) {
          issues.push({ code: 'I-4', message: `${at}: pairs usa «${from}», que no está en left` });
        }
        if (!right.has(to)) {
          issues.push({ code: 'I-4', message: `${at}: pairs usa «${to}», que no está en right` });
        }
      }
      for (const id of left) {
        if (!(id in task.pairs)) {
          issues.push({ code: 'I-4', message: `${at}: «${id}» de left no tiene pareja` });
        }
      }
      break;
    }
    case 'ordering': {
      const items = task.items.map((o) => o.id).sort();
      const order = [...task.correct_order].sort();
      if (items.length !== order.length || items.some((id, i) => id !== order[i])) {
        issues.push({
          code: 'I-4',
          message: `${at}: correct_order no es una permutación de items`,
        });
      }
      break;
    }
    case 'heading_match': {
      const headings = new Set(task.headings.map((o) => o.id));
      const paragraphs = new Set(task.paragraphs);
      for (const [paragraph, heading] of Object.entries(task.answers)) {
        if (!paragraphs.has(paragraph)) {
          issues.push({
            code: 'I-4',
            message: `${at}: answers usa el párrafo «${paragraph}», que no está en paragraphs`,
          });
        }
        if (!headings.has(heading)) {
          issues.push({
            code: 'I-4',
            message: `${at}: answers usa el título «${heading}», que no existe`,
          });
        }
      }
      for (const paragraph of paragraphs) {
        if (!(paragraph in task.answers)) {
          issues.push({
            code: 'I-4',
            message: `${at}: el párrafo «${paragraph}» no tiene título asignado`,
          });
        }
      }
      break;
    }
    case 'gap_fill': {
      const marks = [...task.text.matchAll(/\{\{(\d+)\}\}/g)].map((m) => Number(m[1])).sort();
      const gaps = task.gaps.map((g) => g.n).sort();
      if (marks.length !== gaps.length || marks.some((n, i) => n !== gaps[i])) {
        issues.push({
          code: 'I-8',
          message: `${at}: las marcas {{n}} del texto (${marks.join(', ') || 'ninguna'}) no coinciden con gaps (${gaps.join(', ')})`,
        });
      }
      break;
    }
    case 'true_false_ng':
      if (task.answer === 'NG' && !task.allow_ng) {
        issues.push({ code: 'I-4', message: `${at}: la respuesta es NG pero allow_ng es false` });
      }
      break;
    case 'short_answer':
    case 'dictation':
      break;
  }
}

function checkTimings(lesson: Extract<Lesson, { skill: 'listening' }>, issues: InvariantIssue[]) {
  let previousEnd = 0;
  for (const segment of lesson.segments) {
    const at = `segmento ${segment.id}`;
    if (!(segment.start < segment.end)) {
      issues.push({
        code: 'I-9',
        message: `${at}: start (${segment.start}) debe ser menor que end (${segment.end})`,
      });
    }
    if (segment.start < previousEnd) {
      issues.push({
        code: 'I-9',
        message: `${at}: empieza (${segment.start}) antes de que acabe el anterior (${previousEnd})`,
      });
    }
    previousEnd = segment.end;

    let cursor = segment.start;
    for (const token of segment.tokens) {
      if (token.s === undefined || token.e === undefined) continue;
      if (token.s > token.e || token.s < cursor - 0.001 || token.e > segment.end + 0.001) {
        issues.push({
          code: 'I-9',
          message: `${at}: tiempos de «${token.t}» fuera de orden o del segmento`,
        });
        break;
      }
      cursor = token.s;
    }
  }
  if (lesson.audio.duration_s < previousEnd) {
    issues.push({
      code: 'I-9',
      message: `audio.duration_s (${lesson.audio.duration_s}) es menor que el final del último segmento (${previousEnd})`,
    });
  }
}

function allTokens(lesson: Lesson): TokenT[] {
  return lesson.skill === 'listening'
    ? lesson.segments.flatMap((s) => s.tokens)
    : lesson.paragraphs.flatMap((p) => p.sentences.flatMap((s) => s.tokens));
}

export interface InvariantContext {
  /** Ruta del fichero relativa a content/lessons, con «/»: «b1/listening/b1-lis-001.json». */
  relativePath?: string;
}

export function checkInvariants(
  lesson: AnyLesson,
  context: InvariantContext = {},
): InvariantIssue[] {
  const issues: InvariantIssue[] = [];
  const level = lesson.level.toLowerCase();
  const kind = lesson.skill === 'listening' ? 'lis' : 'rea';

  // I-1 · id, fichero, carpeta, nivel y destreza coherentes.
  if (!withoutLanguage(lesson.id).startsWith(`${level}-${kind}-`)) {
    issues.push({
      code: 'I-1',
      message: `el id «${lesson.id}» no corresponde a level ${lesson.level} y skill ${lesson.skill}`,
    });
  }
  if (context.relativePath !== undefined) {
    const expected = `${level}/${lesson.skill}/${lesson.id}.json`;
    if (context.relativePath !== expected) {
      issues.push({
        code: 'I-1',
        message: `el fichero está en «${context.relativePath}» y debería estar en «${expected}»`,
      });
    }
  }
  if (languageOfId(lesson.unit) !== languageOfId(lesson.id)) {
    issues.push({
      code: 'I-1',
      message: `la unidad ${lesson.unit} es de otro idioma que la lección`,
    });
  }
  if (!withoutLanguage(lesson.unit).startsWith(`${level}-`)) {
    issues.push({
      code: 'I-1',
      message: `la unidad «${lesson.unit}» no es del nivel ${lesson.level}`,
    });
  }

  // I-2 · identificadores únicos.
  const textIds =
    lesson.skill === 'listening'
      ? lesson.segments.map((s) => s.id)
      : lesson.paragraphs.flatMap((p) => [p.id, ...p.sentences.map((s) => s.id)]);
  for (const id of duplicates(lesson.tasks.map((t) => t.id))) {
    issues.push({ code: 'I-2', message: `id de tarea repetido: ${id}` });
  }
  for (const id of duplicates(textIds)) {
    issues.push({ code: 'I-2', message: `id de texto repetido: ${id}` });
  }
  if (lesson.skill === 'reading') {
    for (const paragraph of lesson.paragraphs) {
      for (const sentence of paragraph.sentences) {
        if (!sentence.id.startsWith(`${paragraph.id}s`)) {
          issues.push({
            code: 'I-2',
            message: `la frase ${sentence.id} no pertenece al párrafo ${paragraph.id}`,
          });
        }
      }
    }
  }

  // I-3 · toda referencia apunta a algo que existe.
  const texts = referenceTexts(lesson);
  const exists = (ref: string) => texts.has(ref);
  for (const task of lesson.tasks) {
    for (const ref of task.evidence) {
      if (!exists(ref))
        issues.push({ code: 'I-3', message: `tarea ${task.id}: evidence «${ref}» no existe` });
    }
    if (task.type === 'dictation' && !exists(task.segment)) {
      issues.push({
        code: 'I-3',
        message: `tarea ${task.id}: segment «${task.segment}» no existe`,
      });
    }
    if (task.type === 'heading_match') {
      for (const paragraph of task.paragraphs) {
        if (!exists(paragraph)) {
          issues.push({
            code: 'I-3',
            message: `tarea ${task.id}: el párrafo «${paragraph}» no existe`,
          });
        }
      }
    }
  }
  for (const entry of lesson.glossary) {
    if (!exists(entry.ref)) {
      issues.push({
        code: 'I-3',
        message: `glosario «${entry.lemma}»: ref «${entry.ref}» no existe`,
      });
    }
  }
  if (lesson.skill === 'listening') {
    for (const feature of lesson.connected_speech) {
      if (!exists(feature.ref)) {
        issues.push({
          code: 'I-3',
          message: `connected_speech «${feature.phrase}»: ref «${feature.ref}» no existe`,
        });
      }
    }
  } else {
    for (const focus of lesson.language_focus) {
      for (const ref of focus.refs) {
        if (!exists(ref)) {
          issues.push({
            code: 'I-3',
            message: `language_focus «${helpLabel(focus.title_es)}»: ref «${ref}» no existe`,
          });
        }
      }
    }
  }

  // I-4 e I-8 · claves de respuesta posibles; huecos que cuadran.
  for (const task of lesson.tasks) checkTaskAnswers(task, issues);

  // I-5 · fases coherentes con la destreza.
  const phases = lesson.skill === 'listening' ? LISTENING_PHASES : READING_PHASES;
  for (const task of lesson.tasks) {
    if (!phases.has(task.phase)) {
      issues.push({
        code: 'I-5',
        message: `tarea ${task.id}: la fase «${task.phase}» no es de ${lesson.skill}`,
      });
    }
  }

  if (lesson.skill === 'listening') {
    // I-6 · cada hablante de un segmento está declarado.
    const speakers = new Set(lesson.speakers.map((s) => s.id));
    for (const id of duplicates(lesson.speakers.map((s) => s.id))) {
      issues.push({ code: 'I-6', message: `hablante repetido: ${id}` });
    }
    for (const segment of lesson.segments) {
      if (!speakers.has(segment.speaker)) {
        issues.push({
          code: 'I-6',
          message: `segmento ${segment.id}: el hablante «${segment.speaker}» no está en speakers`,
        });
      }
    }
    // El dictado se compara con el texto del segmento: deben ser idénticos.
    for (const task of lesson.tasks) {
      if (task.type !== 'dictation') continue;
      const segmentText = texts.get(task.segment);
      if (segmentText !== undefined && segmentText !== task.reference) {
        issues.push({
          code: 'I-3',
          message: `tarea ${task.id}: reference no coincide con el texto de ${task.segment}`,
        });
      }
    }
  }

  // I-7 · frases del glosario y de habla conectada, literales en el texto de su ref.
  for (const entry of lesson.glossary) {
    const text = texts.get(entry.ref);
    if (text !== undefined && !fold(text).includes(fold(entry.surface))) {
      issues.push({
        code: 'I-7',
        message: `glosario «${entry.lemma}»: «${entry.surface}» no aparece literalmente en ${entry.ref}`,
      });
    }
  }
  if (lesson.skill === 'listening') {
    for (const feature of lesson.connected_speech) {
      const text = texts.get(feature.ref);
      if (text !== undefined && !fold(text).includes(fold(feature.phrase))) {
        issues.push({
          code: 'I-7',
          message: `connected_speech: «${feature.phrase}» no aparece literalmente en ${feature.ref}`,
        });
      }
    }
  }

  if (lesson.status === 'published') {
    if (!('qa' in lesson) || !('lemmas' in lesson)) {
      // El esquema de lección publicada ya exige qa, tokens, lemmas y difficulty.
      issues.push({
        code: 'I-11',
        message: 'la lección está publicada pero no tiene las anotaciones del pipeline',
      });
      return issues;
    }
    const published = lesson as Lesson;

    // I-9 · tiempos crecientes y dentro del audio.
    if (published.skill === 'listening') checkTimings(published, issues);

    // I-10 · lemmas ordenados, sin duplicados e iguales a los tokens contables.
    const expected = [
      ...new Set(
        allTokens(published)
          .filter((t) => t.w)
          .map((t) => t.l),
      ),
    ].sort();
    const actual = published.lemmas;
    if (actual.length !== expected.length || actual.some((lemma, i) => lemma !== expected[i])) {
      issues.push({
        code: 'I-10',
        message:
          'lemmas no coincide con los lemas contables de los tokens (ordenados y sin duplicados)',
      });
    }

    // I-11 · control de calidad superado: revisor automático o revisión humana registrada.
    const reviewer = published.qa.reviewer;
    if (reviewer) {
      if (reviewer.answerable_without_text > 0.4) {
        issues.push({
          code: 'I-11',
          message: `qa.reviewer.answerable_without_text es ${reviewer.answerable_without_text} (máximo 0,4)`,
        });
      }
    } else if (!published.provenance.reviewed_by) {
      issues.push({
        code: 'I-11',
        message:
          'publicada sin revisor automático (qa.reviewer) ni revisión humana (provenance.reviewed_by)',
      });
    }
  }

  return issues;
}

/** Huella del contenido que obliga a subir `version` si cambia (I-12): texto y tareas. */
export function contentFingerprint(lesson: AnyLesson): string {
  const text =
    lesson.skill === 'listening'
      ? lesson.segments.map((s) => `${s.id}|${s.speaker}|${s.text}`)
      : lesson.paragraphs.flatMap((p) => p.sentences.map((s) => `${s.id}|${s.text}`));
  return JSON.stringify({ text, tasks: lesson.tasks });
}

/** I-12 · una lección ya publicada no cambia de texto o tareas sin subir la versión. */
export function checkVersionBump(previous: AnyLesson, current: AnyLesson): InvariantIssue[] {
  if (previous.status !== 'published') return [];
  if (current.version > previous.version) return [];
  if (contentFingerprint(previous) === contentFingerprint(current)) return [];
  return [
    {
      code: 'I-12',
      message: `el texto o las tareas han cambiado respecto a la versión publicada (v${previous.version}) sin subir version`,
    },
  ];
}
