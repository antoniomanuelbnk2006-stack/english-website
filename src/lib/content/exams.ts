import 'server-only';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { EXAM_PAPERS, type ExamLevel, type ExamPaperKind } from './exam-formats';
import { ExamPaper, parsePaperId } from './exam-schema';
import { CONTENT_ROOT } from './index';

// Simulacros de examen publicados. El contenido no cambia mientras el servidor está en marcha:
// se lee una vez y se guarda en memoria.

const ROOT = path.join(CONTENT_ROOT, 'exams');

let papers: Map<string, ExamPaper> | null = null;

function loadAll(): Map<string, ExamPaper> {
  if (papers) return papers;
  const all = new Map<string, ExamPaper>();
  if (existsSync(ROOT)) {
    for (const level of readdirSync(ROOT)) {
      const dir = path.join(ROOT, level);
      for (const file of readdirSync(dir).filter((name) => name.endsWith('.json'))) {
        const paper = ExamPaper.parse(JSON.parse(readFileSync(path.join(dir, file), 'utf8')));
        if (paper.status === 'published') all.set(paper.id, paper);
      }
    }
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
export function getExamTests(): ExamTest[] {
  const tests = new Map<string, ExamTest>();
  for (const paper of loadAll().values()) {
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

export function findExamPaper(id: string): ExamPaper | null {
  return loadAll().get(id) ?? null;
}
