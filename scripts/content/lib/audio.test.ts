import { describe, expect, it } from 'vitest';
import type { TokenT } from './nlp';
import { buildSsml, escapeXml, ratePercent } from './ssml';
import {
  alignTokens,
  buildTimeline,
  computePeaks,
  pauseAfterMs,
  speechRate,
  withinRateTolerance,
  type TimedUnit,
  type UnitAudio,
} from './timeline';
import { encodeWav, parseWav, trimSilence } from './tts/wav';

const RATE = 1000; // 1 muestra = 1 ms: las cuentas se leen solas

const tone = (ms: number, value = 1000) => new Int16Array(ms).fill(value);
const word = (t: string, extra: Partial<TokenT> = {}): TokenT => ({
  t,
  l: t.toLowerCase(),
  p: 'X',
  w: true,
  ...extra,
});
const punct = (t: string): TokenT => ({ t, l: t, p: 'PUNCT', w: false });

describe('SSML', () => {
  it('expresa la velocidad como porcentaje con signo', () => {
    expect(ratePercent(0.95)).toBe('-5%');
    expect(ratePercent(1)).toBe('+0%');
    expect(ratePercent(1.1)).toBe('+10%');
  });

  it('escapa el texto: un guion con comillas o «&» no rompe el XML', () => {
    expect(escapeXml(`Tom & "Jerry" <it's>`)).toBe(
      'Tom &amp; &quot;Jerry&quot; &lt;it&apos;s&gt;',
    );
  });

  it('monta voz, idioma de la voz y velocidad', () => {
    const ssml = buildSsml({ text: "I'll be there.", voice: 'en-GB-SoniaNeural', rate: 0.95 });
    expect(ssml).toContain('xml:lang="en-GB"');
    expect(ssml).toContain('<voice name="en-GB-SoniaNeural">');
    expect(ssml).toContain('<prosody rate="-5%">I&apos;ll be there.</prosody>');
    expect(ssml).not.toContain('express-as');
  });

  it('añade el estilo solo si se pide', () => {
    const ssml = buildSsml({ text: 'Hi', voice: 'en-US-JennyNeural', rate: 1, style: 'chat' });
    expect(ssml).toContain('<mstts:express-as style="chat"><prosody');
  });
});

describe('WAV', () => {
  it('lo que se codifica se vuelve a leer igual', () => {
    const samples = Int16Array.from([0, 1, -1, 32767, -32768, 1234]);
    const back = parseWav(encodeWav({ sampleRate: 24_000, samples }));
    expect(back.sampleRate).toBe(24_000);
    expect([...back.samples]).toEqual([...samples]);
  });

  it('rechaza lo que no es un WAV', () => {
    expect(() => parseWav(Buffer.from('ID3 esto es un mp3'))).toThrow(/RIFF/);
  });

  it('lee el audio aunque el tamaño del bloque de datos venga a 0 (streaming)', () => {
    const wav = encodeWav({ sampleRate: RATE, samples: tone(10) });
    wav.writeUInt32LE(0, 40);
    expect(parseWav(wav).samples).toHaveLength(10);
  });

  it('recorta el silencio de los extremos y dice cuánto quitó al principio', () => {
    const samples = new Int16Array(1000);
    samples.fill(5000, 200, 700);
    const { pcm, trimmedStartMs } = trimSilence({ sampleRate: RATE, samples }, { keepMs: 30 });
    expect(trimmedStartMs).toBe(170);
    expect(pcm.samples).toHaveLength(560); // 30 + 500 + 30
  });

  it('no toca un audio que es todo silencio', () => {
    const pcm = { sampleRate: RATE, samples: new Int16Array(100) };
    expect(trimSilence(pcm)).toEqual({ pcm, trimmedStartMs: 0 });
  });
});

describe('pausas entre segmentos', () => {
  it('250 ms si sigue el mismo hablante y 400 ms si cambia', () => {
    expect(pauseAfterMs('B1', false)).toBe(250);
    expect(pauseAfterMs('B1', true)).toBe(400);
  });

  it('más largas en A1 y A2', () => {
    expect(pauseAfterMs('A1', false)).toBe(500);
    expect(pauseAfterMs('A2', true)).toBe(700);
  });

  it('la pausa indicada en la lección manda', () => {
    expect(pauseAfterMs('B1', true, 1200)).toBe(1200);
  });
});

describe('buildTimeline', () => {
  const units: UnitAudio[] = [
    {
      id: 's1',
      speaker: 'maya',
      pcm: { sampleRate: RATE, samples: tone(1000) },
      words: [
        { text: 'Hi', offsetMs: 100, durationMs: 200 },
        { text: 'Leo', offsetMs: 400, durationMs: 500 },
      ],
    },
    {
      id: 's2',
      speaker: 'maya',
      pcm: { sampleRate: RATE, samples: tone(500) },
      words: [{ text: 'Listen', offsetMs: 0, durationMs: 480 }],
    },
    {
      id: 's3',
      speaker: 'leo',
      pcm: { sampleRate: RATE, samples: tone(800) },
      // Un evento que el TTS sitúa más allá del final se recorta al segmento.
      words: [{ text: 'Sure', offsetMs: 100, durationMs: 900 }],
    },
  ];
  const timeline = buildTimeline(units, 'B1');

  it('coloca cada segmento tras el anterior más su pausa', () => {
    expect(timeline.units.map((u) => [u.id, u.start, u.end])).toEqual([
      ['s1', 0, 1],
      ['s2', 1.25, 1.75], // mismo hablante: 250 ms
      ['s3', 2.15, 2.95], // cambia el hablante: 400 ms
    ]);
    expect(timeline.durationS).toBe(2.95);
    expect(timeline.pcm.samples).toHaveLength(2950);
  });

  it('pasa los tiempos de palabra a tiempos del audio completo', () => {
    expect(timeline.units[0]?.words).toEqual([
      { text: 'Hi', s: 0.1, e: 0.3 },
      { text: 'Leo', s: 0.4, e: 0.9 },
    ]);
    expect(timeline.units[1]?.words).toEqual([{ text: 'Listen', s: 1.25, e: 1.73 }]);
    expect(timeline.units[2]?.words).toEqual([{ text: 'Sure', s: 2.25, e: 2.95 }]);
  });

  it('las pausas son silencio y no hay pausa tras el último segmento', () => {
    const { samples } = timeline.pcm;
    expect(samples[999]).toBe(1000);
    expect(samples[1000]).toBe(0);
    expect(samples[1249]).toBe(0);
    expect(samples[1250]).toBe(1000);
    expect(samples.at(-1)).toBe(1000);
  });

  it('no mezcla frecuencias de muestreo', () => {
    const other: UnitAudio = { ...(units[0] as UnitAudio), pcm: { sampleRate: 8000, samples: tone(8) } };
    expect(() => buildTimeline([units[0] as UnitAudio, other], 'B1')).toThrow(/frecuencia/);
  });
});

describe('alignTokens', () => {
  const unit = (words: [string, number, number][], start = 10, end = 13): TimedUnit => ({
    id: 's1',
    start,
    end,
    words: words.map(([text, s, e]) => ({ text, s, e })),
  });

  it('empareja palabra a palabra y deja la puntuación sin tiempo', () => {
    const tokens = [word('Hey'), word('Leo'), punct(',')];
    const out = alignTokens(
      tokens,
      unit([
        ['Hey', 10, 10.4],
        ['Leo', 10.5, 11],
      ]),
    );
    expect(out.map((t) => [t.t, t.s, t.e])).toEqual([
      ['Hey', 10, 10.4],
      ['Leo', 10.5, 11],
      [',', undefined, undefined],
    ]);
    // No modifica la entrada.
    expect(tokens[0]).not.toHaveProperty('s');
  });

  it('reparte un evento entre los tokens que lo forman (I + ’ll = I’ll)', () => {
    const out = alignTokens(
      [word('I'), word("'ll"), word('pick')],
      unit([
        ["I'll", 10, 10.4],
        ['pick', 10.4, 10.8],
      ]),
    );
    expect(out.map((t) => [t.t, t.s, t.e])).toEqual([
      ['I', 10, 10.1],
      ["'ll", 10.1, 10.4],
      ['pick', 10.4, 10.8],
    ]);
  });

  it('da a un token todos los eventos que ocupa (11:30 → eleven thirty)', () => {
    const out = alignTokens(
      [word('at'), word('11:30'), word('sharp')],
      unit([
        ['at', 10, 10.2],
        ['eleven', 10.2, 10.7],
        ['thirty', 10.7, 11.2],
        ['sharp', 11.3, 11.8],
      ]),
    );
    expect(out.map((t) => [t.t, t.s, t.e])).toEqual([
      ['at', 10, 10.2],
      ['11:30', 10.2, 11.2],
      ['sharp', 11.3, 11.8],
    ]);
  });

  it('si pierde el hilo, reparte el resto del segmento y los tiempos no retroceden', () => {
    const out = alignTokens(
      [word('one'), word('two'), word('three')],
      unit([
        ['one', 10, 10.5],
        ['zzz', 10.6, 11],
        ['qqq', 11, 12],
      ]),
    );
    const times = out.flatMap((t) => [t.s ?? 0, t.e ?? 0]);
    expect(out[0]).toMatchObject({ s: 10, e: 10.5 });
    expect(times).toEqual([...times].sort((a, b) => a - b));
    expect(out[2]?.e).toBe(13);
  });

  it('sin eventos de palabra, reparte el segmento en proporción a la longitud', () => {
    const out = alignTokens([word('a'), word('bcd')], unit([], 0, 4));
    expect(out.map((t) => [t.s, t.e])).toEqual([
      [0, 1],
      [1, 4],
    ]);
  });

  it('descarta tiempos antiguos al volver a alinear', () => {
    const out = alignTokens([word('Hi', { s: 99, e: 100 }), punct('!')], unit([['Hi', 10, 10.3]]));
    expect(out[0]).toMatchObject({ s: 10, e: 10.3 });
  });
});

describe('picos y velocidad', () => {
  it('normaliza los picos a 0–1 por tramos', () => {
    const samples = Int16Array.from([0, 100, -200, 50, 400, -100, 0, 0]);
    expect(computePeaks(samples, 4)).toEqual([0.25, 0.5, 1, 0]);
  });

  it('no pide más tramos que muestras ni falla sin audio', () => {
    expect(computePeaks(Int16Array.from([10, 20]), 240)).toEqual([0.5, 1]);
    expect(computePeaks(new Int16Array(0))).toEqual([]);
    expect(computePeaks(new Int16Array(8), 4)).toEqual([0, 0, 0, 0]);
  });

  it('calcula las palabras por minuto contando las pausas', () => {
    expect(speechRate(350, 150)).toBe(140);
    expect(speechRate(10, 0)).toBe(0);
  });

  it('acepta una velocidad dentro del ±8 % del objetivo', () => {
    expect(withinRateTolerance(137, 140)).toBe(true);
    expect(withinRateTolerance(151, 140)).toBe(true);
    expect(withinRateTolerance(152, 140)).toBe(false);
    expect(withinRateTolerance(128, 140)).toBe(false);
  });
});
