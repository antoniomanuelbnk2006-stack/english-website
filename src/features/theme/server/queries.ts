import 'server-only';
import { cache } from 'react';
import { savedThemeCss } from '@/features/theme/lib/custom-css';
import { requireUser } from '@/lib/auth';

/** El tema personalizado de quien ha entrado (ADR-0033), o `null`. Una consulta por petición. */
export const getCustomThemeCss = cache(async (): Promise<string | null> => {
  const session = await requireUser();
  if (!session.ok) return null;
  const { data } = await session.supabase
    .from('profiles')
    .select('settings')
    .eq('id', session.user.id)
    .maybeSingle();
  return savedThemeCss(data?.settings);
});
