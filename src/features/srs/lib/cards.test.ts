import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { listeningFixture, SECRET_B } from '@/features/listening/lib/lesson.fixture';
import { PublishedReading } from '@/lib/content/schema';
import {
  buildAudioCard,
  buildGrammarCard,
  buildWordCard,
  CardContent,
  kindOfEntry,
  sentenceAt,
  splitAround,
} from './cards';

const reading = PublishedReading.parse(
  JSON.parse(
    readFileSync(path.join(process.cwd(), 'content/lessons/b1/reading/b1-rea-001.json'), 'utf8'),
  ),
);

describe('kindOfEntry', () => {
  it('las expresiones y los verbos frasales son «chunk»; el resto, «word»', () => {
    expect(kindOfEntry({ lemma: 'release', pos: 'noun' })).toBe('word');
    expect(kindOfEntry({ lemma: 'pick up', pos: 'phrasal_verb' })).toBe('chunk');
    expect(kindOfEntry({ lemma: 'meteor shower', pos: 'noun' })).toBe('chunk');
    expect(kindOfEntry({ lemma: 'anyway', pos: 'phrase' })).toBe('chunk');
  });
});

describe('sentenceAt', () => {
  it('en escucha devuelve el segmento con su tramo de audio', () => {
    expect(sentenceAt(listeningFixture, 's2')).toEqual({
      text: SECRET_B,
      clip: { src: 'audio/b1/b1-lis-001/v1.m4a', start: 2.8, end: 5 },
    });
  });

  it('en lectura sin audio devuelve solo la frase', () => {
    expect(sentenceAt(reading, 'p1s3')).toEqual({ text: 'But some games refuse to die.' });
  });

  it('devuelve null si la referencia no existe', () => {
    expect(sentenceAt(reading, 'p99s1')).toBeNull();
    expect(sentenceAt(listeningFixture, 's99')).toBeNull();
  });
});

describe('buildWordCard', () => {
  it('monta la tarjeta con la frase original, la definición y el ejemplo', () => {
    const card = buildWordCard(reading, 'release');
    expect(card).toMatchObject({
      kind: 'word',
      lemma: 'release',
      source_lesson_id: 'b1-rea-001',
      source_segment_id: 'b1-rea-001:p1s4',
      front: {
        sentence:
          'Years after their release, they are still played by thousands of people every day.',
        surface: 'release',
      },
      back: { pos: 'noun', def_es: 'lanzamiento' },
    });
    expect(card?.kind === 'word' && card.back.example).toContain('million copies');
    expect(card?.kind === 'word' && card.front.clip).toBeUndefined();
    expect(CardContent.safeParse(card).success).toBe(true);
  });

  it('una expresión sale como «chunk» y, si la lección tiene audio, con su tramo', () => {
    const card = buildWordCard(listeningFixture, 'pick up');
    expect(card).toMatchObject({
      kind: 'chunk',
      lemma: 'pick up',
      source_segment_id: 'b1-lis-001:s2',
      front: {
        sentence: SECRET_B,
        surface: 'pick you up',
        clip: { start: 2.8, end: 5 },
      },
    });
  });

  it('sin entrada en el glosario no hay tarjeta: haría falta una definición', () => {
    expect(buildWordCard(reading, 'game')).toBeNull();
  });
});

describe('buildAudioCard', () => {
  it('lleva el tramo exacto del segmento y, detrás, el texto y sus rasgos', () => {
    const card = buildAudioCard(listeningFixture, 's2');
    expect(card).toEqual({
      kind: 'audio',
      lemma: null,
      source_lesson_id: 'b1-lis-001',
      source_segment_id: 'b1-lis-001:s2',
      front: { clip: { src: 'audio/b1/b1-lis-001/v1.m4a', start: 2.8, end: 5 } },
      back: {
        text: SECRET_B,
        variants: [],
        features: [
          {
            phrase: 'pick you up at',
            type: 'linking',
            ipa: '/pɪkjʊʌpət/',
            explanation_es: 'Se enlazan.',
          },
        ],
      },
    });
    // El anverso no deja ver el texto.
    expect(JSON.stringify(card?.front)).not.toContain('pick');
  });

  it('solo existe para lecciones de escucha y segmentos reales', () => {
    expect(buildAudioCard(reading, 'p1s1')).toBeNull();
    expect(buildAudioCard(listeningFixture, 's99')).toBeNull();
  });
});

describe('buildGrammarCard', () => {
  it('guarda la pregunta delante y la respuesta, la regla y la ficha detrás', () => {
    const card = buildGrammarCard(
      { id: 'b1.linkers', title: 'Linkers' },
      {
        id: 'p2',
        prompt: '___ it was raining, we went out.',
        answers: ['Although', 'Though'],
        rule_es: 'Concesión + oración.',
      },
    );
    expect(card).toEqual({
      kind: 'grammar',
      lemma: null,
      source_lesson_id: null,
      source_segment_id: 'b1.linkers:p2',
      front: { prompt: '___ it was raining, we went out.' },
      back: {
        answers: ['Although', 'Though'],
        rule_es: 'Concesión + oración.',
        grammar_id: 'b1.linkers',
        title: 'Linkers',
      },
    });
    expect(CardContent.safeParse(card).success).toBe(true);
  });
});

describe('splitAround', () => {
  it('parte la frase alrededor de la palabra, sin distinguir mayúsculas', () => {
    expect(splitAround('Release day was chaos.', 'release')).toEqual({
      before: '',
      match: 'Release',
      after: ' day was chaos.',
    });
    expect(splitAround("I'll pick you up at six.", 'pick you up')).toEqual({
      before: "I'll ",
      match: 'pick you up',
      after: ' at six.',
    });
  });

  it('devuelve null si la palabra no está tal cual en la frase', () => {
    expect(splitAround('They released it.', 'release date')).toBeNull();
  });
});
