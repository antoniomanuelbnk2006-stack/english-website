// pnpm tsx scripts/content/unknown-forms.ts [--ids es-b1-rea-001,…]
// Lista las formas de las lecciones de español que el léxico no conoce, con una frase donde salen.
// Es la herramienta para ampliar el mazo: cada forma se resuelve añadiendo su lema al mazo
// (`content/es/dictionary/<nivel>.json`) o, si es irregular, a `content/es/wordlists/formas.json`.
import { parseArgs } from 'node:util';
import { languageOfId } from '../../src/lib/content/language';
import { listLessonFiles, readJson, splitIds } from './lib/io';
import { languagePack } from './lib/language-pack';
import { unknownWords } from './lib/nlp-es';
import { loadWordLists } from './lib/wordlists';

const { values } = parseArgs({ options: { ids: { type: 'string', multiple: true } } });
const ids = new Set(splitIds(values.ids));
const lists = loadWordLists();
const pack = languagePack('es', lists);

type Json = Record<string, unknown>;
const found = new Map<string, { count: number; sentence: string; lesson: string }>();

for (const { file, id } of listLessonFiles()) {
  if (languageOfId(id) !== 'es' || (ids.size > 0 && !ids.has(id))) continue;
  const raw = readJson(file) as Json;
  const units =
    raw.skill === 'listening'
      ? (raw.segments as Json[])
      : (raw.paragraphs as Json[]).flatMap((paragraph) => paragraph.sentences as Json[]);
  for (const unit of units) {
    const text = String(unit.text);
    for (const form of unknownWords(pack.tokenize(text))) {
      const key = form.toLowerCase();
      const entry = found.get(key);
      if (entry) entry.count++;
      else found.set(key, { count: 1, sentence: text, lesson: id });
    }
  }
}

for (const [form, { count, sentence, lesson }] of [...found].sort((a, b) =>
  a[0].localeCompare(b[0], 'es'),
)) {
  console.log(`${form}\t${count}\t${lesson}\t${sentence}`);
}
console.error(`${found.size} forma(s) desconocida(s)`);
