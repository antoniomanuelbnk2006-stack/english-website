import { describe, expect, it } from 'vitest';
import { diagnose, diagnoseBest, type DiagnoseInput } from './dictation';

// Casos dorados del dictado diagnóstico (docs/01-pedagogia/03-listening.md §4).

const known = new Set([
  'how',
  'many',
  'meteor',
  'be',
  'we',
  'go',
  'to',
  'see',
  'like',
  'hundred',
  'it',
  'take',
  'about',
  'minute',
  'for',
  'your',
  'eye',
  'get',
  'use',
  'the',
  'dark',
  'perfect',
  'i',
  'will',
  'pick',
  'you',
  'up',
  'at',
  'half',
  'a',
  'an',
  'nice',
  'ice',
  'cream',
  'have',
  'got',
  'want',
  'ask',
  'next',
  'week',
  'would',
  'rather',
  'not',
  'she',
  'leave',
  'he',
  'do',
  'know',
  'colour',
  'color',
  'my',
  'favourite',
  'favorite',
  'is',
  'lot',
  'of',
  'time',
  'turn',
  'off',
  'can',
  'bring',
  'warm',
  'jacket',
  'so',
  'place',
  'away',
  'by',
  'car',
  'find',
  'this',
  'that',
  'work',
  'walk',
  'home',
  'every',
  'day',
  'there',
  'much',
  'light',
  'here',
  'from',
  'anything',
]);

const run = (reference: string, typed: string, extra: Partial<DiagnoseInput> = {}) =>
  diagnose({ reference, typed, knownLemmas: known, ...extra });

const causes = (reference: string, typed: string, extra: Partial<DiagnoseInput> = {}) =>
  run(reference, typed, extra).errors.map((error) => error.cause);

describe('normalización: lo que cuenta como acierto', () => {
  it('1 · ignora mayúsculas, puntuación y espacios de más', () => {
    const r = run(
      'Perfect. I’ll pick you up at half eleven.',
      "  perfect   i'll pick you up at half eleven ",
    );
    expect(r.accuracy).toBe(1);
    expect(r.errors).toEqual([]);
    expect(r.words.every((w) => w.status === 'ok')).toBe(true);
  });

  it('2 · acepta gonna como going to (ejemplo de la documentación)', () => {
    const r = run('How many meteors are we gonna see?', 'how many meteors are we going to see', {
      features: ['reduction'],
    });
    expect(r.accuracy).toBe(1);
    expect(r.errors).toHaveLength(0);
  });

  it('3 · y going to como gonna, wanna como want to, gotta, kinda', () => {
    expect(run('Are we going to see it?', 'are we gonna see it').accuracy).toBe(1);
    expect(run('I want to ask you.', 'i wanna ask you').accuracy).toBe(1);
    expect(run('I wanna go. I gotta go.', 'I want to go. I got to go').accuracy).toBe(1);
    expect(run("It's kinda nice.", 'it is kind of nice').accuracy).toBe(1);
  });

  it('4 · las contracciones equivalen a su forma completa, en los dos sentidos', () => {
    expect(run("I'll pick you up.", 'I will pick you up').accuracy).toBe(1);
    expect(run('We do not have to go.', "we don't have to go").accuracy).toBe(1);
    expect(
      run("You can't see anything from here.", 'you cannot see anything from here').accuracy,
    ).toBe(1);
    expect(
      run("I'm here. They're here. I've got it.", 'I am here they are here I have got it').accuracy,
    ).toBe(1);
    expect(run("I won't go.", 'i will not go').accuracy).toBe(1);
  });

  it("5 · 'd vale por would o had, y 's por is o has", () => {
    expect(run("I'd rather not.", 'I would rather not').accuracy).toBe(1);
    expect(run("I'd left.", 'I had left').accuracy).toBe(1);
    expect(run("She's left.", 'she has left').accuracy).toBe(1);
    expect(run("She's here.", 'she is here').accuracy).toBe(1);
    expect(run('She has left.', "she's left").accuracy).toBe(1);
  });

  it('6 · los números valen en cifras o en letras', () => {
    expect(run('It takes about twenty minutes.', 'it takes about 20 minutes').accuracy).toBe(1);
    expect(run('About 40 minutes away.', 'about forty minutes away').accuracy).toBe(1);
    expect(run('I am twenty-one.', 'i am 21').accuracy).toBe(1);
    expect(run('I am twenty one.', 'i am twenty-one').accuracy).toBe(1);
  });

  it('7 · las horas: half past eleven = half eleven = 11:30 = eleven thirty', () => {
    const reference = "I'll pick you up at half eleven.";
    for (const typed of [
      "I'll pick you up at half past eleven",
      "I'll pick you up at 11:30",
      "I'll pick you up at 11.30",
      "I'll pick you up at eleven thirty",
    ]) {
      expect(run(reference, typed).accuracy, typed).toBe(1);
    }
    expect(run('At quarter past six.', 'at 6:15').accuracy).toBe(1);
  });

  it('8 · pero half eleven no es 10:30 (el error típico)', () => {
    const r = run("I'll pick you up at half eleven.", "I'll pick you up at 10:30");
    expect(r.accuracy).toBeLessThan(1);
    expect(r.errors).toHaveLength(1);
  });

  it('9 · la ortografía británica y la estadounidense valen las dos', () => {
    expect(run('My favourite colour is grey.', 'my favorite color is gray').accuracy).toBe(1);
    expect(run('My favorite color.', 'my favourite colour').accuracy).toBe(1);
    expect(run('I realise that.', 'i realize that').accuracy).toBe(1);
  });

  it('10 · una palabra con guion vale junta o separada por espacio', () => {
    expect(run('An open-source tool.', 'an open source tool').accuracy).toBe(1);
  });

  it('10b · una contracción sin apóstrofo es puntuación, no un fallo de oído', () => {
    const r = run("That's not so bad. I don't know.", 'thats not so bad i dont know');
    expect(r.accuracy).toBe(1);
    expect(r.errors).toEqual([]);
    expect(run("We'll see.", 'well see').accuracy).toBe(1);
  });

  it('10c · pero no si la forma sin apóstrofo es otra palabra de la misma frase', () => {
    // «were» está en la frase: escribirla dos veces no convierte una en «we're».
    const r = run("We're where we were.", 'were where we were');
    expect(r.accuracy).toBeLessThan(1);
    // Y una palabra que no es una contracción de la frase no se toca.
    expect(run('I was ill.', "i was i'll").accuracy).toBeLessThan(1);
  });
});

describe('alineación y precisión', () => {
  it('11 · un error ortográfico leve en una palabra larga cuenta como acierto con aviso', () => {
    const r = run('It takes about twenty minutes.', 'it takes about twenty minuts');
    expect(r.accuracy).toBe(1);
    expect(r.errors).toEqual([]);
    expect(r.words.at(-1)).toEqual({ text: 'minutes.', status: 'typo', typed: 'minuts' });
  });

  it('12 · en una palabra corta, una letra de diferencia es un fallo', () => {
    const r = run('I walk home.', 'I work home');
    expect(r.accuracy).toBeCloseTo(2 / 3, 3);
    expect(r.words[1]).toEqual({ text: 'walk', status: 'wrong', typed: 'work' });
  });

  it('13 · una palabra omitida en medio no descoloca el resto', () => {
    const r = run(
      'It takes about twenty minutes for your eyes.',
      'it takes twenty minutes for your eyes',
    );
    expect(r.words.map((w) => w.status)).toEqual([
      'ok',
      'ok',
      'missing',
      'ok',
      'ok',
      'ok',
      'ok',
      'ok',
    ]);
    expect(r.accuracy).toBeCloseTo(7 / 8, 3);
    expect(r.errors).toEqual([
      { expected: 'about', typed: null, cause: 'not_recognized', words: [2] },
    ]);
  });

  it('14 · las palabras de más se listan aparte y no bajan la precisión', () => {
    const r = run('See you next week.', 'see you all next week then');
    expect(r.accuracy).toBe(1);
    expect(r.extra).toEqual(['all', 'then']);
    expect(r.errors).toEqual([]);
  });

  it('15 · sin escribir nada, la precisión es 0', () => {
    const r = run('How many meteors are we gonna see?', '   ');
    expect(r.accuracy).toBe(0);
    expect(r.words.every((w) => w.status === 'missing')).toBe(true);
  });

  it('16 · fallar la mitad de una reducción marca la palabra original entera', () => {
    const r = run('How many meteors are we gonna see?', 'how many meteors are we going see', {
      features: ['reduction'],
    });
    // «gonna» = going + to; se escribió «going» pero falta «to».
    expect(r.words[5]).toMatchObject({ text: 'gonna', status: 'missing' });
    expect(r.accuracy).toBeCloseTo(7 / 8, 3);
    expect(r.errors[0]).toMatchObject({ expected: 'gonna', typed: null, cause: 'not_recognized' });
  });
});

describe('propuesta de causa', () => {
  it('17 · no reconocida: palabras conocidas en un tramo con rasgo marcado (ejemplo de la documentación)', () => {
    const result = causes('How many meteors are we gonna see?', 'how many meteors we going see', {
      features: ['reduction', 'weak_form'],
    });
    expect(result).toContain('not_recognized');
    expect(new Set(result)).toEqual(new Set(['not_recognized']));
  });

  it('18 · desconocida: el lema no está en el léxico', () => {
    expect(
      causes('Bring a warm blanket.', 'bring a warm jacket', { features: ['weak_form'] }),
    ).toEqual(['unknown_word']);
  });

  it('19 · usa los lemas anotados de la lección si vienen', () => {
    const lemmas = { forecast: 'forecast', checked: 'check' };
    expect(
      causes('I checked the forecast.', 'I check the weather', {
        lemmas,
        knownLemmas: new Set(['i', 'the', 'check']),
      }),
    ).toEqual(['not_recognized', 'unknown_word']);
  });

  it('20 · límites: mismas letras cortadas por otro sitio (an ice cream / a nice cream)', () => {
    const r = run('An ice cream.', 'a nice cream');
    expect(r.errors).toEqual([
      { expected: 'an ice', typed: 'a nice', cause: 'boundaries', words: [0, 1] },
    ]);
  });

  it('21 · límites: dos palabras escritas como una, o una como dos', () => {
    expect(causes('I have a lot of time.', 'i have alot of time')).toEqual(['boundaries']);
    expect(causes('Turn it off.', 'turn i toff')).toEqual(['boundaries']);
  });

  it('22 · velocidad: conocida, sin rasgo marcado y acertada a 0,75×', () => {
    expect(
      causes('I walk home every day.', 'I work home every day', { passedAtSlowSpeed: true }),
    ).toEqual(['speed']);
  });

  it('23 · acento: conocida, sin rasgo y con un hablante de acento no estándar', () => {
    expect(causes('I walk home every day.', 'I work home every day', { accent: 'en-AU' })).toEqual([
      'accent',
    ]);
    // Con acento estándar, la causa por defecto es «no reconocida».
    expect(causes('I walk home every day.', 'I work home every day', { accent: 'en-GB' })).toEqual([
      'not_recognized',
    ]);
  });

  it('24 · el rasgo marcado pesa más que la velocidad o el acento', () => {
    expect(
      causes('I walk home every day.', 'I work home every day', {
        features: ['linking'],
        accent: 'en-IE',
        passedAtSlowSpeed: true,
      }),
    ).toEqual(['not_recognized']);
  });

  it('25 · atención: se omitió un tramo largo al final de la frase', () => {
    const r = run(
      'It takes about twenty minutes for your eyes to get used to the dark.',
      'it takes about twenty minutes',
      {
        features: ['weak_form'],
      },
    );
    expect(r.errors).toHaveLength(1);
    expect(r.errors[0]).toMatchObject({ cause: 'attention', typed: null });
    expect(r.errors[0]?.expected).toBe('for your eyes to get used to the dark');
  });

  it('26 · omitir solo la última palabra no es «atención»', () => {
    expect(causes('See you next week.', 'see you next', { features: ['linking'] })).toEqual([
      'not_recognized',
    ]);
  });

  it('27 · dos fallos separados dan dos diagnósticos, cada uno con su causa', () => {
    const r = run('Bring a warm blanket and a telescope.', 'bring warm blanket and a jacket', {
      features: ['weak_form'],
      knownLemmas: new Set([...known, 'blanket', 'and']),
    });
    expect(r.errors.map((e) => [e.expected, e.cause])).toEqual([
      ['a', 'not_recognized'],
      ['telescope', 'unknown_word'],
    ]);
  });

  it('28 · confundir forty con fourteen no es vocabulario desconocido', () => {
    const r = run('About forty minutes away by car.', 'about fourteen minutes away by car', {
      features: ['weak_form'],
    });
    expect(r.errors).toEqual([
      { expected: 'forty', typed: '14', cause: 'not_recognized', words: [1] },
    ]);
  });
});

describe('diagnoseBest', () => {
  const input: DiagnoseInput = {
    reference: 'Perfect. See you at half eleven.',
    typed: 'perfect see you at half past eleven',
    knownLemmas: known,
  };

  it('29 · prueba las variantes aceptadas y se queda con el mejor resultado', () => {
    const r = diagnoseBest(
      {
        ...input,
        reference: 'Yeah, see you at the car park.',
        typed: 'yeah see you at the parking lot',
      },
      ['Yeah, see you at the parking lot.'],
    );
    expect(r.accuracy).toBe(1);
    expect(r.errors).toEqual([]);
    expect(r.words.map((w) => w.text).join(' ')).toBe('Yeah, see you at the car park.');
    expect(r.words.every((w) => w.status === 'ok')).toBe(true);
  });

  it('30 · sin variantes se comporta como diagnose', () => {
    expect(diagnoseBest(input)).toEqual(diagnose(input));
  });
});

describe('dictado en español', () => {
  const es = (reference: string, typed: string) =>
    diagnose({ reference, typed, knownLemmas: new Set(), language: 'es' });

  it('una tilde de más o de menos es ortografía, no oído', () => {
    const result = es('¿Dónde está la estación?', 'donde esta la estacion');
    expect(result.accuracy).toBe(1);
    expect(result.words.map((word) => word.status)).toEqual(['typo', 'typo', 'ok', 'typo']);
  });

  it('los números y las horas valen con cifras o con palabras', () => {
    expect(es('Tengo treinta y cinco años.', 'Tengo 35 años.').accuracy).toBe(1);
    expect(es('El tren sale a las 11:30.', 'El tren sale a las once y media.').accuracy).toBe(1);
    expect(es('Quedamos a las ocho menos cuarto.', 'Quedamos a las 7:45.').accuracy).toBe(1);
    expect(es('Son veintitrés euros.', 'Son 23 euros.').accuracy).toBe(1);
  });

  it('una palabra distinta sigue siendo un fallo, y no se aplican reglas de inglés', () => {
    const result = es('Vamos a la playa.', 'Vamos a la casa.');
    expect(result.accuracy).toBeLessThan(1);
    expect(result.errors).toHaveLength(1);
    // «centre» → «center» es solo del inglés.
    expect(es('Vivo en el centre.', 'Vivo en el center.').accuracy).toBeLessThan(1);
  });

  it('«un» y «una» se quedan como palabras', () => {
    expect(es('Quiero un café.', 'Quiero 1 café.').accuracy).toBeLessThan(1);
  });
});
