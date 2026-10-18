import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import type { PracticeLanguage } from '../../../src/lib/content/language';
import { contentDirs, listLevelFiles } from '../../../src/lib/content/language-dirs';

/** Raíz del contenido. `CONTENT_DIR` permite apuntar a un contenido de prueba (tests e2e). */
export const CONTENT_DIR = path.resolve(process.cwd(), process.env.CONTENT_DIR ?? 'content');
export const INDEX_FILE = path.join(CONTENT_DIR, 'index.generated.json');

export interface LessonFile {
  /** Ruta absoluta. */
  file: string;
  /** Idioma de la lección: el de su carpeta (ADR-0035). */
  language: PracticeLanguage;
  /** Ruta relativa a la carpeta de lecciones de su idioma, con «/»: «b1/listening/b1-lis-001.json». */
  relativePath: string;
  /** Ruta relativa a `content/`, con «/»: «lessons/b1/…» o «es/lessons/a1/…». */
  contentPath: string;
  /** Id que sugiere el nombre del fichero. */
  id: string;
}

/** Las lecciones de todos los idiomas: primero las de inglés, y en cada idioma por ruta. */
export function listLessonFiles(): LessonFile[] {
  return contentDirs(CONTENT_DIR, 'lessons').flatMap(({ language, dir }) =>
    lessonFilesIn(dir, language),
  );
}

function lessonFilesIn(dir: string, language: PracticeLanguage): LessonFile[] {
  const files: LessonFile[] = [];
  const walk = (current: string) => {
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.name.endsWith('.json')) {
        files.push({
          file: full,
          language,
          relativePath: path.relative(dir, full).split(path.sep).join('/'),
          contentPath: path.relative(CONTENT_DIR, full).split(path.sep).join('/'),
          id: entry.name.replace(/\.json$/, ''),
        });
      }
    }
  };
  walk(dir);
  return files.sort((a, b) => a.relativePath.localeCompare(b.relativePath));
}

/** Pruebas de los simulacros de examen de todos los idiomas: `[<idioma>/]exams/{nivel}/{id}.json`. */
export function listExamFiles(): { file: string; id: string; language: PracticeLanguage }[] {
  return listLevelFiles(CONTENT_DIR, 'exams', '.json').map(({ path: file, id, language }) => ({
    file,
    id,
    language,
  }));
}

export function readJson(file: string): unknown {
  return JSON.parse(readFileSync(file, 'utf8'));
}

const isPrimitive = (value: unknown) => value === null || typeof value !== 'object';
const pad = (depth: number) => '  '.repeat(depth);
const LINE_WIDTH = 110;

/**
 * JSON legible y estable para el contenido: los objetos pequeños (tokens, opciones, segmentos)
 * van en una línea y las listas largas de valores simples se reparten en líneas llenas.
 * Así los diffs de una lección anotada siguen siendo revisables.
 */
export function stringifyContent(value: unknown, depth = 0): string {
  if (isPrimitive(value)) return JSON.stringify(value);

  if (Array.isArray(value)) {
    if (value.length === 0) return '[]';
    if (value.every(isPrimitive)) {
      const items = value.map((item) => JSON.stringify(item));
      const oneLine = `[${items.join(', ')}]`;
      if (oneLine.length <= LINE_WIDTH - depth * 2) return oneLine;
      const lines: string[] = [];
      let line = '';
      for (const item of items) {
        const next = line === '' ? item : `${line}, ${item}`;
        if (next.length > LINE_WIDTH - (depth + 1) * 2 && line !== '') {
          lines.push(line);
          line = item;
        } else {
          line = next;
        }
      }
      if (line !== '') lines.push(line);
      return `[\n${lines.map((l) => pad(depth + 1) + l).join(',\n')}\n${pad(depth)}]`;
    }
    const items = value.map((item) => pad(depth + 1) + stringifyContent(item, depth + 1));
    return `[\n${items.join(',\n')}\n${pad(depth)}]`;
  }

  const entries = Object.entries(value as Record<string, unknown>).filter(
    ([, v]) => v !== undefined,
  );
  if (entries.length === 0) return '{}';
  if (entries.every(([, v]) => isPrimitive(v))) {
    const oneLine = `{ ${entries.map(([k, v]) => `${JSON.stringify(k)}: ${JSON.stringify(v)}`).join(', ')} }`;
    if (oneLine.length <= LINE_WIDTH - depth * 2) return oneLine;
  }
  const lines = entries.map(
    ([k, v]) => `${pad(depth + 1)}${JSON.stringify(k)}: ${stringifyContent(v, depth + 1)}`,
  );
  return `{\n${lines.join(',\n')}\n${pad(depth)}}`;
}

export function writeContent(file: string, value: unknown): void {
  writeFileSync(file, `${stringifyContent(value)}\n`, 'utf8');
}

/** `--ids a,b c` → ['a', 'b', 'c']. */
export function splitIds(values: string[] | undefined): string[] {
  return (values ?? []).flatMap((value) => value.split(/[\s,]+/)).filter(Boolean);
}
