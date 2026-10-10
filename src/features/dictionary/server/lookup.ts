import 'server-only';
import type { z } from 'zod';
import {
  DefinitionResponse,
  needsTranslationSubpage,
  parseDefinitions,
  parseIpa,
  parseSpanish,
  SuggestResponse,
  WikitextResponse,
  type LookupResult,
} from '@/features/dictionary/lib/wiktionary';
import { getDictionary } from '@/lib/content/dictionary';
import { env } from '@/lib/env';

// Consulta a Wiktionary (ADR-0016). La hace el servidor, nunca el navegador: sin claves, sin
// coste y sin guardar el diccionario. Solo sale la palabra buscada.

const BASE = env.DICTIONARY_API_URL ?? 'https://en.wiktionary.org';
/** Wikimedia pide identificar la aplicación. No lleva ningún dato del usuario. */
const HEADERS = {
  'User-Agent': 'Senal/1.0 (personal language-learning app)',
  Accept: 'application/json',
};
const TIMEOUT_MS = 6000;

const CACHE_SIZE = 300;
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const cache = new Map<string, { at: number; result: LookupResult }>();

type Fetched<T> = { ok: true; data: T } | { ok: false; status: number };

/** Petición GET con tope de tiempo y validada con Zod. `status: 0` es un fallo de red o de formato. */
async function getJson<S extends z.ZodType>(url: string, schema: S): Promise<Fetched<z.infer<S>>> {
  try {
    const response = await fetch(url, {
      headers: HEADERS,
      signal: AbortSignal.timeout(TIMEOUT_MS),
      cache: 'no-store',
    });
    if (!response.ok) return { ok: false, status: response.status };
    const parsed = schema.safeParse(await response.json());
    return parsed.success ? { ok: true, data: parsed.data } : { ok: false, status: 0 };
  } catch {
    return { ok: false, status: 0 };
  }
}

const definitionUrl = (title: string) =>
  `${BASE}/api/rest_v1/page/definition/${encodeURIComponent(title.replace(/ /g, '_'))}`;
const apiUrl = (params: Record<string, string>) =>
  `${BASE}/w/api.php?${new URLSearchParams({ format: 'json', formatversion: '2', ...params })}`;

async function wikitextOf(title: string): Promise<string | null> {
  const fetched = await getJson(
    apiUrl({ action: 'parse', page: title, prop: 'wikitext' }),
    WikitextResponse,
  );
  return fetched.ok ? fetched.data.parse.wikitext : null;
}

/** Palabras parecidas: las del mazo que empiezan igual y lo que sugiere Wiktionary. */
async function suggest(term: string): Promise<string[]> {
  const prefix = term.toLowerCase().slice(0, Math.max(3, term.length - 2));
  const fromDeck = (['A1', 'A2', 'B1', 'B2', 'C1', 'C2'] as const)
    .flatMap((level) => getDictionary(level))
    .filter((entry) => entry.lemma.toLowerCase().startsWith(prefix))
    .map((entry) => entry.lemma)
    .slice(0, 4);
  const fetched = await getJson(
    apiUrl({ action: 'opensearch', search: term, limit: '5', namespace: '0' }),
    SuggestResponse,
  );
  const fromWiktionary = fetched.ok ? fetched.data[1] : [];
  return [...new Set([...fromDeck, ...fromWiktionary])]
    .filter((word) => word.toLowerCase() !== term.toLowerCase())
    .slice(0, 6);
}

/**
 * Busca una palabra o expresión inglesa en Wiktionary. Los títulos distinguen mayúsculas, así
 * que se prueba como se ha escrito, en minúsculas y con mayúscula inicial. Las traducciones y
 * la pronunciación son un extra: si esa segunda petición falla, se devuelven las definiciones.
 */
export async function lookupWord(term: string): Promise<LookupResult> {
  const hit = cache.get(term);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.result;

  const lower = term.toLowerCase();
  const titles = [...new Set([term, lower, lower.charAt(0).toUpperCase() + lower.slice(1)])];
  let result: LookupResult | null = null;

  for (const title of titles) {
    const definitions = await getJson(definitionUrl(title), DefinitionResponse);
    if (!definitions.ok) {
      if (definitions.status === 404) continue;
      // No se guarda: puede ser un corte momentáneo.
      return { status: 'unavailable' };
    }
    const groups = parseDefinitions(definitions.data);
    if (groups.length === 0) continue; // existe, pero no como palabra inglesa

    const wikitext = await wikitextOf(title);
    const subpage =
      wikitext && needsTranslationSubpage(wikitext)
        ? await wikitextOf(`${title}/translations`)
        : null;
    result = {
      status: 'found',
      entry: {
        word: title,
        ipa: wikitext ? parseIpa(wikitext) : null,
        groups,
        // La subpágina guarda las de la categoría principal: van delante.
        translations: [...parseSpanish(subpage ?? ''), ...parseSpanish(wikitext ?? '')].slice(0, 8),
      },
    };
    break;
  }

  result ??= { status: 'not_found', suggestions: await suggest(term) };
  if (cache.size >= CACHE_SIZE) {
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) cache.delete(oldest);
  }
  cache.set(term, { at: Date.now(), result });
  return result;
}
