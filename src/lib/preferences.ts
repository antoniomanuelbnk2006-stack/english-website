import 'server-only';
import { cookies, headers } from 'next/headers';
import { cache } from 'react';
import { requireUser } from '@/lib/auth';
import {
  FALLBACK_LOCALE,
  LOCALE_COOKIE,
  isLocale,
  localeFromAcceptLanguage,
  type Locale,
} from '@/lib/i18n';
import { LOCALE_REQUEST_HEADER } from '@/lib/i18n/request';
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
 * Tema e idioma de la interfaz. El idioma, por este orden (ADR-0032): el elegido en la dirección
 * (`?lang=`, que el proxy pasa en una cabecera), la cookie de preferencias, el perfil de quien ha
 * entrado, el idioma del navegador y, si no es ninguno de los que hay, inglés. El tema: la cookie,
 * el perfil o el de por defecto. Sin cookies de preferencias (no se han aceptado —ADR-0028— o es
 * un navegador nuevo) se consulta el perfil.
 */
export const getUiPreferences = cache(async (): Promise<UiPreferences> => {
  const [store, request] = await Promise.all([cookies(), headers()]);
  const chosen = request.get(LOCALE_REQUEST_HEADER);
  const cookieTheme = store.get(THEME_COOKIE)?.value;
  const cookieLocale = store.get(LOCALE_COOKIE)?.value;

  const theme = isTheme(cookieTheme) ? cookieTheme : null;
  const locale = isLocale(chosen) ? chosen : isLocale(cookieLocale) ? cookieLocale : null;
  if (theme && locale) return { theme, locale };

  const saved = await savedPreferences();
  return {
    theme: theme ?? saved?.theme ?? DEFAULT_THEME,
    locale:
      locale ??
      saved?.locale ??
      localeFromAcceptLanguage(request.get('accept-language')) ??
      FALLBACK_LOCALE,
  };
});
