import { describe, expect, it } from 'vitest';
import { buildSsml, parseSsml } from '../ssml';
import { estimateWordEvents, voicedRegions } from './estimate-words';

const RATE = 1000; // 1 muestra = 1 ms

/** Audio sintético: tramos de voz (`v`) y de silencio (`s`), en milisegundos. */
function audio(...parts: [kind: 'v' | 's', ms: number][]): Int16Array {
  const samples = new Int16Array(parts.reduce((sum, [, ms]) => sum + ms, 0));
  let offset = 0;
  for (const [kind, ms] of parts) {
    if (kind === 'v') samples.fill(8000, offset, offset + ms);
    offset += ms;
  }
  return samples;
}

describe('voicedRegions', () => {
  it('separa la voz por los silencios largos e ignora los cortos', () => {
    const samples = audio(['s', 100], ['v', 500], ['s', 60], ['v', 300], ['s', 400], ['v', 700]);
    expect(voicedRegions(samples, RATE)).toEqual([
      { startMs: 100, endMs: 960 }, // el silencio de 60 ms es articulación, no pausa
      { startMs: 1360, endMs: 2060 },
    ]);
  });

  it('no encuentra nada en un audio en silencio', () => {
    expect(voicedRegions(new Int16Array(500), RATE)).toEqual([]);
  });

  it('el ruido de fondo muy bajo no cuenta como voz', () => {
    const samples = audio(['v', 400], ['s', 300], ['v', 400]);
    for (let i = 400; i < 700; i++) samples[i] = 40;
    expect(voicedRegions(samples, RATE)).toHaveLength(2);
  });
});

describe('estimateWordEvents', () => {
  it('empareja cada pausa con su signo de puntuación', () => {
    const samples = audio(['s', 50], ['v', 600], ['s', 300], ['v', 900]);
    const events = estimateWordEvents(samples, RATE, 'Hey Leo, have you got a minute?');
    expect(events.map((e) => e.text)).toEqual(['Hey', 'Leo', 'have', 'you', 'got', 'a', 'minute']);
    // «Hey Leo» ocupa el primer tramo; el resto, el segundo.
    expect(events[0]).toMatchObject({ offsetMs: 50 });
    expect((events[1]?.offsetMs ?? 0) + (events[1]?.durationMs ?? 0)).toBeCloseTo(650, -1);
    expect(events[2]?.offsetMs).toBe(950);
    const last = events.at(-1);
    expect((last?.offsetMs ?? 0) + (last?.durationMs ?? 0)).toBeCloseTo(1850, -1);
  });

  it('reparte cada tramo en proporción a la longitud de las palabras', () => {
    const samples = audio(['v', 1000]);
    const events = estimateWordEvents(samples, RATE, 'a telescope');
    // Pesos 2 y 10: la palabra larga se lleva cinco veces más tiempo.
    expect(events).toEqual([
      { text: 'a', offsetMs: 0, durationMs: 167 },
      { text: 'telescope', offsetMs: 167, durationMs: 833 },
    ]);
  });

  it('los tiempos no se solapan ni retroceden', () => {
    const samples = audio(['v', 700], ['s', 200], ['v', 400], ['s', 250], ['v', 900]);
    const events = estimateWordEvents(
      samples,
      RATE,
      "Hmm, OK. That's not so bad — how many meteors are we gonna see?",
    );
    for (let i = 1; i < events.length; i++) {
      const previous = events[i - 1];
      expect(events[i]?.offsetMs).toBeGreaterThanOrEqual(
        (previous?.offsetMs ?? 0) + (previous?.durationMs ?? 0) - 1,
      );
    }
    expect(events.map((e) => e.text)).toContain("That's");
    expect(events.map((e) => e.text)).not.toContain('—');
  });

  it('si la voz hace más pausas que signos hay, funde las más cortas', () => {
    // Tres tramos de voz y una sola coma: la pausa de 150 ms sobra.
    const samples = audio(['v', 400], ['s', 150], ['v', 400], ['s', 500], ['v', 600]);
    const events = estimateWordEvents(samples, RATE, 'Well I think so, yes.');
    expect(events[3]?.text).toBe('so');
    expect((events[3]?.offsetMs ?? 0) + (events[3]?.durationMs ?? 0)).toBeCloseTo(950, -1);
    expect(events[4]).toMatchObject({ text: 'yes', offsetMs: 1450 });
  });

  it('si se dice de corrido lo que lleva comas, reparte todo el tramo', () => {
    const samples = audio(['s', 100], ['v', 1200], ['s', 100]);
    const events = estimateWordEvents(samples, RATE, 'Yes, of course, why not?');
    expect(events).toHaveLength(5);
    expect(events[0]?.offsetMs).toBe(100);
    const last = events.at(-1);
    expect((last?.offsetMs ?? 0) + (last?.durationMs ?? 0)).toBeCloseTo(1300, -1);
  });

  it('sin palabras o sin voz no falla', () => {
    expect(estimateWordEvents(audio(['v', 300]), RATE, ' … ')).toEqual([]);
    expect(estimateWordEvents(new Int16Array(400), RATE, 'Hello there')).toHaveLength(2);
  });
});

describe('parseSsml', () => {
  it('recupera el texto y la velocidad de lo que monta buildSsml', () => {
    const ssml = buildSsml({
      text: `Tom & "Jerry" said: I'll be <there>.`,
      voice: 'en-GB-SoniaNeural',
      rate: 0.9,
      style: 'chat',
    });
    expect(parseSsml(ssml)).toEqual({ text: `Tom & "Jerry" said: I'll be <there>.`, rate: 0.9 });
  });

  it('sin velocidad indicada, es 1', () => {
    expect(parseSsml('<speak><voice name="x">Hi</voice></speak>')).toEqual({ text: 'Hi', rate: 1 });
  });
});
