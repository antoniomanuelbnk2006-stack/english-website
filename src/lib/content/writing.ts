import 'server-only';
import { readFileSync } from 'node:fs';
import type { Locale } from '@/lib/i18n';
import { localize } from './help';
import { assertLanguage, inLanguage, type PracticeLanguage } from './language';
import { listLevelFiles } from './language-dirs';
import { CONTENT_ROOT } from './index';
import { WritingPrompt, type RawWritingPrompt } from './writing-schema';

// Consignas de writing publicadas. El contenido no cambia mientras el servidor está en marcha:
// se lee una vez y se guarda en memoria.

// Se guardan tal cual (con las ayudas sin resolver); cada acceso las resuelve al idioma pedido.
let prompts: Map<string, RawWritingPrompt> | null = null;

function loadAll(): Map<string, RawWritingPrompt> {
  if (prompts) return prompts;
  const all = new Map<string, RawWritingPrompt>();
  // Todos los idiomas: `content/writing/` y `content/<idioma>/writing/` (ADR-0035).
  for (const file of listLevelFiles(CONTENT_ROOT, 'writing', '.json')) {
    const prompt = WritingPrompt.parse(JSON.parse(readFileSync(file.path, 'utf8')));
    assertLanguage(prompt.id, file.language, file.path);
    if (prompt.status === 'published') all.set(prompt.id, prompt);
  }
  prompts = all;
  return all;
}

export type WritingMeta = Pick<
  WritingPrompt,
  'id' | 'level' | 'task_type' | 'title' | 'topic' | 'context_es' | 'words_min' | 'words_max' | 'time_min'
>;

/** Índice de las consignas publicadas, por id (que ordena por nivel), con las ayudas en `locale`. */
export function getWritingIndex(locale: Locale, language: PracticeLanguage): WritingMeta[] {
  return inLanguage([...loadAll().values()], language)
    .map((prompt) => localize(prompt, locale))
    .map(({ id, level, task_type, title, topic, context_es, words_min, words_max, time_min }) => ({
      id,
      level,
      task_type,
      title,
      topic,
      context_es,
      words_min,
      words_max,
      time_min,
    }))
    .sort((a, b) => a.id.localeCompare(b.id));
}

export function findWritingPrompt(id: string, locale: Locale): WritingPrompt | null {
  const prompt = loadAll().get(id);
  return prompt ? localize(prompt, locale) : null;
}
