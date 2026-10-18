// Contenido de prueba para los tests e2e: `tsx tests/support/build-fixture-content.ts`
//
// Copia a .e2e/content un conjunto FIJO de lecciones (así añadir contenido real no cambia lo
// que ven los tests) y pasa la lección de escucha por el pipeline real
// (tts → audio → upload --local → index → validate) con un TTS de prueba que genera tonos.
// De paso se ejercita el pipeline entero (ffmpeg incluido) sin cuentas ni red.
//
// El audio de prueba vive aparte del real: su caché en .e2e/audio-cache y sus ficheros en
// public/dev-audio/e2e (la app de los tests usa NEXT_PUBLIC_AUDIO_BASE_URL=/dev-audio/e2e).
import { execFileSync } from 'node:child_process';
import {
  cpSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const FIXTURE_DIR = path.join(ROOT, '.e2e', 'content');
const LISTENING = 'b1-lis-001';
/** Lo único que ven los tests, por mucho que crezca content/. */
const LESSONS = new Set(['b1-rea-001', LISTENING]);
const USE_OF_ENGLISH = new Set(['b2-uoe-001', 'b2-uoe-002', 'b2-uoe-003', 'b2-uoe-004']);
const WRITING = new Set(['a1-wri-001', 'b1-wri-001', 'b1-wri-004', 'b2-wri-001', 'b2-wri-005']);
const PRONUNCIATION = new Set(['a1-pro-001', 'b1-pro-002']);
const EXAM_LISTENING = 'b2-exam-01-listening';
const EXAMS = new Set(['b2-exam-01-reading', EXAM_LISTENING, 'b2-exam-01-speaking']);
/** La única ficha de español: la que permite elegir el idioma que se practica. */
const SPANISH_FICHA = 'es.a1.ser-estar';

/** Mazo de palabras de prueba: pequeño y fijo, con y sin frecuencia para probar el orden. */
const DICTIONARY = {
  b1: [
    ['achieve', 'verb', 'lograr, conseguir', 'She worked hard to achieve her goal.', 500],
    ['advice', 'noun', 'consejo', 'Can you give me some advice?', 900],
    ['although', 'conjunction', 'aunque', 'Although it rained, we went out.', null],
    ['attend', 'verb', 'asistir a', 'Did you attend the meeting?', null],
    ['avoid', 'verb', 'evitar', 'Try to avoid the city centre.', 700],
  ],
  b2: [
    ['absurd', 'adjective', 'absurdo', 'What an absurd idea!', null],
    ['acid', 'noun', 'ácido', 'Lemon juice contains acid.', null],
  ],
} as const;

const env = {
  ...process.env,
  CONTENT_DIR: FIXTURE_DIR,
  TTS_PROVIDER: 'fake',
  AUDIO_CACHE_DIR: path.join(ROOT, '.e2e', 'audio-cache'),
  LOCAL_AUDIO_DIR: path.join(ROOT, 'public', 'dev-audio', 'e2e'),
};

/** Ejecuta un script del pipeline con el mismo Node, sin pasar por una shell. */
function script(name: string, args: string[] = []): void {
  execFileSync(
    process.execPath,
    [require.resolve('tsx/cli'), `scripts/content/${name}.ts`, ...args],
    {
      cwd: ROOT,
      env,
      stdio: 'inherit',
    },
  );
}

/** Borra de una carpeta (recursivamente) los `.json` cuyo nombre no esté en la lista. */
function keepOnly(dir: string, ids: ReadonlySet<string>): void {
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return; // la carpeta aún no existe en content/
  }
  for (const entry of entries) {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) keepOnly(full, ids);
    else if (entry.endsWith('.json') && !ids.has(entry.slice(0, -'.json'.length))) rmSync(full);
  }
}

rmSync(path.join(ROOT, '.e2e'), { recursive: true, force: true });
rmSync(env.LOCAL_AUDIO_DIR, { recursive: true, force: true });
cpSync(path.join(ROOT, 'content'), FIXTURE_DIR, { recursive: true });
keepOnly(path.join(FIXTURE_DIR, 'lessons'), LESSONS);
keepOnly(path.join(FIXTURE_DIR, 'use-of-english'), USE_OF_ENGLISH);
keepOnly(path.join(FIXTURE_DIR, 'writing'), WRITING);
keepOnly(path.join(FIXTURE_DIR, 'pronunciation'), PRONUNCIATION);
keepOnly(path.join(FIXTURE_DIR, 'exams'), EXAMS);

rmSync(path.join(FIXTURE_DIR, 'dictionary'), { recursive: true, force: true });
mkdirSync(path.join(FIXTURE_DIR, 'dictionary'), { recursive: true });
for (const [level, words] of Object.entries(DICTIONARY)) {
  const entries = words.map(([lemma, pos, es, example, rank]) => {
    // La palabra tal como está en la frase («Although» a principio de frase).
    const at = example.toLowerCase().indexOf(lemma);
    return {
      lemma,
      pos: [pos],
      es,
      example,
      surface: example.slice(at, at + lemma.length),
      ...(rank ? { rank } : {}),
    };
  });
  writeFileSync(
    path.join(FIXTURE_DIR, 'dictionary', `${level}.json`),
    `${JSON.stringify({ level: level.toUpperCase(), entries }, null, 2)}\n`,
  );
}

const file = path.join(FIXTURE_DIR, 'lessons', 'b1', 'listening', `${LISTENING}.json`);
type Fixture = {
  status: string;
  provenance: Record<string, unknown>;
  audio: Record<string, unknown>;
};
const read = () => JSON.parse(readFileSync(file, 'utf8')) as Fixture;

script('tts', ['--ids', LISTENING]);
script('audio', ['--ids', LISTENING]);
script('upload', ['--ids', LISTENING, '--local']);

// La lección de prueba se «publica» aquí. El audio son tonos, pero el esquema solo admite
// proveedores reales, así que en este contenido de prueba (y solo en él) se etiqueta como azure.
const lesson = read();
lesson.status = 'published';
lesson.provenance.reviewed_by = 'fixture de tests e2e';
lesson.audio.provider = 'azure';
writeFileSync(file, `${JSON.stringify(lesson, null, 2)}\n`);

script('annotate', ['--ids', LISTENING]);

// El Listening del simulacro pasa por su propio pipeline, también con tonos en vez de voz.
script('exam-audio', ['--ids', EXAM_LISTENING]);
script('upload', ['--ids', EXAM_LISTENING, '--local']);
const examFile = path.join(FIXTURE_DIR, 'exams', 'b2', `${EXAM_LISTENING}.json`);
const exam = JSON.parse(readFileSync(examFile, 'utf8')) as { status: string };
exam.status = 'published';
writeFileSync(examFile, `${JSON.stringify(exam, null, 2)}\n`);

// Un segundo idioma (ADR-0036): con una ficha de español ya se puede elegir qué se practica. Va
// con el formato de los idiomas nuevos: ayudas por idioma de interfaz y cuerpo en inglés.
// El contenido real de español (content/es) no entra entero en los tests: una ficha de prueba, una
// consigna y el mazo, así que añadir contenido real no cambia lo que ven.
rmSync(path.join(FIXTURE_DIR, 'es'), { recursive: true, force: true });
for (const file of ['writing/a1/es-a1-wri-001.json', 'dictionary/a1.json']) {
  mkdirSync(path.dirname(path.join(FIXTURE_DIR, 'es', file)), { recursive: true });
  cpSync(path.join(ROOT, 'content', 'es', file), path.join(FIXTURE_DIR, 'es', file));
}
const spanishDir = path.join(FIXTURE_DIR, 'es', 'grammar', 'a1');
mkdirSync(spanishDir, { recursive: true });
writeFileSync(
  path.join(spanishDir, `${SPANISH_FICHA}.mdx`),
  `---
id: ${SPANISH_FICHA}
level: A1
title: "Ser y estar"
summary_es:
  en: "Two verbs for 'to be': ser for what something is, estar for where and how it is."
  fr: "Deux verbes pour « être » : ser pour ce qu’est une chose, estar pour où et comment elle est."
body_locale: en
skills: [reading]
related: []
examples:
  - text: "Soy de Madrid."
    translation:
      en: "I am from Madrid."
      fr: "Je suis de Madrid."
  - text: "Estoy en casa."
    translation:
      en: "I am at home."
practice:
${[
  ['Yo ___ de Sevilla.', 'soy', 'Where you are from: ser.'],
  ['Ana ___ en el parque.', 'está', 'Where someone is: estar.'],
  ['Nosotros ___ estudiantes.', 'somos', 'What someone is: ser.'],
  ['¿Cómo ___ tú hoy?', 'estás', 'How someone feels: estar.'],
  ['La casa ___ grande.', 'es', 'What something is like: ser.'],
]
  .map(
    ([prompt, answer, rule], i) =>
      `  - id: p${i + 1}\n    prompt: "${prompt}"\n    answers: ["${answer}"]\n    rule_es:\n      en: "${rule}"`,
  )
  .join('\n')}
---

## In one sentence

Spanish has two verbs for *to be*: **ser** for what something is, **estar** for where and how it is.

## Form

*Ser*: soy, eres, es, somos, sois, son. *Estar*: estoy, estás, está, estamos, estáis, están.

## Use

*Ser* for origin, jobs and descriptions; *estar* for places and moods.

## Contrast with English

English uses one verb, *to be*, for both.

## Common mistakes

*Soy en casa* → *Estoy en casa*.

## How it sounds

*Está* carries the stress on the last syllable.
`,
);

script('build-index');
script('validate', ['--offline']);
console.log('\nContenido de prueba listo en .e2e/content');
