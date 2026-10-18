// pnpm content:tts --ids b1-lis-001[,…]
// Locuta cada segmento con el proveedor de TTS y guarda audio y tiempos por palabra en
// .audio-cache/ (por hash: repetir el comando no vuelve a gastar caracteres).
import { parseArgs } from 'node:util';
import { LessonDraft } from '../../src/lib/content/schema';
import { listLessonFiles, readJson, splitIds } from './lib/io';
import { packOfLesson } from './lib/language-pack';
import { countWords } from './lib/nlp';
import {
  FREE_CHARS_PER_MONTH,
  charsUsedThisMonth,
  getProvider,
  spokenUnits,
  synthesizeLesson,
  targetWpm,
} from './lib/synthesize';
import { withinRateTolerance } from './lib/timeline';
import { loadWordLists } from './lib/wordlists';

async function main(): Promise<number> {
  const { values } = parseArgs({ options: { ids: { type: 'string', multiple: true } } });
  const ids = new Set(splitIds(values.ids));
  if (ids.size === 0) {
    console.error('Uso: pnpm content:tts --ids <id>[,<id>…]');
    return 2;
  }
  const files = listLessonFiles().filter((file) => ids.has(file.id));
  const missing = [...ids].filter((id) => !files.some((file) => file.id === id));
  if (missing.length > 0) {
    console.error(`No existen estas lecciones: ${missing.join(', ')}`);
    return 2;
  }

  const provider = getProvider();
  const lists = loadWordLists();
  let problems = 0;

  for (const { file, id } of files) {
    const lesson = LessonDraft.parse(readJson(file));
    if (lesson.skill === 'reading' && !lesson.with_audio) {
      console.log(`${id}: with_audio es false, no se locuta.`);
      continue;
    }
    const { units } = spokenUnits(lesson);
    const pack = packOfLesson(lesson.id, lists);
    const words = units.reduce((sum, unit) => sum + countWords(pack.tokenize(unit.text)), 0);
    const audio = await synthesizeLesson(lesson, provider, words);
    const target = targetWpm(lesson);
    const ok = withinRateTolerance(audio.wpm, target);

    console.log(
      `${id}  ${units.length} segmentos · ${audio.wpm} ppm (objetivo ${target} ±8 %) · ` +
        `velocidad ${audio.rate.toFixed(2)}× · ${audio.charsSent} caracteres enviados (${provider.id})`,
    );
    for (const [speaker, voice] of Object.entries(audio.voices)) {
      console.log(`    ${speaker}: ${voice}`);
    }
    if (!ok) {
      problems++;
      console.log(`  ✗ la velocidad queda fuera del ±8 %: revisa target_wpm o el texto.`);
    }
  }

  if (provider.id === 'azure') {
    const used = charsUsedThisMonth();
    const percent = Math.round((used / FREE_CHARS_PER_MONTH) * 100);
    console.log(`\nCapa gratuita de Azure este mes: ${used} de ${FREE_CHARS_PER_MONTH} caracteres (${percent} %).`);
    if (percent >= 80) console.log('  ! Has superado el 80 %: deja el resto del lote para el mes que viene.');
  }
  return problems > 0 ? 1 : 0;
}

main().then(
  (code) => process.exit(code),
  (error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  },
);
