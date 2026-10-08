import { readFileSync } from 'node:fs';
import path from 'node:path';

// Nivel MCER de cada lema a partir de listas con licencia abierta
// (docs/01-pedagogia/05-vocabulario-y-srs.md §3; licencias en content/wordlists/LICENSES.md).

export const CEFR = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'] as const;
export type Cefr = (typeof CEFR)[number];

export type LevelSource = 'function' | 'reduction' | 'cefrj' | 'octanove' | 'ngsl' | 'estimated';

export interface LemmaLevel {
  level: Cefr;
  source: LevelSource;
}

export interface WordLists {
  /** Lema (en minúsculas) → nivel más bajo entre sus categorías gramaticales. */
  levels: Map<string, LemmaLevel>;
  /** Lema → primera categoría (UPOS) con la que aparece en las listas. */
  pos: Map<string, string>;
  /** Lema → posición en la NGSL (1 = la palabra más frecuente). */
  ngslRank: Map<string, number>;
}

const rank = (level: Cefr) => CEFR.indexOf(level);
const isCefr = (value: string): value is Cefr => (CEFR as readonly string[]).includes(value);

/** Categorías de las listas → etiquetas UPOS del tokenizador. */
const POS_TO_UPOS: Record<string, string> = {
  noun: 'NOUN',
  adjective: 'ADJ',
  verb: 'VERB',
  adverb: 'ADV',
  pronoun: 'PRON',
  preposition: 'ADP',
  determiner: 'DET',
  conjunction: 'CCONJ',
  number: 'NUM',
  interjection: 'INTJ',
  'modal auxiliary': 'AUX',
  'be-verb': 'AUX',
  'do-verb': 'AUX',
  'have-verb': 'AUX',
  'infinitive-to': 'PART',
};

/** Palabras gramaticales: se consideran conocidas desde A1. */
export const FUNCTION_POS = new Set(['DET', 'ADP', 'PRON', 'AUX', 'CCONJ', 'SCONJ', 'PART']);

/** Reducciones del habla informal. No están en las listas; se entrenan desde B1 (L-B1-07). */
export const REDUCTIONS = new Set([
  'gonna',
  'wanna',
  'gotta',
  'kinda',
  'sorta',
  'lemme',
  'gimme',
  'dunno',
  'outta',
  'hafta',
  'whatcha',
]);

/** CSV mínimo según RFC 4180: campos entre comillas, comillas dobles escapadas y saltos CRLF. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  const src = text.replace(/^﻿/, '');

  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (quoted) {
      if (ch === '"' && src[i + 1] === '"') {
        field += '"';
        i++;
      } else if (ch === '"') {
        quoted = false;
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      quoted = true;
    } else if (ch === ',') {
      row.push(field);
      field = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && src[i + 1] === '\n') i++;
      row.push(field);
      field = '';
      rows.push(row);
      row = [];
    } else {
      field += ch;
    }
  }
  if (field !== '' || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((cell) => cell.trim() !== ''));
}

function addProfile(lists: WordLists, csv: string, source: 'cefrj' | 'octanove'): void {
  const [header, ...rows] = parseCsv(csv);
  if (!header) return;
  const col = (name: string) => header.findIndex((h) => h.trim().toLowerCase() === name);
  const iHead = col('headword');
  const iPos = col('pos');
  const iLevel = col('cefr');
  if (iHead < 0 || iLevel < 0)
    throw new Error(`Lista ${source}: faltan las columnas headword/CEFR`);

  for (const row of rows) {
    const level = (row[iLevel] ?? '').trim().toUpperCase();
    if (!isCefr(level)) continue;
    const upos = POS_TO_UPOS[(row[iPos] ?? '').trim().toLowerCase()];

    // «airplane/aeroplane» son variantes del mismo lema; las expresiones de varias palabras no se usan aquí.
    for (const variant of (row[iHead] ?? '').split('/')) {
      const lemma = variant.trim().toLowerCase();
      if (lemma === '' || lemma.includes(' ')) continue;
      const current = lists.levels.get(lemma);
      if (!current || rank(level) < rank(current.level)) lists.levels.set(lemma, { level, source });
      if (upos && !lists.pos.has(lemma)) lists.pos.set(lemma, upos);
    }
  }
}

export function buildWordLists(csv: { cefrj: string; octanove: string; ngsl: string }): WordLists {
  const lists: WordLists = { levels: new Map(), pos: new Map(), ngslRank: new Map() };
  addProfile(lists, csv.cefrj, 'cefrj');
  addProfile(lists, csv.octanove, 'octanove');

  const [, ...ngslRows] = parseCsv(csv.ngsl);
  for (const row of ngslRows) {
    const lemma = (row[0] ?? '').trim().toLowerCase();
    const position = Number(row[1]);
    if (lemma !== '' && Number.isFinite(position) && !lists.ngslRank.has(lemma)) {
      lists.ngslRank.set(lemma, position);
    }
  }
  return lists;
}

export function loadWordLists(dir = path.join(process.cwd(), 'content', 'wordlists')): WordLists {
  const read = (file: string) => readFileSync(path.join(dir, file), 'utf8');
  return buildWordLists({
    cefrj: read('cefrj-vocabulary-profile-1.5.csv'),
    octanove: read('octanove-vocabulary-profile-c1c2-1.0.csv'),
    ngsl: read('ngsl-1.2-stats.csv'),
  });
}

/** Estimación por frecuencia para lemas que no están en los perfiles MCER. */
function levelFromNgslRank(position: number): Cefr {
  if (position <= 500) return 'A1';
  if (position <= 1000) return 'A2';
  if (position <= 2000) return 'B1';
  return 'B2';
}

export function isKnownToLists(lists: WordLists, lemma: string): boolean {
  return lists.levels.has(lemma) || lists.ngslRank.has(lemma) || REDUCTIONS.has(lemma);
}

/**
 * Nivel de un lema. Se usa el nivel más bajo entre sus categorías gramaticales: el etiquetador
 * ligero confunde a veces nombre y verbo, y un nivel por categoría daría falsos «fuera de nivel».
 */
export function levelOf(lists: WordLists, lemma: string, upos: string): LemmaLevel {
  // Antes que las gramaticales: «gonna» se etiqueta como auxiliar, pero no es A1.
  if (REDUCTIONS.has(lemma)) return { level: 'B1', source: 'reduction' };
  if (FUNCTION_POS.has(upos)) return { level: 'A1', source: 'function' };

  const profiled = lists.levels.get(lemma);
  if (profiled) return profiled;

  const position = lists.ngslRank.get(lemma);
  if (position !== undefined) return { level: levelFromNgslRank(position), source: 'ngsl' };

  return { level: 'C2', source: 'estimated' };
}

/**
 * Formas base candidatas para una palabra que el lematizador no ha reducido
 * («modders» → «modder», «raining» → «rain»), empezando por la propia palabra.
 */
export function baseFormCandidates(word: string): string[] {
  const w = word.toLowerCase();
  const candidates = [w];
  if (w.endsWith('ies')) candidates.push(`${w.slice(0, -3)}y`);
  if (w.endsWith('es')) candidates.push(w.slice(0, -2));
  if (w.endsWith('s')) candidates.push(w.slice(0, -1));
  if (w.endsWith('ing')) {
    const stem = w.slice(0, -3);
    candidates.push(stem, `${stem}e`);
    if (/(.)\1$/.test(stem)) candidates.push(stem.slice(0, -1));
  }
  if (w.endsWith('ied')) candidates.push(`${w.slice(0, -3)}y`);
  if (w.endsWith('ed')) {
    const stem = w.slice(0, -2);
    candidates.push(stem, `${stem}e`);
    if (/(.)\1$/.test(stem)) candidates.push(stem.slice(0, -1));
  }
  if (w.endsWith('er')) candidates.push(w.slice(0, -2), w.slice(0, -1));
  if (w.endsWith('est')) candidates.push(w.slice(0, -3), w.slice(0, -2));
  if (w.endsWith('ly')) candidates.push(w.slice(0, -2));
  return candidates.filter((c) => c.length > 1);
}

/** Primera forma base de `word` que esté en las listas, o `null`. */
export function baseFormIn(lists: WordLists, word: string): string | null {
  return baseFormCandidates(word).find((c) => isKnownToLists(lists, c)) ?? null;
}
