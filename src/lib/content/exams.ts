import 'server-only';
import { readFileSync } from 'node:fs';
import type { Locale } from '@/lib/i18n';
import { EXAM_PAPERS, type ExamLevel, type ExamPaperKind } from './exam-formats';
import { ExamPaper, parsePaperId, type RawExamPaper } from './exam-schema';
import { localize } from './help';
import { assertLanguage, inLanguage, type PracticeLanguage } from './language';
import { listLevelFiles } from './language-dirs';
import { CONTENT_ROOT } from './index';

// Simulacros de examen publicados. El contenido no cambia mientras el servidor está en marcha:
// se lee una vez y se guarda en memoria.

// Se guardan tal cual (con las ayudas sin resolver); cada acceso las resuelve al idioma pedido.
let papers: Map<string, RawExamPaper> | null = null;

function loadAll(): Map<string, RawExamPaper> {
  if (papers) return papers;
  const all = new Map<string, RawExamPaper>();
  // Todos los idiomas: `content/exams/` y `content/<idioma>/exams/` (ADR-0035).
  for (const file of listLevelFiles(CONTENT_ROOT, 'exams', '.json')) {
    const paper = ExamPaper.parse(JSON.parse(readFileSync(file.path, 'utf8')));
    assertLanguage(paper.id, file.language, file.path);
    if (paper.status === 'published') all.set(paper.id, paper);
  }
  papers = all;
  return all;
}

export interface ExamTest {
  level: ExamLevel;
  /** Número del simulacro dentro del nivel (1, 2…). */
  test: number;
  /** Id de cada prueba publicada de este simulacro. */
  papers: Partial<Record<ExamPaperKind, string>>;
}

/** Los simulacros publicados, por nivel y número, con las pruebas que tiene cada uno. */
export function getExamTests(language: PracticeLanguage): ExamTest[] {
  const tests = new Map<string, ExamTest>();
  for (const paper of inLanguage([...loadAll().values()], language)) {
    const parsed = parsePaperId(paper.id);
    if (!parsed) continue;
    const key = `${paper.level}:${parsed.test}`;
    const test = tests.get(key) ?? { level: paper.level, test: parsed.test, papers: {} };
    test.papers[paper.paper] = paper.id;
    tests.set(key, test);
  }
  return [...tests.values()]
    .map((test) => ({
      ...test,
      papers: Object.fromEntries(
        EXAM_PAPERS.flatMap((kind) => (test.papers[kind] ? [[kind, test.papers[kind]]] : [])),
      ) as ExamTest['papers'],
    }))
    .sort((a, b) => a.level.localeCompare(b.level) || a.test - b.test);
}

export function findExamPaper(id: string, locale: Locale): ExamPaper | null {
  const paper = loadAll().get(id);
  return paper ? localize(paper, locale) : null;
}
