import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { languageOfId, type PracticeLanguage } from '../../../src/lib/content/language';
import { languageRoot } from '../../../src/lib/content/language-dirs';
import { buildSpanishLexicon, type Lexicon } from './es-lexicon';
import { fernandezHuerta, tokenizeEs } from './nlp-es';
import { tokenize, type TokenT } from './nlp';
import { fleschReadingEase } from './metrics';
import { CEFR, type Cefr, type WordLists } from './wordlists';

// Lo que cambia de un idioma a otro en el pipeline de lecciones: cómo se tokeniza y se lematiza,
// de dónde salen los niveles de las palabras, cómo se mide la legibilidad y qué palabras no
// cuentan al comparar una respuesta con su evidencia (ADR-0038).

/** Palabras vacías y números, y la raíz aproximada, para detectar respuestas copiadas del texto. */
export interface TextRules {
  stopwords: ReadonlySet<string>;
  numberWords: ReadonlySet<string>;
  stem(word: string): string;
}

export interface LanguagePack extends TextRules {
  language: PracticeLanguage;
  lists: WordLists;
  tokenize(text: string, own?: ReadonlySet<string>): TokenT[];
  flesch(words: string[], sentences: number): number;
}

const ENGLISH_RULES: TextRules = {
  stopwords: new Set(
    `a an the and or but if so of to in on at by for from with about into over after before up down
   out off as than then that this these those it its he she they them his her their we you i me my
   your our us is are was were be been being am do does did done have has had will would can could
   should may might must not no yes there here what which who whom when where why how all any some
   more most very just only also too each every`.split(/\s+/),
  ),
  // Números y horas se repiten por fuerza: «forty minutes» no se puede parafrasear.
  numberWords: new Set(
    `one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen
   seventeen eighteen nineteen twenty thirty forty fifty sixty seventy eighty ninety hundred hundreds
   thousand thousands million half quarter first second third a.m. p.m. am pm o'clock noon midnight`.split(
      /\s+/,
    ),
  ),
  stem: (word) => word.replace(/(?:ing|ed|es|s|ly)$/, ''),
};

const SPANISH_RULES: TextRules = {
  stopwords: new Set(
    `el la los las un una unos unas y e o u pero sino ni que porque si de del a al en con por para sin
   sobre entre hacia hasta desde se me te lo le les nos os mi tu su mis tus sus este esta estos estas
   ese esa eso esto yo tú él ella usted nosotros vosotros ellos ellas es son soy eres somos está están
   estoy estás hay ha han he has no sí muy más menos también tan ya`.split(/\s+/),
  ),
  numberWords: new Set(
    `cero uno una dos tres cuatro cinco seis siete ocho nueve diez once doce trece catorce quince
   veinte treinta cuarenta cincuenta sesenta setenta ochenta noventa cien ciento mil primero primera
   segundo segunda tercero tercera media cuarto`.split(/\s+/),
  ),
  stem: (word) => word.replace(/(?:es|s)$/, '').replace(/[aeo]$/, ''),
};

/** Las reglas de texto del idioma (inglés si no se conoce otro). */
export function textRules(language: PracticeLanguage): TextRules {
  return language === 'es' ? SPANISH_RULES : ENGLISH_RULES;
}

/** Niveles de las palabras de español: los del mazo (`content/es/dictionary/*.json`). */
export function buildSpanishLists(contentRoot = path.join(process.cwd(), 'content')): WordLists {
  const lists: WordLists = { levels: new Map(), pos: new Map(), ngslRank: new Map() };
  const dir = path.join(languageRoot(contentRoot, 'es'), 'dictionary');
  if (!existsSync(dir)) return lists;
  const upos: Record<string, string> = {
    noun: 'NOUN',
    verb: 'VERB',
    adjective: 'ADJ',
    adverb: 'ADV',
    preposition: 'ADP',
    pronoun: 'PRON',
    determiner: 'DET',
    conjunction: 'CCONJ',
    number: 'NUM',
    interjection: 'INTJ',
    modal: 'AUX',
    auxiliary: 'AUX',
    particle: 'PART',
  };
  for (const file of readdirSync(dir).filter((name) => name.endsWith('.json'))) {
    const deck = JSON.parse(readFileSync(path.join(dir, file), 'utf8')) as {
      level: Cefr;
      entries: { lemma: string; pos: string[] }[];
    };
    if (!CEFR.includes(deck.level)) continue;
    for (const entry of deck.entries) {
      const lemma = entry.lemma.trim().toLowerCase();
      if (lemma.includes(' ')) continue;
      const current = lists.levels.get(lemma);
      if (!current || CEFR.indexOf(deck.level) < CEFR.indexOf(current.level)) {
        lists.levels.set(lemma, { level: deck.level, source: 'deck' });
      }
      const mapped = upos[entry.pos[0] ?? ''];
      if (mapped && !lists.pos.has(lemma)) lists.pos.set(lemma, mapped);
    }
  }
  return lists;
}

let spanish: { pack: LanguagePack; root: string } | null = null;

/**
 * El pack del idioma. En inglés usa las listas que se le pasan (las abiertas de NGSL y CEFR-J); en
 * español, el léxico y los niveles del mazo.
 */
export function languagePack(language: PracticeLanguage, englishLists: WordLists): LanguagePack {
  if (language === 'es') {
    // El contenido de prueba de los e2e vive en CONTENT_DIR; el real, en content/.
    const root = path.resolve(process.cwd(), process.env.CONTENT_DIR ?? 'content');
    if (!spanish || spanish.root !== root) {
      const lexicon: Lexicon = buildSpanishLexicon(root);
      const lists = buildSpanishLists(root);
      spanish = {
        root,
        pack: {
          language: 'es',
          lists,
          ...SPANISH_RULES,
          tokenize: (text, own) => tokenizeEs(text, lexicon, own),
          flesch: fernandezHuerta,
        },
      };
    }
    return spanish.pack;
  }
  if (language !== 'en') {
    throw new Error(`El pipeline de lecciones aún no admite el idioma «${language}»`);
  }
  return {
    language: 'en',
    lists: englishLists,
    ...ENGLISH_RULES,
    tokenize: (text, own) => tokenize(text, englishLists, own),
    flesch: fleschReadingEase,
  };
}

/** El pack de la lección con ese id. */
export const packOfLesson = (id: string, englishLists: WordLists): LanguagePack =>
  languagePack(languageOfId(id), englishLists);
