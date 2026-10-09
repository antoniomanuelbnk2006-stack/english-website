import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { canonicalWords } from '@/features/pronunciation/lib/assess';
import { buildDictionaryCard, CardContent } from '@/features/srs/lib/cards';
import { checkDictionaryFile, DictionaryFile, lemmaKey } from './dictionary-schema';
import { checkPronunciationSet, PronunciationSet } from './pronunciation-schema';

const CONTENT = path.join(process.cwd(), 'content');
const read = (file: string): unknown => JSON.parse(readFileSync(file, 'utf8'));

const entry = {
  lemma: 'abandon',
  pos: ['verb' as const],
  es: 'abandonar',
  example: 'They had to abandon the car.',
  surface: 'abandon',
};

describe('checkDictionaryFile', () => {
  it('acepta un mazo correcto', () => {
    expect(checkDictionaryFile({ level: 'B2', entries: [entry] })).toEqual([]);
  });

  it('avisa de palabras repetidas aunque cambien las mayúsculas', () => {
    const problems = checkDictionaryFile({
      level: 'B2',
      entries: [entry, { ...entry, lemma: 'Abandon' }],
    });
    expect(problems).toEqual(['«Abandon» está repetida']);
  });

  it('avisa si el ejemplo no contiene la palabra o no termina en puntuación', () => {
    expect(
      checkDictionaryFile({ level: 'B2', entries: [{ ...entry, surface: 'abandoned' }] }),
    ).toEqual(['«abandon»: el ejemplo no contiene «abandoned»']);
    expect(
      checkDictionaryFile({ level: 'B2', entries: [{ ...entry, example: 'They abandon it' }] }),
    ).toEqual(['«abandon»: el ejemplo no termina en puntuación']);
  });
});

describe('buildDictionaryCard', () => {
  it('monta una tarjeta de palabra con el ejemplo delante y la traducción detrás', () => {
    const card = buildDictionaryCard({ ...entry, lemma: 'April', pos: ['noun'] });
    expect(card).toMatchObject({
      kind: 'word',
      lemma: 'april',
      source_lesson_id: null,
      source_segment_id: 'dict:april',
      front: { sentence: entry.example, surface: 'abandon' },
      back: { pos: 'noun', def_es: 'abandonar' },
    });
    expect(CardContent.safeParse(card).success).toBe(true);
  });

  it('una expresión de varias palabras es un «chunk»', () => {
    expect(buildDictionaryCard({ ...entry, lemma: 'carbon dioxide', pos: ['noun'] }).kind).toBe(
      'chunk',
    );
  });
});

describe('mazo de palabras publicado', () => {
  const dir = path.join(CONTENT, 'dictionary');
  const files = existsSync(dir) ? readdirSync(dir).filter((name) => name.endsWith('.json')) : [];

  it.each(files)('%s cumple el esquema y sus reglas', (file) => {
    const dictionary = DictionaryFile.parse(read(path.join(dir, file)));
    expect(`${dictionary.level.toLowerCase()}.json`).toBe(file);
    expect(checkDictionaryFile(dictionary)).toEqual([]);
    // Orden alfabético: así los cambios se ven limpios en git.
    const keys = dictionary.entries.map((item) => lemmaKey(item.lemma));
    expect(keys).toEqual([...keys].sort());
  });
});

describe('checkPronunciationSet', () => {
  const set = PronunciationSet.parse({
    id: 'a1-pro-001',
    version: 1,
    status: 'published',
    level: 'A1',
    title: 'Ship or sheep?',
    summary_es: 'Dos íes.',
    focus: 'vowels',
    tip_es: 'Una corta y otra larga.',
    est_minutes: 5,
    items: [
      { id: 'i1', text: 'ship', confusions: [{ heard: 'sheep', tip_es: 'Corta.' }] },
      { id: 'i2', text: 'sheep' },
      { id: 'i3', text: 'sit' },
      { id: 'i4', text: 'seat' },
    ],
  });

  it('acepta un ejercicio correcto', () => {
    expect(checkPronunciationSet(set)).toEqual([]);
  });

  it('avisa si el id no es del nivel, si se repite un ítem o si la confusión es el propio texto', () => {
    expect(checkPronunciationSet({ ...set, level: 'B1' })).toEqual([
      'el id a1-pro-001 no corresponde al nivel B1',
    ]);
    const [first, ...rest] = set.items;
    expect(checkPronunciationSet({ ...set, items: [first!, first!, ...rest] })).toEqual([
      'el ítem i1 está repetido',
    ]);
    expect(
      checkPronunciationSet({
        ...set,
        items: [{ ...first!, confusions: [{ heard: 'Ship', tip_es: 'x' }] }, ...rest],
      }),
    ).toEqual(['ítem i1: la confusión «Ship» es igual que el texto']);
  });
});

describe('ejercicios de pronunciación publicados', () => {
  const root = path.join(CONTENT, 'pronunciation');
  const files = existsSync(root)
    ? readdirSync(root).flatMap((level) =>
        readdirSync(path.join(root, level))
          .filter((name) => name.endsWith('.json'))
          .map((name) => path.join(level, name)),
      )
    : [];

  it.each(files)('%s cumple el esquema y sus reglas', (file) => {
    const set = PronunciationSet.parse(read(path.join(root, file)));
    expect(path.basename(file, '.json')).toBe(set.id);
    expect(checkPronunciationSet(set)).toEqual([]);
    for (const item of set.items) {
      const target = canonicalWords(item.text).join(' ');
      expect(target, `${set.id} ${item.id}: no tiene nada que decir`).not.toBe('');
      for (const confusion of item.confusions) {
        // Una confusión que el corrector da por buena (un homófono) nunca saltaría.
        expect(
          canonicalWords(confusion.heard).join(' '),
          `${set.id} ${item.id}: «${confusion.heard}» suena igual que «${item.text}»`,
        ).not.toBe(target);
      }
    }
  });
});
