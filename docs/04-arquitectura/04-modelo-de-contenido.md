# Modelo de contenido

> **Propósito:** el contrato de datos de las lecciones. Todo el contenido (escrito a mano, generado o de dominio público) cumple estos esquemas Zod; la app y el pipeline dependen de ellos.
> **Relacionado:** [Pipeline](../05-contenido/01-pipeline.md) · [Control de calidad](../05-contenido/02-control-de-calidad.md) · [Ejemplos](../05-contenido/ejemplos/README.md) · [ADR-0003](../adr/0003-contenido-como-codigo.md)

---

## 1. Dos capas: borrador y lección publicada

| Capa | Quién la produce | Qué contiene |
|---|---|---|
| **`LessonDraft`** | Tú o la IA (vía pipeline) | Texto (segmentos o párrafos), hablantes, tareas con claves y justificación, glosario, rasgos de habla conectada, metadatos pedagógicos |
| **`Lesson`** (publicada) | El pipeline (`annotate` + `tts` + `audio` + `review`) | Borrador + tokens con lema/POS, tiempos por palabra, audio (URL, duración, picos de onda), lista de lemas, dificultad calculada e informe de calidad |

Ficheros: `content/lessons/{nivel}/{listening|reading}/{id}.json`. El estado (`draft` → `reviewed` → `published`) está dentro del JSON; la app solo muestra `published`.

**Por idioma (ADR-0035).** El inglés está en la raíz de `content/` y sus ids no llevan prefijo. Cada otro idioma tiene su carpeta con la misma estructura (`content/es/lessons/a1/reading/es-a1-rea-001.json`, `content/es/units.json`…) y sus ids llevan el idioma delante: `es-a1-rea-001`, `es-a1-u01`, `es.a1.ser-estar`. Un archivo tiene que estar en la carpeta del idioma de su id; los cargadores, el índice y `pnpm content:validate` lo comprueban.

---

## 2. Esquemas (Zod v4)

`src/lib/content/schema.ts`:

Los campos `*_es` son **ayudas** (traducciones, explicaciones, resúmenes…), no lo que se aprende. Con `helpText()` (`src/lib/content/help.ts`, ADR-0034) cada uno admite una cadena —el contenido de inglés, con las ayudas en español— o un objeto con una ayuda por idioma de interfaz (`{ en, es?, fr?, zh?, ja? }`, el inglés obligatorio). Los cargadores las resuelven al idioma de la interfaz antes de que lleguen a las pantallas; los tipos que usan las pantallas son los ya resueltos (`Localized<…>`) y los de los archivos llevan delante `Raw`.

```ts
import { z } from 'zod';
import { helpText, type Localized } from './help';

// ───────────── Enumeraciones ─────────────
export const Cefr = z.enum(['A1', 'A2', 'B1', 'B2', 'C1', 'C2']);
export const Accent = z.enum([
  'en-US', 'en-GB', 'en-AU', 'en-IE', 'en-CA', 'en-IN', 'en-NZ', 'en-ZA', 'en-NG', 'en-SG',
  'en-GB-scotland', 'other',
]);
export const Topic = z.enum([
  'daily-life', 'work-tech', 'science-space', 'games', 'music', 'travel', 'food', 'health',
  'environment', 'society', 'media', 'education', 'sports', 'money', 'relationships',
  'history', 'city-housing', 'nature', 'culture', 'language',
]);
export const ListeningGenre = z.enum([
  'dialogue', 'monologue', 'interview', 'podcast', 'announcement', 'voicemail',
  'lecture', 'news', 'discussion', 'story',
]);
export const ReadingGenre = z.enum([
  'article', 'story', 'email', 'blog', 'review', 'report', 'essay', 'notice',
  'instructions', 'opinion', 'interview', 'guide', 'forum',
]);
export const Focus = z.enum([
  'gist', 'detail', 'inference', 'reference', 'vocab_in_context',
  'purpose_function', 'attitude_opinion', 'text_structure',
  'decoding', // dictado y drills: reconocer lo que suena
]);
export const Phase = z.enum(['pre', 'listen_1', 'listen_2', 'skim', 'read', 'post']);
export const ConnectedSpeechType = z.enum([
  'weak_form', 'contraction', 'linking', 'elision', 'assimilation',
  'reduction', 'flap', 'glottal_stop', 'intrusion',
]);
export const ContentStatus = z.enum(['draft', 'reviewed', 'published']);
export const GlossaryPos = z.enum(['noun', 'verb', 'adjective', 'adverb', 'phrasal_verb', 'phrase', 'other']);

// ───────────── Identificadores ─────────────
export const LessonId = z.string().regex(/^(a1|a2|b1|b2|c1|c2)-(lis|rea)-\d{3}$/);
export const UnitId = z.string().regex(/^(a1|a2|b1|b2|c1|c2)-u\d{2}$/);
export const CanDoId = z.string().regex(/^[LRWS]-(A1|A2|B1|B2|C1|C2)-\d{2}$/);
export const GrammarId = z.string().regex(/^(a1|a2|b1|b2|c1|c2)\.[a-z0-9-]+$/);
export const SegmentId = z.string().regex(/^s\d{1,3}$/);          // s1, s2…
export const ParagraphId = z.string().regex(/^p\d{1,2}$/);        // p1, p2…
export const SentenceId = z.string().regex(/^p\d{1,2}s\d{1,2}$/); // p1s1 = párrafo 1, frase 1
export const TaskId = z.string().regex(/^q\d{1,2}$/);
export const OptionId = z.string().regex(/^[a-h1-9]$/);

// ───────────── Piezas comunes ─────────────
export const GlossaryEntry = z.object({
  lemma: z.string().min(1),           // forma de diccionario
  surface: z.string().min(1),         // tal como aparece en el texto
  pos: GlossaryPos,
  def_en: z.string().min(1),          // definición en inglés sencillo (≤ nivel de la lección)
  def_es: helpText(),                 // traducción o explicación breve (ayuda)
  example: z.string().optional(),     // otra frase de ejemplo
  cefr: Cefr.optional(),
  ref: z.string().min(1),             // segmento o frase donde aparece
  note_es: helpText().optional(),     // p. ej. «inglés británico; en EE. UU.: parking lot»
});

export const ConnectedSpeechFeature = z.object({
  ref: z.string().min(1),             // segmento o frase
  phrase: z.string().min(1),          // fragmento literal del texto
  type: ConnectedSpeechType,
  ipa: z.string().optional(),
  explanation_es: helpText(),
});

export const Speaker = z.object({
  id: z.string().regex(/^[a-z][a-z0-9_]*$/),
  name: z.string().min(1),
  accent: Accent,
  gender: z.enum(['female', 'male', 'neutral']),
  voice: z.string().optional(),       // voz TTS concreta; el pipeline la asigna si falta
  style: z.string().optional(),       // estilo SSML opcional (p. ej. 'cheerful')
});

// ───────────── Tareas ─────────────
const Option = z.object({ id: OptionId, text: z.string().min(1) });

const TaskBase = z.object({
  id: TaskId,
  focus: Focus,
  phase: Phase,
  prompt: z.string().min(1),               // enunciado (en true_false_ng, la afirmación)
  evidence: z.array(z.string()).min(1),    // segmentos/frases/párrafos con la respuesta
  rationale_es: helpText(),                // por qué es correcta y dónde está la trampa
  difficulty_offset: z.number().optional(),// ajuste manual sobre la dificultad calculada
});

export const McqTask = TaskBase.extend({
  type: z.literal('mcq'),
  options: z.array(Option).min(3).max(4),
  answer: OptionId,
});
export const MultiSelectTask = TaskBase.extend({
  type: z.literal('multi_select'),
  options: z.array(Option).min(4).max(6),
  answers: z.array(OptionId).min(2),
});
export const TrueFalseTask = TaskBase.extend({
  type: z.literal('true_false_ng'),
  answer: z.enum(['T', 'F', 'NG']),
  allow_ng: z.boolean().default(true),     // false en A1–A2
});
export const GapFillTask = TaskBase.extend({
  type: z.literal('gap_fill'),
  text: z.string().min(1),                 // huecos marcados {{1}}, {{2}}…
  gaps: z.array(z.object({
    n: z.number().int().positive(),
    accept: z.array(z.string().min(1)).min(1),
    max_words: z.number().int().positive().default(3),
  })).min(1),
});
export const MatchingTask = TaskBase.extend({
  type: z.literal('matching'),
  left: z.array(Option).min(2),            // p. ej. hablantes 1–5
  right: z.array(Option).min(2),           // p. ej. opiniones a–h (puede haber sobrantes)
  pairs: z.record(z.string(), z.string()), // left.id → right.id
});
export const OrderingTask = TaskBase.extend({
  type: z.literal('ordering'),
  items: z.array(Option).min(3),
  correct_order: z.array(OptionId).min(3),
});
export const ShortAnswerTask = TaskBase.extend({
  type: z.literal('short_answer'),
  accept: z.array(z.string().min(1)).min(1),
  max_words: z.number().int().positive().default(4),
});
export const DictationTask = TaskBase.extend({
  type: z.literal('dictation'),
  segment: SegmentId,                      // segmento a dictar
  reference: z.string().min(1),            // texto exacto esperado
  accept_variants: z.array(z.string()).default([]),
});
export const HeadingMatchTask = TaskBase.extend({
  type: z.literal('heading_match'),
  paragraphs: z.array(ParagraphId).min(2),
  headings: z.array(Option).min(3),
  answers: z.record(z.string(), z.string()), // paragraph id → heading id
});

export const Task = z.discriminatedUnion('type', [
  McqTask, MultiSelectTask, TrueFalseTask, GapFillTask, MatchingTask,
  OrderingTask, ShortAnswerTask, DictationTask, HeadingMatchTask,
]);
export type RawTask = z.infer<typeof Task>;
export type Task = Localized<RawTask>;

// ───────────── Borrador ─────────────
const Provenance = z.object({
  origin: z.enum(['human', 'ai', 'public-domain']),
  model: z.string().optional(),
  prompt_version: z.string().optional(),
  spec: z.string().optional(),
  created_at: z.string(),                  // ISO 8601
  reviewed_by: z.string().optional(),
  source_url: z.string().url().optional(),
  license: z.string().optional(),
});

const DraftBase = z.object({
  id: LessonId,
  version: z.number().int().positive(),
  status: ContentStatus,
  level: Cefr,
  unit: UnitId,
  series: z.string().min(1),
  title: z.string().min(1),
  summary_es: helpText(),
  topic: Topic,
  tags: z.array(z.string()).default([]),
  can_do: z.array(CanDoId).min(1),
  grammar_focus: z.array(GrammarId).default([]),
  vocab_focus: z.array(z.string()).default([]),
  est_minutes: z.number().int().positive(),
  prediction_prompt: z.string().optional(),
  pre_teach: z.array(z.string()).max(5).default([]),
  glossary: z.array(GlossaryEntry),
  tasks: z.array(Task).min(1),
  provenance: Provenance,
});

export const DraftSegment = z.object({
  id: SegmentId,
  speaker: z.string().min(1),
  text: z.string().min(1),
  pause_after_ms: z.number().int().nonnegative().optional(),
});

export const DraftSentence = z.object({ id: SentenceId, text: z.string().min(1) });
export const DraftParagraph = z.object({ id: ParagraphId, sentences: z.array(DraftSentence).min(1) });

export const ListeningDraft = DraftBase.extend({
  skill: z.literal('listening'),
  genre: ListeningGenre,
  speakers: z.array(Speaker).min(1).max(5),
  target_wpm: z.number().int().min(80).max(240),
  segments: z.array(DraftSegment).min(2),
  connected_speech: z.array(ConnectedSpeechFeature).default([]),
});

export const ReadingDraft = DraftBase.extend({
  skill: z.literal('reading'),
  genre: ReadingGenre,
  paragraphs: z.array(DraftParagraph).min(1),
  language_focus: z.array(z.object({
    title_es: helpText(),
    explanation_es: helpText(),
    refs: z.array(z.string()).min(1),
  })).default([]),
  with_audio: z.boolean().default(true),
});

export const LessonDraft = z.discriminatedUnion('skill', [ListeningDraft, ReadingDraft]);
export type LessonDraft = z.infer<typeof LessonDraft>;

// ───────────── Publicada (enriquecida por el pipeline) ─────────────
export const Token = z.object({
  t: z.string(),                 // forma superficial
  l: z.string(),                 // lema en minúsculas
  p: z.string(),                 // categoría (UPOS): NOUN, VERB, ADP…
  w: z.boolean(),                // ¿cuenta para la cobertura? (no puntuación/número/nombre propio)
  sp: z.boolean().optional(),    // ¿espacio después?
  s: z.number().optional(),      // inicio en el audio (s)
  e: z.number().optional(),      // fin en el audio (s)
});

export const AudioInfo = z.object({
  src: z.string().min(1),                        // 'audio/b1/b1-lis-001/v1.m4a'
  duration_s: z.number().positive(),
  wpm: z.number().positive(),
  provider: z.enum(['azure', 'kokoro', 'human', 'public-domain']),
  voices: z.record(z.string(), z.string()),      // speaker id → voz
  loudness_lufs: z.number().optional(),
  peaks: z.array(z.number().min(0).max(1)).max(400),
});

export const QaReport = z.object({
  coverage_by_level: z.partialRecord(Cefr, z.number()), // % tokens contables de nivel ≤ X
  off_level_lemmas: z.array(z.string()),
  avg_sentence_words: z.number(),
  flesch_reading_ease: z.number().optional(),
  reviewer: z.object({
    model: z.string(),
    level_ok: z.boolean(),
    answerable_with_text: z.number(),            // 0..1
    answerable_without_text: z.number(),         // 0..1 (debe ser bajo)
    issues: z.array(z.string()),
    score: z.number().min(0).max(10),
  }).optional(),
  checked_at: z.string(),
});

export const TimedSegment = DraftSegment.extend({
  start: z.number().nonnegative(),
  end: z.number().positive(),
  tokens: z.array(Token).min(1),
});

export const PublishedListening = ListeningDraft.extend({
  segments: z.array(TimedSegment).min(2),
  audio: AudioInfo,
  lemmas: z.array(z.string()),                   // lemas contables únicos (cobertura)
  difficulty: z.number(),
  qa: QaReport,
});

export const PublishedReading = ReadingDraft.extend({
  paragraphs: z.array(z.object({
    id: ParagraphId,
    sentences: z.array(DraftSentence.extend({
      tokens: z.array(Token).min(1),
      start: z.number().optional(),              // si hay audio sincronizado por frase
      end: z.number().optional(),
    })).min(1),
  })).min(1),
  word_count: z.number().int().positive(),
  audio: AudioInfo.optional(),
  lemmas: z.array(z.string()),
  difficulty: z.number(),
  qa: QaReport,
});

export const Lesson = z.discriminatedUnion('skill', [PublishedListening, PublishedReading]);
export type RawLesson = z.infer<typeof Lesson>;
export type Lesson = Localized<RawLesson>;

// ───────────── Índice (content/index.generated.json) ─────────────
export const LessonMeta = z.object({
  id: LessonId,
  version: z.number().int().positive(),
  skill: z.enum(['listening', 'reading']),
  level: Cefr,
  unit: UnitId,
  series: z.string(),
  title: z.string(),
  summary_es: helpText(z.string()),  // una línea para la tarjeta de la biblioteca
  topic: Topic,
  genre: z.string(),
  accents: z.array(Accent),          // vacío en lectura sin audio
  duration_s: z.number().optional(),
  word_count: z.number().int(),
  wpm: z.number().optional(),
  est_minutes: z.number().int(),
  difficulty: z.number(),
  lemmas: z.array(z.string()),
  path: z.string(),                  // ruta relativa del JSON
});
export type RawLessonMeta = z.infer<typeof LessonMeta>;
export type LessonMeta = Localized<RawLessonMeta>;
```

---

## 3. Invariantes (las comprueba `scripts/content/validate.ts`)

Más allá del esquema, cada lección debe cumplir:

| # | Regla |
|---|---|
| I-1 | El `id` coincide con el nombre del fichero y con su carpeta (`b1/listening/b1-lis-001.json`); el prefijo coincide con `level` y `skill`. |
| I-2 | IDs de tareas, segmentos, párrafos y frases son **únicos** dentro de la lección. |
| I-3 | Toda `evidence`, `ref` y `segment` apunta a un elemento existente. |
| I-4 | `answer`/`answers`/`pairs`/`correct_order` usan IDs de opción existentes; `correct_order` es una permutación de `items`. |
| I-5 | Fases coherentes con la destreza: listening → `pre`, `listen_1`, `listen_2`, `post`; reading → `pre`, `skim`, `read`, `post`. |
| I-6 | Cada `speaker` de un segmento existe en `speakers`. |
| I-7 | Cada `phrase` de `connected_speech` y cada `surface` del glosario aparecen literalmente (sin distinguir mayúsculas) en el texto de su `ref`. |
| I-8 | En `gap_fill`, el número de marcas `{{n}}` en `text` coincide con `gaps`. |
| I-9 | En publicadas: tiempos crecientes, `start < end`, tokens dentro de su segmento y `audio.duration_s ≥` último `end`. |
| I-10 | `lemmas` ordenados y sin duplicados; coinciden con los tokens `w = true`. |
| I-11 | Si `status = 'published'`: existe `qa`, `qa.reviewer.answerable_without_text ≤ 0.4` y el audio responde (`HEAD` 200 en R2). |
| I-12 | La `version` sube si cambia el texto o las tareas de una lección ya publicada (lo comprueba el CI comparando con `main`). |

---

## 4. Esquema para la IA (`LessonDraftLLM`)

La API de Claude con **salidas estructuradas** garantiza JSON válido según un esquema, pero el esquema tiene límites: sin restricciones numéricas ni de longitud (los *helpers* del SDK las pasan a la descripción y validan después), **como máximo 24 parámetros opcionales** y **16 con uniones** en total por petición, y el *casing* de los `enum` no está garantizado al 100 %.

Por eso la IA **no** rellena `LessonDraft` directamente, sino un esquema reducido:

- **Todo obligatorio** (sin `.optional()` ni `.default()`): si no aplica, cadena o lista vacía.
- Sin metadatos que ya conoce el script (`id`, `version`, `status`, `level`, `unit`, `can_do`, `provenance`…).
- **Un esquema por destreza** y solo los tipos de tarea que pide la especificación.
- Validación final con el esquema completo tras transformar.

```ts
// scripts/content/lib/llm-schemas.ts
import { z } from 'zod';
import { Accent, ConnectedSpeechType, Focus, GlossaryPos } from '../../../src/lib/content/schema';

const OptionLLM = z.object({ id: z.enum(['a', 'b', 'c', 'd']), text: z.string() });
const BaseLLM = {
  id: z.string(),                 // q1, q2…
  focus: Focus,
  phase: z.enum(['listen_1', 'listen_2', 'post']),
  prompt: z.string(),
  evidence: z.array(z.string()),
  rationale_es: z.string(),
};

export const ListeningDraftLLM = z.object({
  title: z.string(),
  summary_es: z.string(),
  prediction_prompt: z.string(),
  pre_teach: z.array(z.string()),
  speakers: z.array(z.object({
    id: z.string(), name: z.string(), accent: Accent, gender: z.enum(['female', 'male']),
  })),
  segments: z.array(z.object({ id: z.string(), speaker: z.string(), text: z.string() })),
  connected_speech: z.array(z.object({
    ref: z.string(), phrase: z.string(), type: ConnectedSpeechType, ipa: z.string(), explanation_es: z.string(),
  })),
  glossary: z.array(z.object({
    lemma: z.string(), surface: z.string(), pos: GlossaryPos, def_en: z.string(), def_es: z.string(),
    example: z.string(), ref: z.string(), note_es: z.string(),
  })),
  tasks: z.array(z.discriminatedUnion('type', [
    z.object({ ...BaseLLM, type: z.literal('mcq'), options: z.array(OptionLLM), answer: z.enum(['a', 'b', 'c', 'd']) }),
    z.object({ ...BaseLLM, type: z.literal('true_false_ng'), answer: z.enum(['T', 'F', 'NG']) }),
    z.object({ ...BaseLLM, type: z.literal('dictation'), segment: z.string(), reference: z.string() }),
  ])),
});
export type ListeningDraftLLM = z.infer<typeof ListeningDraftLLM>;
```

`toListeningDraft(llm, spec)` añade los metadatos de la especificación, normaliza mayúsculas de los `enum`, convierte cadenas vacías en ausencias y valida con `ListeningDraft`. Lo mismo para lectura (`ReadingDraftLLM` con `mcq`, `true_false_ng`, `heading_match`, `gap_fill`, `short_answer`).

---

## 5. Otros tipos de contenido

| Tipo | Ubicación | Esquema (resumen) |
|---|---|---|
| Ficha de gramática | `content/grammar/{nivel}/{id}.mdx` | *Frontmatter* (`GrammarMeta` en `src/lib/content/grammar-schema.ts`): `id`, `level`, `title`, `summary_es`, `skills[]`, `related[]`, `examples[]` (`{ en, es }` en las de inglés; en el contenido nuevo `{ text, translation }`, con la traducción por idioma de interfaz; las dos se leen como `text` y `translation`), `practice[]` (5 ítems `{ id, prompt con ___, answers[], rule_es }`) y `body_locale` (idioma del cuerpo, `es` por defecto); cuerpo MDX con secciones fijas en el idioma del cuerpo ([gramática](../01-pedagogia/06-gramatica.md#2-formato-de-una-ficha), `GRAMMAR_SECTIONS_BY_LOCALE`). Las versiones del cuerpo en otros idiomas de interfaz van al lado, en `{id}.{idioma}.mdx`, solo con el cuerpo (ADR-0034) |
| Use of English | `content/use-of-english/{nivel}/{id}.json` | `UoeSet` en `src/lib/content/uoe-schema.ts`: `id` (`b2-uoe-001`), `level`, `part` (`mcq_cloze`, `open_cloze`, `word_formation`, `key_word_transformation`), `title`, `summary_es`; texto con huecos `{{n}}` y `gaps[]`, o `items[]` con `keyword`, `before`, `after` y las dos mitades de la respuesta (`parts`); `explanation_es` en cada hueco ([ADR-0012](../adr/0012-use-of-english-y-nivel-declarado.md)) |
| Unidades | `content/units.json` | `{ [unitId]: título }`: nombre de cada unidad para agrupar las bibliotecas |
| Niveles de los lemas | `content/wordlists/levels.generated.json` | `{ A1: [lemas], … }`. Lo genera `pnpm content:index` a partir de las listas con licencia abierta; la app lo usa para saber qué palabras dar por conocidas según tu nivel. No se edita a mano |
| Consigna de writing | `content/writing/{nivel}/{id}.json` (`b2-wri-001`) | `id`, `version`, `status`, `level`, `task_type`, `title`, `topic`, `context_es`, `prompt_en`, `points[]`, `words_min`, `words_max`, `time_min`, `useful_language[]`, `tips_es[]`, `model_answer`, `provenance`. Esquema en `src/lib/content/writing-schema.ts`. La longitud y los tipos de texto permitidos dependen del nivel, y la respuesta modelo tiene que cumplir la longitud y pasar la revisión automática ([ADR-0014](../adr/0014-writing-revision-sin-ia.md)) |
| Mazo de palabras | `content/dictionary/{nivel}.json` (`b2.json`) | `DictionaryFile` en `src/lib/content/dictionary-schema.ts`: `level` y `entries[]` en orden alfabético, cada una con `lemma`, `pos[]`, `es` (traducción; acepciones separadas por `;`; en el contenido nuevo, `translation`, que admite una por idioma de interfaz, ADR-0034), `example`, `surface` (la palabra tal como sale en el ejemplo) y `rank` (posición en la NGSL, opcional). Los lemas y su nivel salen de `content/wordlists`; traducción y ejemplo son originales ([ADR-0015](../adr/0015-mazo-de-palabras-y-pronunciacion.md)) |
| Ejercicio de pronunciación | `content/pronunciation/{nivel}/{id}.json` (`a1-pro-001`) | `PronunciationSet` en `src/lib/content/pronunciation-schema.ts`: `id`, `version`, `status`, `level`, `title`, `summary_es`, `focus`, `sounds[]` (AFI), `tip_es` (cómo se hace el sonido), `est_minutes` e `items[]` (4–16) con `id`, `text`, `ipa`, `es` y `confusions[]` (`{ heard, tip_es }`: lo que el reconocedor suele oír cuando sale mal, y el consejo) |
| Prueba de simulacro de examen | `content/exams/{nivel}/{id}.json` (`b2-exam-01-reading`, `…-listening`, `…-speaking`) | `ExamPaper` en `src/lib/content/exam-schema.ts`: `id`, `version`, `status`, `level`, `paper` y `parts[]`. En Reading y Listening cada parte tiene `type` (`mcq`, `mcq_cloze`, `open_cloze`, `word_formation`, `key_word_transformation`, `gapped_text`, `matching`, `completion`, `writing`), `rubric` y sus preguntas, numeradas de corrido como en el cuadernillo, con `explanation_es`; las de Listening llevan `recording` (`speakers[]`, `segments[]` y, tras el pipeline, `audio { src, duration_s }`). En Speaking, cada parte tiene `kind`, `about_es`, `turns[]` (`examiner`, `shown`, `visuals[]`, `prompts[]`, `prep_s`, `answer_s`), `useful_language[]` y `tips_es[]`. Las partes, el número de preguntas y de opciones tienen que ser los del examen oficial (`src/lib/content/exam-formats.ts`); el validador lo comprueba ([ADR-0017](../adr/0017-simulacros-de-examen.md)) |
| Drill | `content/drills/{tipo}/{id}.json` | `id`, `type`, `level_min`, `items[]` con `{ text, target, options?, audio_src, start?, end? }` |
| Ítem de test | `content/placement/*.json`, `content/tests/{nivel}/*.json` | Como una lección mínima (1 clip/texto + 1–2 tareas) con `difficulty` fija |
| Extensiva | `content/extensive/{nivel}/{serie}/{n}.json` | Como `PublishedReading`/`PublishedListening` sin `tasks` (o con una sola de `gist`) |

---

## 6. Versionado

- `version` empieza en 1 y sube con cualquier cambio de texto, audio o tareas.
- El audio se publica con la versión en la ruta (`…/v2.m4a`): nunca se sobrescribe un fichero publicado (caché inmutable).
- `lesson_progress.lesson_version` registra qué versión hiciste; si la lección cambia, la app lo indica y permite repetirla sin perder el historial.
