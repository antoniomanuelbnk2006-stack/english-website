import { describe, expect, it } from 'vitest';
import { CardContent } from '@/features/srs/lib/cards';
import {
  baseWord,
  buildLookupCard,
  DefinitionResponse,
  LookupTerm,
  mainTranslations,
  needsTranslationSubpage,
  NO_TRANSLATION_ES,
  parseDefinitions,
  parseIpa,
  parseSpanish,
  plainText,
  posKey,
  SuggestResponse,
  WikitextResponse,
  type LookupEntry,
} from './wiktionary';

describe('LookupTerm', () => {
  it('acepta palabras, expresiones, guiones y apóstrofos', () => {
    for (const term of ['house', 'give up', "don't", 'well-being', 'T-shirt', 'café', 'Mr.']) {
      expect(LookupTerm.safeParse(term).success, term).toBe(true);
    }
    expect(LookupTerm.parse('  house  ')).toBe('house');
  });

  it('rechaza lo vacío, lo larguísimo y lo que no es una palabra', () => {
    for (const term of [
      '',
      '   ',
      '<b>hi</b>',
      '../etc',
      'a/b',
      'x'.repeat(61),
      '-dash',
      'a?b=c',
    ]) {
      expect(LookupTerm.safeParse(term).success, term).toBe(false);
    }
  });
});

describe('plainText', () => {
  it('quita etiquetas y hojas de estilo y arregla los espacios', () => {
    expect(
      plainText(
        'A <a rel="mw:WikiLink" href="/wiki/x">lucky</a> find ; a chance.<style data-x="1">.a{color:red}</style>',
      ),
    ).toBe('A lucky find; a chance.');
    expect(plainText('<span class="l"></span> To <b>keep</b> ( something ) .')).toBe(
      'To keep (something).',
    );
  });

  it('resuelve las entidades, también las numéricas', () => {
    expect(plainText('fish &amp; chips&nbsp;&#8212; &quot;ok&quot; &#x27;yes&#x27;')).toBe(
      'fish & chips — "ok" \'yes\'',
    );
    expect(plainText('&bogus; &#99999999;')).toBe('&bogus; &#99999999;');
  });

  it('lo que parece HTML dentro de una entidad queda como texto, no como etiqueta', () => {
    expect(plainText('&lt;script&gt;alert(1)&lt;/script&gt;')).toBe('<script>alert(1)</script>');
    expect(plainText('<script>alert(1)</script>safe')).toBe('safe');
  });
});

describe('parseDefinitions', () => {
  const response = DefinitionResponse.parse({
    en: [
      {
        partOfSpeech: 'Noun',
        language: 'English',
        definitions: [
          { definition: '' },
          { definition: 'A <b>building</b> to live in.', examples: ['This is my <b>house</b>.'] },
          { definition: 'A family.' },
        ],
      },
      { partOfSpeech: 'Verb', definitions: [{ definition: 'To give shelter to.' }] },
      { partOfSpeech: 'Noun', definitions: [{ definition: 'House music.' }] },
      // Las entradas «Translingual» llegan bajo `en`, pero no son inglés.
      {
        partOfSpeech: 'Symbol',
        language: 'Translingual',
        definitions: [{ definition: 'ISO code.' }],
      },
    ],
    fr: [{ partOfSpeech: 'Noun', definitions: [{ definition: 'maison' }] }],
  });

  it('solo toma el inglés, agrupa por categoría y descarta las definiciones vacías', () => {
    expect(parseDefinitions(response)).toEqual([
      {
        pos: 'Noun',
        senses: [
          { text: 'A building to live in.', example: 'This is my house.' },
          { text: 'A family.' },
          { text: 'House music.' },
        ],
      },
      { pos: 'Verb', senses: [{ text: 'To give shelter to.' }] },
    ]);
  });

  it('limita las acepciones por categoría y recorta las larguísimas', () => {
    const many = DefinitionResponse.parse({
      en: [
        {
          partOfSpeech: 'Noun',
          definitions: [
            ...Array.from({ length: 9 }, (_, n) => ({ definition: `Sense ${n}.` })),
            { definition: 'x'.repeat(900) },
          ],
        },
      ],
    });
    expect(parseDefinitions(many)[0]?.senses).toHaveLength(4);
    const long = DefinitionResponse.parse({
      en: [{ partOfSpeech: 'Noun', definitions: [{ definition: 'x'.repeat(900) }] }],
    });
    expect(parseDefinitions(long)[0]?.senses[0]?.text).toHaveLength(320);
  });

  it('una palabra que no existe en inglés no tiene definiciones', () => {
    expect(parseDefinitions(DefinitionResponse.parse({ fr: [] }))).toEqual([]);
    expect(parseDefinitions(DefinitionResponse.parse({}))).toEqual([]);
  });
});

describe('parseIpa', () => {
  it('prefiere la pronunciación británica', () => {
    const wikitext = `* {{IPA|en|/haʊs/|[haʊs]|a=GA}}\n* {{IPA|en|/haʊs/|a=RP}}\n* {{IPA|fr|/us/}}`;
    expect(parseIpa(wikitext)).toBe('/haʊs/');
    expect(parseIpa('{{IPA|en|/ɹʌn/|a=GA,RP}}')).toBe('/ɹʌn/');
    expect(parseIpa('{{IPA|en|/ˈlɛʒɚ/|a=GA}}\n{{IPA|en|/ˈlɛʒə/|a=UK}}')).toBe('/ˈlɛʒə/');
  });

  it('sin pronunciación en inglés devuelve null', () => {
    expect(parseIpa('{{IPA|fr|/mɛ.zɔ̃/}}')).toBeNull();
    expect(parseIpa('{{IPA|en|[äj]|a=RP}}')).toBeNull();
    expect(parseIpa('')).toBeNull();
  });
});

describe('parseSpanish', () => {
  const wikitext = `====Translations====
{{trans-top|a lucky discovery made by [[accident]]}}
* French: {{t+|fr|sérendipité|f}}
* Spanish: {{t+|es|serendipia|f}}, {{t|es|serendipidad|f}}, {{t+|es|serendipia|f}}
{{trans-bottom}}

{{trans-top|id=Q1|the gift of ''finding'' good things}}
* Spanish: {{tt+|es|[[chiripa]]|f}}, {{t-check|es|suerte}}, {{t-needed|es}}
{{trans-bottom}}

{{trans-top|no spanish here}}
* German: {{t+|de|Glück}}
{{trans-bottom}}

{{trans-top-see|good luck|luck|fortune}}
{{multitrans|data=
* Spanish: {{tt+|es|suerte|f}}
}}
{{trans-bottom}}

{{trans-see|chance}}
`;

  it('saca las traducciones al español de cada acepción, sin repetir', () => {
    expect(parseSpanish(wikitext)).toEqual([
      { gloss: 'a lucky discovery made by accident', terms: ['serendipia', 'serendipidad'] },
      { gloss: 'the gift of finding good things', terms: ['chiripa', 'suerte'] },
      // `trans-top-see` es una tabla normal que además remite a otras páginas.
      { gloss: 'good luck', terms: ['suerte'] },
    ]);
  });

  it('no confunde otros idiomas ni las remisiones a otra página', () => {
    expect(parseSpanish('{{trans-top|x}}\n* Portuguese: {{t+|pt|casa}}\n{{trans-bottom}}')).toEqual(
      [],
    );
    expect(parseSpanish('{{trans-see|x|y}}\n* Spanish: {{t+|es|casa}}')).toEqual([]);
    expect(parseSpanish('')).toEqual([]);
  });

  it('avisa cuando las traducciones están en la subpágina', () => {
    expect(needsTranslationSubpage('{{see translation subpage|Verb}}')).toBe(true);
    expect(needsTranslationSubpage(wikitext)).toBe(false);
  });
});

describe('respuestas de la API', () => {
  it('valida el texto fuente y las sugerencias', () => {
    expect(WikitextResponse.safeParse({ parse: { title: 'x', wikitext: 'y' } }).success).toBe(true);
    expect(WikitextResponse.safeParse({ error: { code: 'missingtitle' } }).success).toBe(false);
    expect(SuggestResponse.parse(['hous', ['house', 'housing'], [''], ['']])[1]).toEqual([
      'house',
      'housing',
    ]);
    expect(SuggestResponse.safeParse({ error: 1 }).success).toBe(false);
  });
});

describe('buildLookupCard', () => {
  const entry: LookupEntry = {
    word: 'serendipity',
    ipa: '/ˌsɛɹ.ənˈdɪp.ɪ.ti/',
    groups: [
      {
        pos: 'Noun',
        senses: [
          { text: 'A lucky discovery.', example: 'It was pure serendipity.' },
          { text: 'A gift.' },
        ],
      },
    ],
    translations: [
      { gloss: 'a lucky discovery', terms: ['serendipia', 'serendipidad'] },
      { gloss: 'a gift', terms: ['chiripa'] },
    ],
  };

  it('delante va un ejemplo con la palabra; detrás, definición y traducciones principales', () => {
    const card = buildLookupCard(entry);
    expect(card).toEqual({
      kind: 'word',
      lemma: 'serendipity',
      source_lesson_id: null,
      source_segment_id: 'wikt:serendipity',
      front: { sentence: 'It was pure serendipity.', surface: 'serendipity' },
      back: { pos: 'noun', def_en: 'A lucky discovery.', def_es: 'serendipia; chiripa' },
    });
    expect(CardContent.safeParse(card).success).toBe(true);
    expect(mainTranslations(entry)).toEqual(['serendipia', 'chiripa']);
  });

  it('resalta la forma entera que aparece en el ejemplo', () => {
    const card = buildLookupCard({
      word: 'house',
      ipa: null,
      groups: [{ pos: 'Verb', senses: [{ text: 'To keep.', example: 'The car is housed here.' }] }],
      translations: [],
    });
    expect(card.front).toEqual({ sentence: 'The car is housed here.', surface: 'housed' });
  });

  it('sin ejemplo va la palabra sola, y sin traducción lo dice', () => {
    const card = buildLookupCard({
      word: 'Give Up',
      ipa: null,
      groups: [{ pos: 'Verb', senses: [{ text: 'To stop trying.' }] }],
      translations: [],
    });
    expect(card).toMatchObject({
      kind: 'chunk',
      lemma: 'give up',
      source_segment_id: 'wikt:give up',
      front: { sentence: 'Give Up', surface: 'Give Up' },
      back: { def_en: 'To stop trying.', def_es: NO_TRANSLATION_ES },
    });
    expect(CardContent.safeParse(card).success).toBe(true);
  });
});

describe('baseWord', () => {
  const entryOf = (word: string, text: string): LookupEntry => ({
    word,
    ipa: null,
    groups: [{ pos: 'Verb', senses: [{ text }] }],
    translations: [],
  });

  it('reconoce las formas de otra palabra', () => {
    expect(baseWord(entryOf('went', 'simple past of go'))).toBe('go');
    expect(baseWord(entryOf('houses', 'plural of house'))).toBe('house');
    expect(baseWord(entryOf('running', 'present participle and gerund of run'))).toBe('run');
    expect(baseWord(entryOf('goes', 'third-person singular simple present indicative of go'))).toBe(
      'go',
    );
    expect(baseWord(entryOf('better', 'comparative form of good.'))).toBe('good');
    expect(
      baseWord(entryOf('colour', 'Commonwealth and Ireland standard spelling of color.')),
    ).toBe('color');
    expect(baseWord(entryOf('gave up', 'simple past of give up'))).toBe('give up');
  });

  it('una definición normal no es una forma de nada', () => {
    expect(baseWord(entryOf('house', 'A structure built as an abode of human beings.'))).toBeNull();
    expect(baseWord(entryOf('fear', 'A strong feeling of danger.'))).toBeNull();
    expect(baseWord(entryOf('go', 'simple past of go'))).toBeNull();
  });
});

describe('posKey', () => {
  it('reconoce las categorías que la app sabe nombrar en español', () => {
    expect(posKey('Noun')).toBe('noun');
    expect(posKey(' Adjective ')).toBe('adjective');
    expect(posKey('Proper noun')).toBeNull();
    expect(posKey('Phrase')).toBeNull();
  });
});
