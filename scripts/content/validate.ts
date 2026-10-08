// pnpm content:validate [--offline] [--against <ref-de-git>]
// Valida TODO content/: esquemas Zod, invariantes I-1…I-12, anotaciones al día, calidad determinista
// y las fichas de gramática (frontmatter, secciones y que el MDX compile).
// Corre también en CI (con --offline, sin comprobar que el audio responde en R2).
import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { z } from 'zod';
import { checkFicha, parseFicha } from '../../src/lib/content/grammar-schema';
import { LessonMeta } from '../../src/lib/content/schema';
import { checkLesson } from './lib/check-lesson';
import { CONTENT_DIR, INDEX_FILE, listLessonFiles, readJson } from './lib/io';
import { loadWordLists } from './lib/wordlists';

/** Contenido de un fichero en otra referencia de git, o `undefined` si allí no existe. */
function atRef(ref: string, repoPath: string): unknown {
  try {
    const text = execFileSync('git', ['show', `${ref}:${repoPath}`], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

/** I-11 (parte de red): el audio de una lección publicada responde en su URL pública. */
async function audioResponds(src: string): Promise<string | null> {
  const base = process.env.NEXT_PUBLIC_AUDIO_BASE_URL;
  if (!base || !URL.canParse(base)) {
    return 'no se puede comprobar el audio: falta NEXT_PUBLIC_AUDIO_BASE_URL (usa --offline para omitirlo)';
  }
  const url = `${base.replace(/\/+$/, '')}/${src.replace(/^\/+/, '')}`;
  try {
    const response = await fetch(url, { method: 'HEAD' });
    return response.ok ? null : `I-11 · el audio no responde (${response.status}) en ${url}`;
  } catch {
    return `I-11 · no se pudo conectar con ${url}`;
  }
}

/** Fichas de gramática: frontmatter válido, secciones acordadas y cuerpo MDX que compila. */
async function checkGrammar(): Promise<{ count: number; errors: number }> {
  const root = path.join(CONTENT_DIR, 'grammar');
  if (!existsSync(root)) return { count: 0, errors: 0 };
  const { compile } = await import('@mdx-js/mdx');
  const { default: remarkGfm } = await import('remark-gfm');

  let count = 0;
  let errors = 0;
  const seen = new Set<string>();
  for (const level of readdirSync(root).sort()) {
    for (const file of readdirSync(path.join(root, level)).sort()) {
      if (!file.endsWith('.mdx')) continue;
      count++;
      const id = file.slice(0, -'.mdx'.length);
      const issues: string[] = [];
      try {
        const ficha = parseFicha(readFileSync(path.join(root, level, file), 'utf8'));
        issues.push(...checkFicha(ficha, { id, level }));
        if (seen.has(ficha.meta.id)) issues.push(`id repetido: ${ficha.meta.id}`);
        seen.add(ficha.meta.id);
        await compile(ficha.body, { remarkPlugins: [remarkGfm] });
      } catch (error) {
        issues.push(
          error instanceof z.ZodError
            ? error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join(' · ')
            : error instanceof Error
              ? error.message
              : String(error),
        );
      }
      console.log(`${issues.length > 0 ? '✗' : '✓'} ${id}  (gramática)`);
      for (const message of issues) console.log(`    ✗ ${message}`);
      errors += issues.length;
    }
  }
  return { count, errors };
}

async function main(): Promise<number> {
  const { values } = parseArgs({
    options: {
      offline: { type: 'boolean', default: false },
      against: { type: 'string' },
    },
  });

  const lists = loadWordLists();
  const files = listLessonFiles();
  let errorCount = 0;
  let warningCount = 0;
  const published: string[] = [];

  for (const { file, relativePath, id } of files) {
    let input: unknown;
    try {
      input = readJson(file);
    } catch (error) {
      console.log(`✗ ${id}\n    JSON no válido: ${error instanceof Error ? error.message : error}`);
      errorCount++;
      continue;
    }

    const previous = values.against
      ? atRef(values.against, `content/lessons/${relativePath}`)
      : undefined;
    const report = checkLesson(input, lists, { relativePath, previous });

    if (report.status === 'published' && report.errors.length === 0) {
      published.push(id);
      const audio = (input as { audio?: { src?: string } }).audio;
      if (!values.offline && audio?.src) {
        const problem = await audioResponds(audio.src);
        if (problem) report.errors.push(problem);
      }
    }

    const mark = report.errors.length > 0 ? '✗' : report.warnings.length > 0 ? '!' : '✓';
    console.log(`${mark} ${id}  (${report.status})`);
    for (const message of report.errors) console.log(`    ✗ ${message}`);
    for (const message of report.warnings) console.log(`    ! ${message}`);
    errorCount += report.errors.length;
    warningCount += report.warnings.length;
  }

  // El índice generado debe corresponder exactamente a las lecciones publicadas.
  if (existsSync(INDEX_FILE)) {
    const index = z.array(LessonMeta).safeParse(readJson(INDEX_FILE));
    if (!index.success) {
      console.log('✗ index.generated.json no cumple el esquema: ejecuta pnpm content:index');
      errorCount++;
    } else {
      const indexed = index.data.map((meta) => `${meta.id}@${meta.version}`).sort();
      const expected = files
        .filter((f) => published.includes(f.id))
        .map((f) => `${f.id}@${(readJson(f.file) as { version: number }).version}`)
        .sort();
      if (indexed.join() !== expected.join()) {
        console.log('✗ index.generated.json está desfasado: ejecuta pnpm content:index');
        errorCount++;
      }
    }
  } else if (published.length > 0) {
    console.log('✗ falta content/index.generated.json: ejecuta pnpm content:index');
    errorCount++;
  }

  const fichas = await checkGrammar();
  errorCount += fichas.errors;

  console.log(
    `\n${files.length} lección(es): ${published.length} publicada(s) · ${fichas.count} ficha(s) de gramática · ${errorCount} error(es) · ${warningCount} aviso(s).`,
  );
  return errorCount > 0 ? 1 : 0;
}

main().then(
  (code) => process.exit(code),
  (error: unknown) => {
    console.error(error);
    process.exit(1);
  },
);
