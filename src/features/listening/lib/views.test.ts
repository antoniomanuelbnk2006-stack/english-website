import { describe, expect, it } from 'vitest';
import { listeningFixture as lesson, SECRET_A, SECRET_B } from './lesson.fixture';
import { toIntro, toTranscript, transcriptUnlocked } from './views';

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

describe('transcriptUnlocked · cuándo puede salir el guion del servidor', () => {
  it('nunca sin progreso guardado ni antes de las dos escuchas a ciegas', () => {
    expect(transcriptUnlocked(null)).toBe(false);
    expect(transcriptUnlocked(undefined)).toBe(false);
    for (const phase of [0, 1, 2]) {
      expect(transcriptUnlocked({ phase, transcript_first: false })).toBe(false);
    }
  });

  it('sí a partir de la fase 3 del ciclo', () => {
    for (const phase of [3, 4, 7]) expect(transcriptUnlocked({ phase })).toBe(true);
  });

  it('sí cuando el usuario eligió el modo con transcripción, esté en la fase que esté', () => {
    expect(transcriptUnlocked({ phase: 0, transcript_first: true })).toBe(true);
    expect(transcriptUnlocked({ phase: 2, transcript_first: true })).toBe(true);
    expect(transcriptUnlocked({ phase: 1, transcript_first: null })).toBe(false);
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
