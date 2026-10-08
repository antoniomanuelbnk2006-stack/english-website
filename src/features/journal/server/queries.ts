import 'server-only';
import type { JournalEntry } from '@/features/journal/lib/journal';
import { getSessionOrRedirect } from '@/lib/auth';
import { addDays, todayMadrid, type DayString } from '@/lib/dates';

/** Minutos de input registrados en un día (app + externo). */
export async function getMinutesOn(day: DayString): Promise<number> {
  const { supabase } = await getSessionOrRedirect();
  const { data, error } = await supabase.from('input_log').select('minutes').eq('logged_on', day);
  if (error) throw new Error(`No se pudo leer el diario: ${error.message}`);
  return data.reduce((sum, row) => sum + row.minutes, 0);
}

/** Registros de los últimos `days` días, del más reciente al más antiguo. */
export async function getRecentEntries(days = 28): Promise<JournalEntry[]> {
  const { supabase } = await getSessionOrRedirect();
  const since = addDays(todayMadrid(), -(days - 1));
  const { data, error } = await supabase
    .from('input_log')
    .select('id, kind, source, minutes, words, title, url, perceived_level, logged_on')
    .gte('logged_on', since)
    .order('logged_on', { ascending: false })
    .order('id', { ascending: false })
    .limit(500);
  if (error) throw new Error(`No se pudo leer el diario: ${error.message}`);

  return data.map((row) => ({
    id: row.id,
    kind: row.kind,
    source: row.source,
    minutes: row.minutes,
    words: row.words,
    title: row.title,
    url: row.url,
    perceivedLevel: row.perceived_level,
    loggedOn: row.logged_on,
  }));
}
