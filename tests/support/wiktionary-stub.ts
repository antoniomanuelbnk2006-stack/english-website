// Doble de Wiktionary para los tests e2e. Lo sirve el emulador en /wiktionary, y la app de los
// tests apunta ahí con DICTIONARY_API_URL: el buscador hace peticiones HTTP reales, pero
// ninguna sale de esta máquina. Las entradas imitan el formato real (HTML en las definiciones,
// plantillas en el texto fuente) con contenido escrito para los tests.

interface Reply {
  status: number;
  json?: unknown;
}

const definition = (text: string, example?: string) => ({
  definition: text,
  ...(example ? { examples: [example] } : {}),
});

const DEFINITIONS: Record<string, unknown> = {
  serendipity: {
    en: [
      {
        partOfSpeech: 'Noun',
        language: 'English',
        definitions: [
          // Las cabeceras vacías y las hojas de estilo llegan así en la API real.
          definition(''),
          definition(
            'A <a rel="mw:WikiLink" href="/wiki/lucky">lucky</a> discovery made by <b>accident</b> ; a happy chance.<style data-mw="x">.a{color:red}</style>',
            'Finding that old bookshop was pure <b>serendipity</b>.',
          ),
          definition(
            'The gift of finding good things without looking for them &amp; enjoying them.',
          ),
        ],
      },
    ],
    fr: [{ partOfSpeech: 'Noun', language: 'French', definitions: [definition('sérendipité')] }],
  },
  run: {
    en: [
      {
        partOfSpeech: 'Verb',
        language: 'English',
        definitions: [definition('To move quickly on foot.', 'She <b>runs</b> every morning.')],
      },
      {
        partOfSpeech: 'Noun',
        language: 'English',
        definitions: [definition('An act of running.', 'I went for a <b>run</b>.')],
      },
    ],
  },
  gizmo: {
    en: [
      {
        partOfSpeech: 'Noun',
        language: 'English',
        definitions: [definition('A small device whose name you do not know.')],
      },
    ],
  },
  advice: {
    en: [
      {
        partOfSpeech: 'Noun',
        language: 'English',
        definitions: [definition('An opinion offered to help someone decide what to do.')],
      },
    ],
  },
  // Una forma de otra palabra: lo útil es remitir a ella.
  went: {
    en: [
      {
        partOfSpeech: 'Verb',
        language: 'English',
        definitions: [definition('simple past of <a href="/wiki/go">go</a>')],
      },
      // Las entradas «Translingual» llegan bajo `en`, pero no son inglés.
      { partOfSpeech: 'Symbol', language: 'Translingual', definitions: [definition('A code.')] },
    ],
  },
  // Existe, pero no como palabra inglesa.
  confortable: {
    fr: [
      { partOfSpeech: 'Adjective', language: 'French', definitions: [definition('comfortable')] },
    ],
  },
};

const WIKITEXT: Record<string, string> = {
  serendipity: `==English==
===Pronunciation===
* {{IPA|en|/ˌsɛɹ.ənˈdɪp.ɪ.ti/|a=UK}}
* {{IPA|en|/ˌsɛɹ.ənˈdɪp.ə.ɾi/|a=GA}}

===Noun===
{{en-noun|~}}

# A lucky discovery made by accident.

====Translations====
{{trans-top|a lucky discovery made by [[accident]]}}
* French: {{t+|fr|sérendipité|f}}
* Spanish: {{t+|es|serendipia|f}}, {{t|es|serendipidad|f}}
{{trans-bottom}}

{{trans-top|id=Q1|the gift of finding good things}}
* Spanish: {{t|es|[[chiripa]]|f}}
{{trans-bottom}}

{{trans-see|luck}}
`,
  run: `==English==
===Pronunciation===
* {{IPA|en|/ɹʌn/|a=GA,RP}}

===Verb===
# To move quickly on foot.

====Translations====
{{see translation subpage|Verb}}

===Noun===
# An act of running.

====Translations====
{{trans-top|act of running}}
* Spanish: {{t+|es|carrera|f}}
{{trans-bottom}}
`,
  'run/translations': `{{translation subpage}}
==English==
===Verb===
====Translations====
{{trans-top|to move quickly on foot}}
* German: {{t+|de|laufen}}
* Spanish: {{tt+|es|correr}}
{{trans-bottom}}
`,
  gizmo: `==English==
===Noun===
# A small device.

====Translations====
{{trans-top|a small device}}
* French: {{t+|fr|bidule|m}}
{{trans-bottom}}
`,
  advice: `==English==
===Pronunciation===
* {{IPA|en|/ədˈvaɪs/}}

===Noun===
====Translations====
{{trans-top|opinion recommended}}
* Spanish: {{t+|es|consejo|m}}
{{trans-bottom}}
`,
};

const SUGGESTIONS: Record<string, string[]> = {
  confortable: ['comfortable', 'confortable'],
};

/** Contesta a las tres peticiones que hace el buscador; `boom` simula que el servicio falla. */
export function wiktionaryStub(url: URL): Reply {
  const path = url.pathname.replace(/^\/wiktionary/, '');

  const definitionOf = /^\/api\/rest_v1\/page\/definition\/(.+)$/.exec(path);
  if (definitionOf) {
    const title = decodeURIComponent(definitionOf[1] ?? '').replace(/_/g, ' ');
    if (title === 'boom') return { status: 500, json: { status: 500 } };
    const found = DEFINITIONS[title];
    return found ? { status: 200, json: found } : { status: 404, json: { status: 404 } };
  }

  if (path === '/w/api.php') {
    const action = url.searchParams.get('action');
    if (action === 'parse') {
      const title = url.searchParams.get('page') ?? '';
      const wikitext = WIKITEXT[title];
      return {
        status: 200,
        json: wikitext ? { parse: { title, wikitext } } : { error: { code: 'missingtitle' } },
      };
    }
    if (action === 'opensearch') {
      const search = url.searchParams.get('search') ?? '';
      return { status: 200, json: [search, SUGGESTIONS[search] ?? []] };
    }
  }
  return { status: 404, json: { status: 404 } };
}
