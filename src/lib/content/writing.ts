import 'server-only';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { CONTENT_ROOT } from './index';
import { WritingPrompt } from './writing-schema';

// Consignas de writing publicadas. El contenido no cambia mientras el servidor está en marcha:
// se lee una vez y se guarda en memoria.

const ROOT = path.join(CONTENT_ROOT, 'writing');

let prompts: Map<string, WritingPrompt> | null = null;

function loadAll(): Map<string, WritingPrompt> {
  if (prompts) return prompts;
  const all = new Map<string, WritingPrompt>();
  if (existsSync(ROOT)) {
    for (const level of readdirSync(ROOT)) {
      const dir = path.join(ROOT, level);
      for (const file of readdirSync(dir).filter((name) => name.endsWith('.json'))) {
        const prompt = WritingPrompt.parse(JSON.parse(readFileSync(path.join(dir, file), 'utf8')));
        if (prompt.status === 'published') all.set(prompt.id, prompt);
      }
    }
  }
  prompts = all;
  return all;
}

export type WritingMeta = Pick<
  WritingPrompt,
  'id' | 'level' | 'task_type' | 'title' | 'topic' | 'context_es' | 'words_min' | 'words_max' | 'time_min'
>;

/** Índice de las consignas publicadas, por id (que ordena por nivel). */
export function getWritingIndex(): WritingMeta[] {
  return [...loadAll().values()]
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

export function findWritingPrompt(id: string): WritingPrompt | null {
  return loadAll().get(id) ?? null;
}
