import 'server-only';
import { getSessionOrRedirect } from '@/lib/auth';
import type { DayString } from '@/lib/dates';

/** Minutos de input registrados en un día (app + externo). */
export async function getMinutesOn(day: DayString): Promise<number> {
  const { supabase } = await getSessionOrRedirect();
  const { data, error } = await supabase.from('input_log').select('minutes').eq('logged_on', day);
  if (error) throw new Error(`No se pudo leer el diario: ${error.message}`);
  return data.reduce((sum, row) => sum + row.minutes, 0);
}
