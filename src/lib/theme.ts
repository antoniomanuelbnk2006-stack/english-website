export const THEMES = ['dark', 'light', 'system'] as const;
export type Theme = (typeof THEMES)[number];
export const DEFAULT_THEME: Theme = 'dark';
export const THEME_COOKIE = 'senal_theme';

export function isTheme(value: unknown): value is Theme {
  return typeof value === 'string' && (THEMES as readonly string[]).includes(value);
}

/** Un año: las preferencias de apariencia e idioma se recuerdan en una cookie para evitar parpadeos. */
export const PREFERENCE_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;
