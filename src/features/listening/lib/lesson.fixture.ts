import type { z } from 'zod';
import type { PublishedListening } from '@/lib/content/schema';

// Lección de escucha mínima para los tests (no es contenido real).

type Lesson = z.infer<typeof PublishedListening>;

export const SECRET_A = 'You know the Orionids, the meteor shower?';
export const SECRET_B = "I'll pick you up at half eleven.";

export const listeningFixture = {
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
