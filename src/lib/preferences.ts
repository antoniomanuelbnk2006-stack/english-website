import 'server-only';
import { cookies } from 'next/headers';
import { cache } from 'react';
import { requireUser } from '@/lib/auth';
import { DEFAULT_LOCALE, LOCALE_COOKIE, isLocale, type Locale } from '@/lib/i18n';
import { DEFAULT_THEME, THEME_COOKIE, isTheme, type Theme } from '@/lib/theme';

export interface UiPreferences {
  theme: Theme;
  locale: Locale;
}

/** Lo que hay en el perfil de quien ha entrado; `null` si no ha entrado nadie. */
async function savedPreferences(): Promise<Partial<UiPreferences> | null> {
  const session = await requireUser();
  if (!session.ok) return null;

  const { data } = await session.supabase
    .from('profiles')
    .select('ui_locale, settings')
    .eq('id', session.user.id)
    .maybeSingle();
  if (!data) return null;

  const { settings } = data;
  const theme =
    typeof settings === 'object' && settings !== null && !Array.isArray(settings)
      ? settings.theme
      : undefined;
  return {
    theme: isTheme(theme) ? theme : undefined,
    locale: isLocale(data.ui_locale) ? data.ui_locale : undefined,
  };
}

/**
 * Tema e idioma de la interfaz. Con las cookies de preferencias salen de ellas, sin consultar
 * nada. Sin ellas (no se han aceptado —ADR-0028— o es un navegador nuevo) salen del perfil de
 * quien ha entrado; y si no ha entrado nadie, son los de por defecto.
 */
export const getUiPreferences = cache(async (): Promise<UiPreferences> => {
  const store = await cookies();
  const theme = store.get(THEME_COOKIE)?.value;
  const locale = store.get(LOCALE_COOKIE)?.value;
  if (isTheme(theme) && isLocale(locale)) return { theme, locale };

  const saved = await savedPreferences();
  return {
    theme: isTheme(theme) ? theme : (saved?.theme ?? DEFAULT_THEME),
    locale: isLocale(locale) ? locale : (saved?.locale ?? DEFAULT_LOCALE),
  };
});
