import { describe, expect, it } from 'vitest';
import type { z } from 'zod';
import type { PublishedListening } from '@/lib/content/schema';
import { toIntro, toTranscript } from './views';

type Lesson = z.infer<typeof PublishedListening>;

const SECRET_A = 'You know the Orionids, the meteor shower?';
const SECRET_B = "I'll pick you up at half eleven.";

const lesson = {
  id: 'b1-lis-001',
  version: 1,
  status: 'published',
  level: 'B1',
  unit: 'b1-u02',
  series: 'b1-u02-night-sky',
  skill: 'listening',
  genre: 'dialogue',
  title: 'Watching the Orionids',
  summary_es: 'Maya propone a Leo ir a ver una lluvia de estrellas.',
  topic: 'science-space',
  tags: [],
  can_do: ['L-B1-02'],
  grammar_focus: [],
  vocab_focus: [],
  est_minutes: 14,
  prediction_prompt: 'What do they need to organise?',
  pre_teach: ['meteor shower', 'comet'],
  glossary: [
    {
      lemma: 'meteor shower',
      surface: 'meteor shower',
      pos: 'phrase',
      def_en: 'many lights in the sky',
      def_es: 'lluvia de estrellas',
      ref: 's1',
    },
    {
      lemma: 'pick up',
      surface: 'pick you up',
      pos: 'phrasal_verb',
      def_en: 'collect someone by car',
      def_es: 'recoger',
      ref: 's2',
    },
  ],
  speakers: [
    { id: 'maya', name: 'Maya', accent: 'en-GB', gender: 'female', voice: 'en-GB-SoniaNeural' },
    { id: 'leo', name: 'Leo', accent: 'en-US', gender: 'male' },
  ],
  target_wpm: 140,
  segments: [
    {
      id: 's1',
      speaker: 'maya',
      text: SECRET_A,
      start: 0,
      end: 2.4,
      tokens: [{ t: 'You', l: 'you', p: 'PRON', w: true, s: 0, e: 0.2 }],
    },
    {
      id: 's2',
      speaker: 'maya',
      text: SECRET_B,
      start: 2.8,
      end: 5,
      tokens: [{ t: 'I', l: 'i', p: 'PRON', w: true, s: 2.8, e: 2.9 }],
    },
  ],
  connected_speech: [
    {
      ref: 's2',
      phrase: 'pick you up at',
      type: 'linking',
      ipa: '/pɪkjʊʌpət/',
      explanation_es: 'Se enlazan.',
    },
  ],
  tasks: [
    {
      id: 'q1',
      type: 'mcq',
      phase: 'listen_1',
      focus: 'gist',
      prompt: 'Why is Maya calling?',
      options: [
        { id: 'a', text: 'To suggest a night out' },
        { id: 'b', text: 'To borrow something' },
        { id: 'c', text: 'To ask for a lift' },
      ],
      answer: 'a',
      evidence: ['s1'],
      rationale_es: 'Maya propone ver la *meteor shower* (s1).',
    },
    {
      id: 'q2',
      type: 'true_false_ng',
      phase: 'listen_2',
      focus: 'detail',
      prompt: 'They leave at ten thirty.',
      answer: 'F',
      allow_ng: true,
      evidence: ['s2'],
      rationale_es: '*half eleven* son las 11:30.',
    },
    {
      id: 'q3',
      type: 'dictation',
      phase: 'post',
      focus: 'decoding',
      prompt: 'Write exactly what you hear.',
      segment: 's2',
      reference: SECRET_B,
      accept_variants: [],
      evidence: ['s2'],
      rationale_es: 'Enlace.',
    },
  ],
  provenance: { origin: 'ai', created_at: '2026-10-08T00:00:00Z', reviewed_by: 'test' },
  audio: {
    src: 'audio/b1/b1-lis-001/v1.m4a',
    duration_s: 5.2,
    wpm: 140,
    provider: 'azure',
    voices: { maya: 'x' },
    peaks: [0.2, 0.9],
  },
  lemmas: ['i', 'you'],
  difficulty: 1095,
  qa: {
    coverage_by_level: {},
    off_level_lemmas: [],
    avg_sentence_words: 6,
    checked_at: '2026-10-08T00:00:00Z',
  },
} satisfies Lesson;

describe('toIntro · lo que llega al navegador antes de la fase 3', () => {
  const intro = toIntro(lesson);
  const sent = JSON.stringify(intro);

  it('no contiene el guion: ni frases, ni tokens, ni la referencia del dictado', () => {
    expect(sent).not.toContain(SECRET_A);
    expect(sent).not.toContain(SECRET_B);
    expect(sent).not.toContain('"tokens"');
    expect(sent).not.toContain('pick you up');
    expect(intro.segments).toEqual([
      { id: 's1', speaker: 'maya', start: 0, end: 2.4 },
      { id: 's2', speaker: 'maya', start: 2.8, end: 5 },
    ]);
  });

  it('no contiene las explicaciones, que citan el guion', () => {
    expect(sent).not.toContain('half eleven');
    expect(intro.tasks.every((task) => task.rationale_es === '')).toBe(true);
  });

  it('lleva las preguntas de las dos escuchas con sus claves, pero no los dictados', () => {
    expect(intro.tasks.map((task) => [task.id, task.phase])).toEqual([
      ['q1', 'listen_1'],
      ['q2', 'listen_2'],
    ]);
    expect(intro.tasks[0]).toMatchObject({ type: 'mcq', answer: 'a' });
    expect(intro.dictationCount).toBe(1);
  });

  it('lleva las palabras previas con su definición, el audio y los hablantes', () => {
    expect(intro.preTeach).toEqual([
      { word: 'meteor shower', def_en: 'many lights in the sky', def_es: 'lluvia de estrellas' },
      { word: 'comet', def_en: undefined, def_es: undefined },
    ]);
    expect(intro.audio).toEqual({
      src: 'audio/b1/b1-lis-001/v1.m4a',
      duration_s: 5.2,
      wpm: 140,
      peaks: [0.2, 0.9],
    });
    // La voz sintética concreta no hace falta en el cliente.
    expect(intro.speakers).toEqual([
      { id: 'maya', name: 'Maya', accent: 'en-GB' },
      { id: 'leo', name: 'Leo', accent: 'en-US' },
    ]);
  });
});

describe('toTranscript · lo que se entrega al completar la fase 2', () => {
  const transcript = toTranscript(lesson);

  it('incluye el guion completo, los rasgos y el glosario', () => {
    expect(transcript.segments.map((s) => s.text)).toEqual([SECRET_A, SECRET_B]);
    expect(transcript.connectedSpeech).toHaveLength(1);
    expect(transcript.glossary).toHaveLength(2);
  });

  it('incluye los dictados y la explicación de todas las tareas', () => {
    expect(transcript.dictations.map((d) => d.id)).toEqual(['q3']);
    expect(Object.keys(transcript.rationales)).toEqual(['q1', 'q2', 'q3']);
    expect(transcript.rationales.q2).toContain('half eleven');
  });
});
