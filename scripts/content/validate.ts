// pnpm content:validate [--offline] [--against <ref-de-git>]
// Valida TODO content/: esquemas Zod, invariantes I-1…I-12, anotaciones al día, calidad determinista
// y las fichas de gramática (frontmatter, secciones y que el MDX compile).
// Corre también en CI (con --offline, sin comprobar que el audio responde en R2).
import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { z } from 'zod';
import { checkDictionaryFile, DictionaryFile, lemmaKey } from '../../src/lib/content/dictionary-schema';
import {
  checkFicha,
  checkFichaBody,
  fichaVariant,
  parseFicha,
} from '../../src/lib/content/grammar-schema';
import {
  checkPronunciationSet,
  PronunciationSet,
} from '../../src/lib/content/pronunciation-schema';
import { LessonMeta } from '../../src/lib/content/schema';
import { reviewText } from '../../src/features/writing/lib/checks';
import { checkExamPaper, ExamPaper, partRecordings } from '../../src/lib/content/exam-schema';
import { checkUoeSet, UoeSet } from '../../src/lib/content/uoe-schema';
import { checkWritingPrompt, WritingPrompt } from '../../src/lib/content/writing-schema';
import { checkLesson } from './lib/check-lesson';
import { assertLanguage, BASE_LANGUAGE, languageOfId } from '../../src/lib/content/language';
import { contentDirs, listLevelFiles } from '../../src/lib/content/language-dirs';
import { CONTENT_DIR, INDEX_FILE, listLessonFiles, readJson } from './lib/io';
import { loadWordLists, type WordLists } from './lib/wordlists';

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
  const { compile } = await import('@mdx-js/mdx');
  const { default: remarkGfm } = await import('remark-gfm');

  let count = 0;
  let errors = 0;
  const seen = new Set<string>();
  const variantsOf = new Map<string, string[]>();
  for (const { language, level, id, path: filePath } of listLevelFiles(CONTENT_DIR, 'grammar', '.mdx')) {
    // La versión de una ficha en otro idioma de interfaz: solo el cuerpo, con sus secciones.
    const variant = fichaVariant(id);
    if (variant) {
      const issues: string[] = [];
      variantsOf.set(variant.id, [...(variantsOf.get(variant.id) ?? []), variant.locale]);
      try {
        assertLanguage(variant.id, language, filePath);
        const body = readFileSync(filePath, 'utf8');
        issues.push(...checkFichaBody(body, variant.locale));
        await compile(body, { remarkPlugins: [remarkGfm] });
      } catch (error) {
        issues.push(error instanceof Error ? error.message : String(error));
      }
      console.log(`${issues.length > 0 ? '✗' : '✓'} ${id}  (gramática · ${variant.locale})`);
      for (const message of issues) console.log(`    ✗ ${message}`);
      errors += issues.length;
      continue;
    }
    count++;
    const issues: string[] = [];
    try {
      assertLanguage(id, language, filePath);
      const ficha = parseFicha(readFileSync(filePath, 'utf8'));
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
  for (const [id, locales] of variantsOf) {
    if (!seen.has(id)) {
      console.log(`✗ ${id}  (gramática)
    ✗ hay versiones en ${locales.join(', ')}, pero no la ficha`);
      errors++;
    }
  }
  return { count, errors };
}

/** Ejercicios de Use of English: esquema y reglas (huecos, palabra dada, límite de palabras). */
function checkUseOfEnglish(): { count: number; published: number; errors: number } {
  let count = 0;
  let published = 0;
  let errors = 0;
  for (const { language, level, id, path: filePath } of listLevelFiles(CONTENT_DIR, 'use-of-english', '.json')) {
    count++;
    const issues: string[] = [];
    let status = '?';
    try {
      assertLanguage(id, language, filePath);
      const set = UoeSet.parse(JSON.parse(readFileSync(filePath, 'utf8')));
      status = set.status;
      if (set.status === 'published') published++;
      issues.push(...checkUoeSet(set, { id, level }));
    } catch (error) {
      issues.push(
        error instanceof z.ZodError
          ? error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join(' · ')
          : error instanceof Error
            ? error.message
            : String(error),
      );
    }
    console.log(`${issues.length > 0 ? '✗' : '✓'} ${id}  (use of english · ${status})`);
    for (const message of issues) console.log(`    ✗ ${message}`);
    errors += issues.length;
  }
  return { count, published, errors };
}

/**
 * Consignas de writing: esquema, longitudes y que la respuesta modelo pase la misma revisión
 * automática que se le hace al usuario (si no la pasa, o está mal o la revisión se equivoca).
 */
function checkWriting(): { count: number; errors: number } {
  let count = 0;
  let errors = 0;
  for (const { language, level, id, path: filePath } of listLevelFiles(CONTENT_DIR, 'writing', '.json')) {
    count++;
    const issues: string[] = [];
    let status = '?';
    try {
      assertLanguage(id, language, filePath);
      const prompt = WritingPrompt.parse(
        JSON.parse(readFileSync(filePath, 'utf8')),
      );
      status = prompt.status;
      issues.push(...checkWritingPrompt(prompt, { id, level }));
      const review = reviewText(prompt.model_answer, {
        language,
        level: prompt.level,
        taskType: prompt.task_type,
        wordsMin: prompt.words_min,
        wordsMax: prompt.words_max,
      });
      for (const hint of review.hints) {
        if (hint.severity === 'check') continue;
        issues.push(`respuesta modelo: «${hint.match}» (${hint.rule})`);
      }
      for (const check of review.checks) {
        if (!check.ok && check.id !== 'length') {
          issues.push(`respuesta modelo: no pasa la comprobación «${check.id}»`);
        }
      }
    } catch (error) {
      issues.push(
        error instanceof z.ZodError
          ? error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join(' · ')
          : error instanceof Error
            ? error.message
            : String(error),
      );
    }
    console.log(`${issues.length > 0 ? '✗' : '✓'} ${id}  (writing · ${status})`);
    for (const message of issues) console.log(`    ✗ ${message}`);
    errors += issues.length;
  }
  return { count, errors };
}

const describe = (error: unknown): string =>
  error instanceof z.ZodError
    ? error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join(' · ')
    : error instanceof Error
      ? error.message
      : String(error);

/** Ejercicios de pronunciación: esquema, id coherente con el nivel e ítems sin repetir. */
/** Simulacros de examen: cada prueba con las partes y preguntas del examen oficial. */
async function checkExams(offline: boolean): Promise<{ count: number; errors: number }> {
  let count = 0;
  let errors = 0;
  for (const { language, level, id, path: filePath } of listLevelFiles(CONTENT_DIR, 'exams', '.json')) {
    count++;
    const issues: string[] = [];
    let status = '?';
    try {
      assertLanguage(id, language, filePath);
      const paper = ExamPaper.parse(
        JSON.parse(readFileSync(filePath, 'utf8')),
      );
      status = paper.status;
      issues.push(...checkExamPaper(paper, { id, level }));
      if (paper.paper === 'listening' && paper.status === 'published') {
        for (const recording of paper.parts.flatMap(partRecordings)) {
          if (!recording.audio) {
            issues.push(`grabación ${recording.id}: sin audio (pnpm content:exam-audio --ids ${id})`);
          } else if (!offline) {
            const problem = await audioResponds(recording.audio.src);
            if (problem) issues.push(`grabación ${recording.id}: ${problem}`);
          }
        }
      }
    } catch (error) {
      issues.push(describe(error));
    }
    console.log(`${issues.length > 0 ? '✗' : '✓'} ${id}  (examen · ${status})`);
    for (const message of issues) console.log(`    ✗ ${message}`);
    errors += issues.length;
  }
  return { count, errors };
}

function checkPronunciation(): { count: number; errors: number } {
  let count = 0;
  let errors = 0;
  for (const { language, level, id, path: filePath } of listLevelFiles(CONTENT_DIR, 'pronunciation', '.json')) {
    count++;
    const issues: string[] = [];
    let status = '?';
    try {
      assertLanguage(id, language, filePath);
      const set = PronunciationSet.parse(
        JSON.parse(readFileSync(filePath, 'utf8')),
      );
      status = set.status;
      if (set.id !== id) issues.push(`el id ${set.id} no coincide con el fichero`);
      if (set.level.toLowerCase() !== level) issues.push(`está en la carpeta de otro nivel`);
      issues.push(...checkPronunciationSet(set));
    } catch (error) {
      issues.push(describe(error));
    }
    console.log(`${issues.length > 0 ? '✗' : '✓'} ${id}  (pronunciación · ${status})`);
    for (const message of issues) console.log(`    ✗ ${message}`);
    errors += issues.length;
  }
  return { count, errors };
}

/**
 * Mazo de palabras por idioma y nivel: esquema, sin repetidas, el ejemplo contiene la palabra y,
 * en inglés, cada palabra está en las listas abiertas de las que sale el mazo. Los demás idiomas
 * aún no tienen listas abiertas: sus niveles salen del propio mazo (build-index).
 */
function checkDictionary(lists: WordLists): { count: number; errors: number } {
  let count = 0;
  let errors = 0;
  for (const { language, dir } of contentDirs(CONTENT_DIR, 'dictionary')) {
    const seen = new Map<string, string>();
    for (const file of readdirSync(dir).sort()) {
      if (!file.endsWith('.json')) continue;
      const label = language === BASE_LANGUAGE ? file : `${language}/${file}`;
      const issues: string[] = [];
      let size = 0;
      try {
        const dictionary = DictionaryFile.parse(JSON.parse(readFileSync(path.join(dir, file), 'utf8')));
        size = dictionary.entries.length;
        if (`${dictionary.level.toLowerCase()}.json` !== file) {
          issues.push(`el nivel ${dictionary.level} no coincide con el fichero`);
        }
        issues.push(...checkDictionaryFile(dictionary));
        for (const entry of dictionary.entries) {
          const key = lemmaKey(entry.lemma);
          const other = seen.get(key);
          if (other) issues.push(`«${entry.lemma}» ya está en ${other}`);
          seen.set(key, file);
          // Las listas del pipeline solo guardan palabras sueltas; las expresiones no se comprueban.
          if (language === BASE_LANGUAGE && !key.includes(' ') && !lists.levels.has(key)) {
            issues.push(`«${entry.lemma}» no está en las listas`);
          }
        }
      } catch (error) {
        issues.push(describe(error));
      }
      count += size;
      console.log(`${issues.length > 0 ? '✗' : '✓'} ${label}  (palabras · ${size})`);
      for (const message of issues.slice(0, 20)) console.log(`    ✗ ${message}`);
      if (issues.length > 20) console.log(`    ✗ … y ${issues.length - 20} más`);
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

  for (const { file, relativePath, contentPath, id, language } of files) {
    let input: unknown;
    try {
      input = readJson(file);
    } catch (error) {
      console.log(`✗ ${id}\n    JSON no válido: ${error instanceof Error ? error.message : error}`);
      errorCount++;
      continue;
    }

    const previous = values.against
      ? atRef(values.against, `content/${contentPath}`)
      : undefined;
    const report = checkLesson(input, lists, { relativePath, previous });
    if (languageOfId(id) !== language) {
      report.errors.push(`el id «${id}» no es de la carpeta de ${language} (ADR-0035)`);
    }

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
  const uoe = checkUseOfEnglish();
  errorCount += uoe.errors;
  const writing = checkWriting();
  errorCount += writing.errors;
  const pronunciation = checkPronunciation();
  errorCount += pronunciation.errors;
  const dictionary = checkDictionary(lists);
  errorCount += dictionary.errors;
  const exams = await checkExams(values.offline);
  errorCount += exams.errors;

  console.log(
    `\n${files.length} lección(es): ${published.length} publicada(s) · ${fichas.count} ficha(s) de gramática · ${uoe.count} ejercicio(s) de Use of English · ${writing.count} consigna(s) de writing · ${pronunciation.count} ejercicio(s) de pronunciación · ${dictionary.count} palabra(s) del mazo · ${exams.count} prueba(s) de examen · ${errorCount} error(es) · ${warningCount} aviso(s).`,
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
