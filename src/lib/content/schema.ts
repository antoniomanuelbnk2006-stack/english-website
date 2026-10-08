// Contrato de datos del contenido. Copia literal de docs/04-arquitectura/04-modelo-de-contenido.md §2:
// si cambia uno, cambia el otro.
import { z } from 'zod';

// ───────────── Enumeraciones ─────────────
export const Cefr = z.enum(['A1', 'A2', 'B1', 'B2', 'C1', 'C2']);
export const Accent = z.enum([
  'en-US',
  'en-GB',
  'en-AU',
  'en-IE',
  'en-CA',
  'en-IN',
  'en-NZ',
  'en-ZA',
  'en-NG',
  'en-SG',
  'en-GB-scotland',
  'other',
]);
export const Topic = z.enum([
  'daily-life',
  'work-tech',
  'science-space',
  'games',
  'music',
  'travel',
  'food',
  'health',
  'environment',
  'society',
  'media',
  'education',
  'sports',
  'money',
  'relationships',
  'history',
  'city-housing',
  'nature',
  'culture',
  'language',
]);
export const ListeningGenre = z.enum([
  'dialogue',
  'monologue',
  'interview',
  'podcast',
  'announcement',
  'voicemail',
  'lecture',
  'news',
  'discussion',
  'story',
]);
export const ReadingGenre = z.enum([
  'article',
  'story',
  'email',
  'blog',
  'review',
  'report',
  'essay',
  'notice',
  'instructions',
  'opinion',
  'interview',
  'guide',
  'forum',
]);
export const Focus = z.enum([
  'gist',
  'detail',
  'inference',
  'reference',
  'vocab_in_context',
  'purpose_function',
  'attitude_opinion',
  'text_structure',
  'decoding', // dictado y drills: reconocer lo que suena
]);
export const Phase = z.enum(['pre', 'listen_1', 'listen_2', 'skim', 'read', 'post']);
export const ConnectedSpeechType = z.enum([
  'weak_form',
  'contraction',
  'linking',
  'elision',
  'assimilation',
  'reduction',
  'flap',
  'glottal_stop',
  'intrusion',
]);
export const ContentStatus = z.enum(['draft', 'reviewed', 'published']);
export const GlossaryPos = z.enum([
  'noun',
  'verb',
  'adjective',
  'adverb',
  'phrasal_verb',
  'phrase',
  'other',
]);

// ───────────── Identificadores ─────────────
export const LessonId = z.string().regex(/^(a1|a2|b1|b2|c1|c2)-(lis|rea)-\d{3}$/);
export const UnitId = z.string().regex(/^(a1|a2|b1|b2|c1|c2)-u\d{2}$/);
export const CanDoId = z.string().regex(/^[LRWS]-(A1|A2|B1|B2|C1|C2)-\d{2}$/);
export const GrammarId = z.string().regex(/^(a1|a2|b1|b2|c1|c2)\.[a-z0-9-]+$/);
export const SegmentId = z.string().regex(/^s\d{1,3}$/); // s1, s2…
export const ParagraphId = z.string().regex(/^p\d{1,2}$/); // p1, p2…
export const SentenceId = z.string().regex(/^p\d{1,2}s\d{1,2}$/); // p1s1 = párrafo 1, frase 1
export const TaskId = z.string().regex(/^q\d{1,2}$/);
export const OptionId = z.string().regex(/^[a-h1-9]$/);

// ───────────── Piezas comunes ─────────────
export const GlossaryEntry = z.object({
  lemma: z.string().min(1), // forma de diccionario
  surface: z.string().min(1), // tal como aparece en el texto
  pos: GlossaryPos,
  def_en: z.string().min(1), // definición en inglés sencillo (≤ nivel de la lección)
  def_es: z.string().min(1), // traducción o explicación breve
  example: z.string().optional(), // otra frase de ejemplo
  cefr: Cefr.optional(),
  ref: z.string().min(1), // segmento o frase donde aparece
  note_es: z.string().optional(), // p. ej. «inglés británico; en EE. UU.: parking lot»
});

export const ConnectedSpeechFeature = z.object({
  ref: z.string().min(1), // segmento o frase
  phrase: z.string().min(1), // fragmento literal del texto
  type: ConnectedSpeechType,
  ipa: z.string().optional(),
  explanation_es: z.string().min(1),
});

export const Speaker = z.object({
  id: z.string().regex(/^[a-z][a-z0-9_]*$/),
  name: z.string().min(1),
  accent: Accent,
  gender: z.enum(['female', 'male', 'neutral']),
  voice: z.string().optional(), // voz TTS concreta; el pipeline la asigna si falta
  style: z.string().optional(), // estilo SSML opcional (p. ej. 'cheerful')
});

// ───────────── Tareas ─────────────
const Option = z.object({ id: OptionId, text: z.string().min(1) });

const TaskBase = z.object({
  id: TaskId,
  focus: Focus,
  phase: Phase,
  prompt: z.string().min(1), // enunciado (en true_false_ng, la afirmación)
  evidence: z.array(z.string()).min(1), // segmentos/frases/párrafos con la respuesta
  rationale_es: z.string().min(1), // por qué es correcta y dónde está la trampa
  difficulty_offset: z.number().optional(), // ajuste manual sobre la dificultad calculada
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
  allow_ng: z.boolean().default(true), // false en A1–A2
});
export const GapFillTask = TaskBase.extend({
  type: z.literal('gap_fill'),
  text: z.string().min(1), // huecos marcados {{1}}, {{2}}…
  gaps: z
    .array(
      z.object({
        n: z.number().int().positive(),
        accept: z.array(z.string().min(1)).min(1),
        max_words: z.number().int().positive().default(3),
      }),
    )
    .min(1),
});
export const MatchingTask = TaskBase.extend({
  type: z.literal('matching'),
  left: z.array(Option).min(2), // p. ej. hablantes 1–5
  right: z.array(Option).min(2), // p. ej. opiniones a–h (puede haber sobrantes)
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
  segment: SegmentId, // segmento a dictar
  reference: z.string().min(1), // texto exacto esperado
  accept_variants: z.array(z.string()).default([]),
});
export const HeadingMatchTask = TaskBase.extend({
  type: z.literal('heading_match'),
  paragraphs: z.array(ParagraphId).min(2),
  headings: z.array(Option).min(3),
  answers: z.record(z.string(), z.string()), // paragraph id → heading id
});

export const Task = z.discriminatedUnion('type', [
  McqTask,
  MultiSelectTask,
  TrueFalseTask,
  GapFillTask,
  MatchingTask,
  OrderingTask,
  ShortAnswerTask,
  DictationTask,
  HeadingMatchTask,
]);
export type Task = z.infer<typeof Task>;

// ───────────── Borrador ─────────────
const Provenance = z.object({
  origin: z.enum(['human', 'ai', 'public-domain']),
  model: z.string().optional(),
  prompt_version: z.string().optional(),
  spec: z.string().optional(),
  created_at: z.string(), // ISO 8601
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
  summary_es: z.string().min(1),
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
export const DraftParagraph = z.object({
  id: ParagraphId,
  sentences: z.array(DraftSentence).min(1),
});

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
  language_focus: z
    .array(
      z.object({
        title_es: z.string().min(1),
        explanation_es: z.string().min(1),
        refs: z.array(z.string()).min(1),
      }),
    )
    .default([]),
  with_audio: z.boolean().default(true),
});

export const LessonDraft = z.discriminatedUnion('skill', [ListeningDraft, ReadingDraft]);
export type LessonDraft = z.infer<typeof LessonDraft>;

// ───────────── Publicada (enriquecida por el pipeline) ─────────────
export const Token = z.object({
  t: z.string(), // forma superficial
  l: z.string(), // lema en minúsculas
  p: z.string(), // categoría (UPOS): NOUN, VERB, ADP…
  w: z.boolean(), // ¿cuenta para la cobertura? (no puntuación/número/nombre propio)
  sp: z.boolean().optional(), // ¿espacio después?
  s: z.number().optional(), // inicio en el audio (s)
  e: z.number().optional(), // fin en el audio (s)
});

export const AudioInfo = z.object({
  src: z.string().min(1), // 'audio/b1/b1-lis-001/v1.m4a'
  duration_s: z.number().positive(),
  wpm: z.number().positive(),
  provider: z.enum(['azure', 'kokoro', 'human', 'public-domain']),
  voices: z.record(z.string(), z.string()), // speaker id → voz
  loudness_lufs: z.number().optional(),
  peaks: z.array(z.number().min(0).max(1)).max(400),
});

export const QaReport = z.object({
  coverage_by_level: z.partialRecord(Cefr, z.number()), // % tokens contables de nivel ≤ X
  off_level_lemmas: z.array(z.string()),
  avg_sentence_words: z.number(),
  flesch_reading_ease: z.number().optional(),
  reviewer: z
    .object({
      model: z.string(),
      level_ok: z.boolean(),
      answerable_with_text: z.number(), // 0..1
      answerable_without_text: z.number(), // 0..1 (debe ser bajo)
      issues: z.array(z.string()),
      score: z.number().min(0).max(10),
    })
    .optional(),
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
  lemmas: z.array(z.string()), // lemas contables únicos (cobertura)
  difficulty: z.number(),
  qa: QaReport,
});

export const PublishedReading = ReadingDraft.extend({
  paragraphs: z
    .array(
      z.object({
        id: ParagraphId,
        sentences: z
          .array(
            DraftSentence.extend({
              tokens: z.array(Token).min(1),
              start: z.number().optional(), // si hay audio sincronizado por frase
              end: z.number().optional(),
            }),
          )
          .min(1),
      }),
    )
    .min(1),
  word_count: z.number().int().positive(),
  audio: AudioInfo.optional(),
  lemmas: z.array(z.string()),
  difficulty: z.number(),
  qa: QaReport,
});

export const Lesson = z.discriminatedUnion('skill', [PublishedListening, PublishedReading]);
export type Lesson = z.infer<typeof Lesson>;

// ───────────── Índice (content/index.generated.json) ─────────────
export const LessonMeta = z.object({
  id: LessonId,
  version: z.number().int().positive(),
  skill: z.enum(['listening', 'reading']),
  level: Cefr,
  unit: UnitId,
  series: z.string(),
  title: z.string(),
  summary_es: z.string(), // una línea para la tarjeta de la biblioteca
  topic: Topic,
  genre: z.string(),
  accents: z.array(Accent), // vacío en lectura sin audio
  duration_s: z.number().optional(),
  word_count: z.number().int(),
  wpm: z.number().optional(),
  est_minutes: z.number().int(),
  difficulty: z.number(),
  lemmas: z.array(z.string()),
  path: z.string(), // ruta relativa del JSON
});
export type LessonMeta = z.infer<typeof LessonMeta>;
