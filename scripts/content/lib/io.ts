import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

/** Raíz del contenido. `CONTENT_DIR` permite apuntar a un contenido de prueba (tests e2e). */
export const CONTENT_DIR = path.resolve(process.cwd(), process.env.CONTENT_DIR ?? 'content');
export const LESSONS_DIR = path.join(CONTENT_DIR, 'lessons');
export const INDEX_FILE = path.join(CONTENT_DIR, 'index.generated.json');

export interface LessonFile {
  /** Ruta absoluta. */
  file: string;
  /** Ruta relativa a content/lessons con «/»: «b1/listening/b1-lis-001.json». */
  relativePath: string;
  /** Id que sugiere el nombre del fichero. */
  id: string;
}

export function listLessonFiles(dir = LESSONS_DIR): LessonFile[] {
  const files: LessonFile[] = [];
  const walk = (current: string) => {
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.name.endsWith('.json')) {
        files.push({
          file: full,
          relativePath: path.relative(dir, full).split(path.sep).join('/'),
          id: entry.name.replace(/\.json$/, ''),
        });
      }
    }
  };
  walk(dir);
  return files.sort((a, b) => a.relativePath.localeCompare(b.relativePath));
}

/** Pruebas de los simulacros de examen: `content/exams/{nivel}/{id}.json`. */
export function listExamFiles(): { file: string; id: string }[] {
  const root = path.join(CONTENT_DIR, 'exams');
  if (!existsSync(root)) return [];
  return readdirSync(root)
    .sort()
    .flatMap((level) =>
      readdirSync(path.join(root, level))
        .filter((name) => name.endsWith('.json'))
        .sort()
        .map((name) => ({ file: path.join(root, level, name), id: name.replace(/\.json$/, '') })),
    );
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
